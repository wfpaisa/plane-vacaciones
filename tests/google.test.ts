import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { servePocketBase } from "./pocketbase";
import { Script, createContext } from "node:vm";
import { Database } from "bun:sqlite";

const root = resolve(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "vacaciones-google-test-"));
const port = 18091;
const origin = `http://127.0.0.1:${port}`;
const env = { ...process.env, PB_ADMIN_EMAIL: "", PB_ADMIN_PASSWORD: "", ADMIN_USER: "maps-test", ADMIN_PASSWORD: "test-password-2026",
  GOOGLE_MAPS_BROWSER_KEY: "test-browser-key", GOOGLE_PLACES_SERVER_KEY: "test-server-secret", GOOGLE_MAPS_MONTHLY_LIMIT: "2", GOOGLE_PLACES_MONTHLY_LIMIT: "0" };
let server: ReturnType<typeof Bun.spawn>;
let token = "";
async function start() {
  server = servePocketBase(port, dir, env);
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch {}
    await Bun.sleep(100);
  }
  throw new Error(`PocketBase no arrancó: ${await new Response(server.stderr).text()}`);
}
async function request(path: string, method = "GET", body?: unknown, auth = true) {
  return fetch(`${origin}${path}`, { method, headers: { ...(auth ? { Authorization: token } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeAll(async () => {
  await start();
  const response = await request("/api/collections/users/auth-with-password", "POST", { identity: env.ADMIN_USER, password: env.ADMIN_PASSWORD }, false);
  const data = await response.json() as { token: string };
  expect(response.status).toBe(200);
  token = data.token;
}, 20000);
afterAll(async () => { server?.kill(); if (server) await server.exited; });

describe("Google: servidor real con claves de prueba y sin llamadas facturables", () => {
  test("exige autenticación antes de entregar la clave o consumir cuotas", async () => {
    for (const [path, method] of [["map", "POST"], ["usage", "GET"], ["search?q=Madrid", "GET"]]) {
      expect((await request(`/api/vacaciones/google/${path}`, method, undefined, false)).status).toBe(401);
    }
  });
  test("peticiones simultáneas no superan el límite compartido", async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => request("/api/vacaciones/google/map", "POST")));
    const data = await Promise.all(responses.map(async (res) => { expect(res.status).toBe(200); return res.json(); }));
    expect(data.filter((entry) => entry.provider === "google")).toHaveLength(2);
    expect(data.filter((entry) => entry.provider === "current")).toHaveLength(10);
    const usage = await (await request("/api/vacaciones/google/usage")).json();
    expect(usage.maps.used).toBe(2);
    expect(JSON.stringify(data) + JSON.stringify(usage)).not.toContain(env.GOOGLE_PLACES_SERVER_KEY);
  });
  test("los contadores sobreviven al reinicio", async () => {
    server.kill(); await server.exited; await start();
    expect((await (await request("/api/vacaciones/google/map", "POST")).json()).provider).toBe("current");
    expect((await (await request("/api/vacaciones/google/usage")).json()).maps.used).toBe(2);
  });
  test("Places tiene límite independiente y valida la búsqueda", async () => {
    expect((await request("/api/vacaciones/google/search?q=ab")).status).toBe(400);
    expect((await (await request("/api/vacaciones/google/search?q=Madrid")).json()).provider).toBe("current");
    expect((await (await request("/api/vacaciones/google/usage")).json()).places.used).toBe(0);
  });
  test("guarda y recupera coordenadas y origen para lugares y ciudades", async () => {
    const trip = await (await request("/api/collections/trips/records", "POST", { name: "Prueba de coordenadas" })).json();
    for (const collection of ["places", "stops"]) {
      const response = await request(`/api/collections/${collection}/records`, "POST", { trip: trip.id, name: "Lugar de prueba", address: "Madrid, España", lat: 40.4168, lng: -3.7038, geo_provider: "google", google_place_id: "test-place-id" });
      expect(response.status).toBe(200);
      const saved = await response.json();
      const loaded = await (await request(`/api/collections/${collection}/records/${saved.id}`)).json();
      expect(loaded.lat).toBe(40.4168); expect(loaded.lng).toBe(-3.7038);
      expect(loaded.geo_provider).toBe("google"); expect(loaded.google_place_id).toBe("test-place-id");
    }
  });
  test("el consumo del mes anterior no reduce el cupo del nuevo mes", async () => {
    const db = new Database(join(dir, "data.db"));
    db.query("UPDATE google_usage SET month='1900-01'").run();
    db.close();
    const usage = await (await request("/api/vacaciones/google/usage")).json();
    expect(usage.maps.used).toBe(0);
    expect((await (await request("/api/vacaciones/google/map", "POST")).json()).provider).toBe("google");
    expect((await (await request("/api/vacaciones/google/usage")).json()).maps.used).toBe(1);
  });
  test("sin clave y con límite inválido se usa el mapa actual", async () => {
    server.kill(); await server.exited;
    env.GOOGLE_MAPS_BROWSER_KEY = "";
    await start();
    expect((await (await request("/api/vacaciones/google/map", "POST")).json()).provider).toBe("current");
    server.kill(); await server.exited;
    env.GOOGLE_MAPS_BROWSER_KEY = "test-browser-key";
    env.GOOGLE_MAPS_MONTHLY_LIMIT = "invalid";
    await start();
    expect((await (await request("/api/vacaciones/google/map", "POST")).json()).provider).toBe("current");
    expect((await (await request("/api/vacaciones/google/usage")).json()).maps.used).toBe(1);
  });
});

describe("Places: respuesta simulada, sin usar Google", () => {
  function run(status: number, throws = false) {
    const routes: Record<string, (event: unknown) => unknown> = {};
    let reservation: string | undefined;
    let outgoing: { body: string; headers: Record<string, string> } | undefined;
    const context = createContext({ __hooks: "hooks", $os: { getenv: (name: string) => name === "GOOGLE_PLACES_SERVER_KEY" ? "private-test-key" : "" },
      $apis: { requireAuth: () => "auth" },
      require: () => ({ limit: () => 4000, reserve: (_app: unknown, service: string) => { reservation = service; return true; } }),
      routerAdd: (_method: string, path: string, callback: (event: unknown) => unknown) => { routes[path] = callback; },
      $http: { send: (config: typeof outgoing) => {
        outgoing = config;
        if (throws) throw new Error("network");
        return { statusCode: status, json: { places: [{ id: "google-id", displayName: { text: "Museo" }, formattedAddress: "Madrid", location: { latitude: 40.4, longitude: -3.7 }, primaryType: "museum" }] } };
      } }, BadRequestError: Error,
    });
    new Script(readFileSync(join(root, "pb/pb_hooks/google.pb.js"), "utf8")).runInContext(context);
    const query: Record<string, string> = { q: "Museo Madrid", lat: "40.4", lng: "-3.7" };
    const result = routes["/api/vacaciones/google/search"]({ app: { logger: () => ({ warn() {} }) },
      response: { header: () => ({ set() {} }) }, request: { url: { query: () => ({ get: (key: string) => query[key] || "" }) } }, json: (_status: number, data: unknown) => data });
    return { result: result as { provider: string; results: { lat: number; lng: number; placeId: string }[] }, outgoing: outgoing!, reservation };
  }
  test("reserva antes de buscar y devuelve coordenadas e identificador", () => {
    const { result, outgoing, reservation } = run(200);
    expect(reservation).toBe("places"); expect(result.provider).toBe("google");
    expect(result.results[0]).toMatchObject({ lat: 40.4, lng: -3.7, placeId: "google-id" });
    expect(JSON.stringify(result)).not.toContain("private-test-key");
    expect(outgoing.headers["X-Goog-FieldMask"]).not.toContain("*");
    expect(JSON.parse(outgoing.body).locationBias.circle.radius).toBe(50000);
  });
  test("rechazo de IP y errores de red devuelven el proveedor alternativo", () => {
    expect(run(403).result.provider).toBe("current");
    expect(run(200, true).result.provider).toBe("current");
  });
});

// La fecha se prueba en los límites del mes de facturación, no según el equipo.
test("reinicia el mes según hora del Pacífico y desactiva límites inválidos", () => {
  const source = readFileSync(join(root, "pb/pb_hooks/google.js"), "utf8");
  for (const [timestamp, expected] of [["2026-11-01T06:59:59Z", "2026-10"], ["2026-11-01T07:00:00Z", "2026-11"], ["2026-03-01T07:59:59Z", "2026-02"], ["2026-03-01T08:00:00Z", "2026-03"]]) {
    class FixedDate extends Date { constructor(...args: [] | [number]) { super(args.length ? args[0] : Date.parse(timestamp)); } }
    const context = createContext({ Date: FixedDate, module: { exports: {} }, $os: { getenv: () => "oops" } });
    new Script(source).runInContext(context);
    const helpers = context.module.exports as { month(): string; limit(name: string, fallback: number): number };
    expect(helpers.month()).toBe(expected); expect(helpers.limit("cap", 8000)).toBe(0);
  }
});

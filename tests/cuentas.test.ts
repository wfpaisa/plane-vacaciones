import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(30000);
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { servePocketBase } from "./pocketbase";
const root = resolve(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "vacaciones-cuentas-test-"));
const origin = "http://127.0.0.1:18193";
const password = "test-password-2026";
let server: ReturnType<typeof Bun.spawn>;
let admin = "";
async function request(path: string, method = "GET", body?: unknown, token = admin) {
  return fetch(origin + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
// El límite de intentos de PocketBase responde 429: se espera y se reintenta.
async function login(identity: string, pass: string) {
  for (let i = 0; i < 20; i++) {
    const response = await request("/api/collections/users/auth-with-password", "POST", { identity, password: pass }, "");
    if (response.status !== 429) return response.ok ? (await response.json()).token as string : "";
    await Bun.sleep(500);
  }
  return "";
}
beforeAll(async () => {
  server = servePocketBase(18193, dir, { ...process.env, ADMIN_USER: "familia", ADMIN_PASSWORD: password, GOOGLE_PLACES_SERVER_KEY: "", GOOGLE_MAPS_BROWSER_KEY: "" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + "/api/health")).ok) break; } catch {} await Bun.sleep(100); }
  admin = await login("familia", password);
  expect(admin).not.toBe("");
}, 20000);
afterAll(async () => { server?.kill(); if (server) await server.exited; });

test("la primera cuenta entra con usuario y es administradora; el registro público sigue cerrado", async () => {
  const data = await (await request("/api/vacaciones/accounts")).json();
  expect(data.me).toMatchObject({ username: "familia", is_admin: true });
  expect((await request("/api/collections/users/records", "POST", { username: "intruso", password: "x".repeat(12), passwordConfirm: "x".repeat(12) }, "")).status).toBe(403);
  expect((await request("/api/vacaciones/accounts", "GET", undefined, "")).status).toBe(401);
});

test("un miembro crea cuentas con usuario y contraseña, sin correo", async () => {
  const created = await request("/api/vacaciones/accounts", "POST", { username: "Ana.M", name: "Ana", password: "clave-de-ana-1" });
  expect(created.status).toBe(200);
  expect((await created.json()).username).toBe("ana.m");
  const ana = await login("ana.m", "clave-de-ana-1");
  expect(ana).not.toBe("");
  expect((await request("/api/vacaciones/accounts", "POST", { username: "pedro", password: "clave-de-pedro-1" }, ana)).status).toBe(200);
  expect((await request("/api/vacaciones/accounts", "POST", { username: "ana.m", password: "otra-clave-123" })).status).toBe(400);
  expect((await request("/api/vacaciones/accounts", "POST", { username: "x", password: "otra-clave-123" })).status).toBe(400);
  expect((await request("/api/vacaciones/accounts", "POST", { username: "corta", password: "123" })).status).toBe(400);
  // Ana ve los viajes de la familia y no puede darse permisos de administradora.
  expect((await request("/api/collections/trips/records", "GET", undefined, ana)).status).toBe(200);
  const me = (await (await request("/api/vacaciones/accounts", "GET", undefined, ana)).json()).me;
  expect((await request(`/api/collections/users/records/${me.id}`, "PATCH", { is_admin: true }, ana)).status).toBe(403);
  expect((await (await request("/api/vacaciones/accounts", "GET", undefined, ana)).json()).me.is_admin).toBe(false);
});

test("cambiar la propia contraseña exige la actual y cierra las otras sesiones", async () => {
  const before = await login("pedro", "clave-de-pedro-1");
  expect((await request("/api/vacaciones/account/password", "POST", { current: "incorrecta-123", password: "nueva-de-pedro-1" }, before)).status).toBe(400);
  const changed = await request("/api/vacaciones/account/password", "POST", { current: "clave-de-pedro-1", password: "nueva-de-pedro-1" }, before);
  expect(changed.status).toBe(200);
  const fresh = (await changed.json()).token;
  expect((await request("/api/vacaciones/accounts", "GET", undefined, before)).status).toBe(401);
  expect((await request("/api/vacaciones/accounts", "GET", undefined, fresh)).status).toBe(200);
  expect(await login("pedro", "clave-de-pedro-1")).toBe("");
  expect(await login("pedro", "nueva-de-pedro-1")).not.toBe("");
});

test("solo la administradora restablece contraseñas de otras cuentas", async () => {
  const users = (await (await request("/api/vacaciones/accounts")).json()).users;
  const pedro = users.find((u: any) => u.username === "pedro");
  const ana = await login("ana.m", "clave-de-ana-1");
  expect((await request(`/api/vacaciones/accounts/${pedro.id}/password`, "POST", { password: "robada-por-ana-1" }, ana)).status).toBe(403);
  const session = await login("pedro", "nueva-de-pedro-1");
  expect((await request(`/api/vacaciones/accounts/${pedro.id}/password`, "POST", { password: "restablecida-123" })).status).toBe(200);
  expect((await request("/api/vacaciones/accounts", "GET", undefined, session)).status).toBe(401);
  expect(await login("pedro", "restablecida-123")).not.toBe("");
});

test("el enlace compartido muestra el itinerario sin gastos y se puede revocar", async () => {
  const trip = await (await request("/api/collections/trips/records", "POST", { name: "Cartagena", origin: "Medellín", budget: 5000000, currency: "COP", start_date: "2027-01-10 12:00:00.000Z" })).json();
  await request("/api/collections/places/records", "POST", { trip: trip.id, name: "Ciudad amurallada", category: "atraccion", day: 1, cost: 50000 });
  await request("/api/collections/expenses/records", "POST", { trip: trip.id, title: "Hotel", category: "alojamiento", amount: 900000 });
  expect((await (await request(`/api/vacaciones/trips/${trip.id}/share`)).json()).token).toBe("");
  expect((await request(`/api/vacaciones/trips/${trip.id}/share`, "POST", undefined, "")).status).toBe(401);
  const token = (await (await request(`/api/vacaciones/trips/${trip.id}/share`, "POST")).json()).token;
  expect(token.length).toBe(40);
  const view = await (await request(`/api/vacaciones/shared/${token}`, "GET", undefined, "")).json();
  expect(view.trip).toMatchObject({ name: "Cartagena", origin: "Medellín" });
  expect(view.trip.budget).toBeUndefined();
  expect(view.places[0].name).toBe("Ciudad amurallada");
  expect(view.places[0].cost).toBeUndefined();
  expect(view.expenses).toBeUndefined();
  // Sin sesión, el enlace no abre las colecciones.
  expect((await (await request("/api/collections/trips/records", "GET", undefined, "")).json()).items).toHaveLength(0);
  const renewed = (await (await request(`/api/vacaciones/trips/${trip.id}/share`, "POST")).json()).token;
  expect((await request(`/api/vacaciones/shared/${token}`, "GET", undefined, "")).status).toBe(404);
  await request(`/api/vacaciones/trips/${trip.id}/share`, "DELETE");
  expect((await request(`/api/vacaciones/shared/${renewed}`, "GET", undefined, "")).status).toBe(404);
  expect((await request("/api/vacaciones/shared/corto", "GET", undefined, "")).status).toBe(404);
});

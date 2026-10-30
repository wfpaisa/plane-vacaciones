import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { Script, createContext } from "node:vm";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { servePocketBase } from "./pocketbase";
const root = resolve(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "vacaciones-mcp-test-"));
const origin = "http://127.0.0.1:18192";
let server: ReturnType<typeof Bun.spawn>;
let auth = "", token = "";
const password = "test-password-2026";
async function request(path: string, method: string, body?: unknown, authorization = auth, extra: Record<string,string> = {}) {
  return fetch(origin + path, { method, headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: authorization, ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function rpc(method: string, params = {}, authorization = `Bearer ${token}`) {
  return request("/api/vacaciones/mcp", "POST", { jsonrpc: "2.0", id: 1, method, params }, authorization);
}
async function call(name: string, args = {}) {
  const response = await rpc("tools/call", { name, arguments: args });
  expect(response.status).toBe(200);
  return (await response.json()).result;
}
const payload = {
  request_key: "test-complete-trip", trip: { name: "Europa MCP", origin: "Medellín", start_date: "2027-10-14", currency: "EUR", budget: 4000, cover: "menta", notes: "Precios estimados" },
  stops: [{ name: "Madrid", nights: 2, transport: "avion", lat: 40.4168, lng: -3.7038 }, { name: "París", nights: 3, transport: "tren", lat: 48.8566, lng: 2.3522 }],
  travelers: [{ name: "Felipe" }, { name: "Ana" }],
  places: [{ name: "Museo del Prado", category: "atraccion", day: 2, time: "10:00", cost: 20, stop_index: 0, lat: 40.4138, lng: -3.6921 }],
  expenses: [{ title: "Alojamiento estimado", category: "alojamiento", amount: 300, stop_index: 0, paid_by_index: 0, split_indices: [0,1] }],
  checklist: [{ title: "Pasaportes", kind: "individual", assignee_indices: [0,1] }],
};
let created: any;
beforeAll(async () => {
  server = servePocketBase(18192, dir, { ...process.env, ADMIN_USER: "mcp-test", ADMIN_PASSWORD: password, GOOGLE_PLACES_SERVER_KEY: "", GOOGLE_MAPS_BROWSER_KEY: "", MCP_ALLOWED_ORIGINS: "https://allowed.example" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + "/api/health")).ok) break; } catch {} await Bun.sleep(100); }
  const response = await request("/api/collections/users/auth-with-password", "POST", { identity: "mcp-test", password }, "");
  expect(response.status).toBe(200); auth = (await response.json()).token;
}, 20000);
afterAll(async () => { server?.kill(); if (server) await server.exited; });
test("la configuración exige sesión y el token persiste sin exponerse en colecciones", async () => {
  expect((await request("/api/vacaciones/mcp/settings", "GET", undefined, "")).status).toBe(401);
  const response = await request("/api/vacaciones/mcp/settings", "GET");
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  const settings = await response.json(); expect(settings.enabled).toBe(false);
  token = settings.token; expect(token).toMatch(/^vac_mcp_[a-zA-Z0-9]{48}$/);
  expect((await (await request("/api/vacaciones/mcp/settings", "GET")).json()).token).toBe(token);
  expect((await rpc("initialize", {}, "Bearer invalid")).status).toBe(401);
});
test("MCP desactivado por defecto bloquea todas las conexiones y solo la cuenta puede activarlo", async () => {
  expect((await rpc("initialize")).status).toBe(403);
  expect((await rpc("tools/call", { name: "create_trip", arguments: payload })).status).toBe(403);
  for (const method of ["GET", "DELETE"]) expect((await request("/api/vacaciones/mcp", method, undefined, `Bearer ${token}`)).status).toBe(403);
  expect((await request("/api/vacaciones/mcp/settings", "POST", { enabled: true }, "")).status).toBe(401);
  expect((await request("/api/vacaciones/mcp/settings", "POST", { enabled: "true" })).status).toBe(400);
  const result = await (await request("/api/vacaciones/mcp/settings", "POST", { enabled: true })).json();
  expect(result.enabled).toBe(true); expect(result.token).toBe(token);
  expect((await (await request("/api/vacaciones/mcp/settings", "GET")).json()).enabled).toBe(true);
});
test("negocia MCP HTTP, publica herramientas, contexto y prompt", async () => {
  expect((await (await rpc("initialize", { protocolVersion: "2025-06-18" })).json()).result.instructions).toContain("lugar de origen");
  const init = await (await rpc("initialize", { protocolVersion: "2025-06-18", clientInfo: { name: "test", version: "1" }, capabilities: {} })).json();
  expect(init.result.protocolVersion).toBe("2025-06-18"); expect(init.result.capabilities.tools).toEqual({});
  const notification = await request("/api/vacaciones/mcp", "POST", { jsonrpc: "2.0", method: "notifications/initialized" }, `Bearer ${token}`);
  expect(notification.status).toBe(202); expect(await notification.text()).toBe("");
  expect((await (await rpc("tools/list")).json()).result.tools).toHaveLength(9);
  expect(JSON.parse((await call("get_context")).content[0].text).workflow.length).toBeGreaterThan(5);
  expect((await (await rpc("resources/read", { uri: "vacaciones://context" })).json()).result.contents[0].mimeType).toBe("application/json");
  expect((await (await rpc("prompts/get", { name: "plan_vacation", arguments: { preferences: "Roma" } })).json()).result.messages[0].content.text).toContain("Roma");
  expect((await request("/api/vacaciones/mcp", "GET", undefined, `Bearer ${token}`)).status).toBe(405);
});
test("rechaza origen ajeno, versión incorrecta y JSON-RPC inválido", async () => {
  expect((await request("/api/vacaciones/mcp", "POST", { jsonrpc: "2.0", id: 1, method: "ping" }, `Bearer ${token}`, { Origin: "https://evil.example" })).status).toBe(403);
  expect((await request("/api/vacaciones/mcp", "POST", { jsonrpc: "2.0", id: 1, method: "ping" }, `Bearer ${token}`, { "MCP-Protocol-Version": "invalid" })).status).toBe(400);
  expect((await request("/api/vacaciones/mcp", "POST", {}, `Bearer ${token}`)).status).toBe(400);
  expect((await (await rpc("unknown")).json()).error.code).toBe(-32601);
});
test("crea todo el viaje y calcula regreso, posiciones y relaciones", async () => {
  const result = await call("create_trip", payload); expect(result.isError).toBeUndefined();
  created = JSON.parse(result.content[0].text);
  expect(created.trip.end_date.slice(0,10)).toBe("2027-10-19"); expect(created.stops).toHaveLength(2); expect(created.travelers).toHaveLength(2);
  expect(created.places[0].stop).toBe(created.stops[0].id); expect(created.places[0].position).toBe(0);
  expect(created.expenses[0].split).toHaveLength(2); expect(created.checklist[0].assignees).toHaveLength(2);
  const loaded = JSON.parse((await call("get_trip", { trip_id: created.trip.id })).content[0].text);
  expect(loaded.trip.name).toBe("Europa MCP"); expect(loaded.trip.origin).toBe("Medellín");
});
test("reintentar una creación no duplica viajes ni elementos", async () => {
  const again = JSON.parse((await call("create_trip", payload)).content[0].text); expect(again.trip.id).toBe(created.trip.id);
  expect(JSON.parse((await call("list_trips")).content[0].text)).toHaveLength(1);
});
test("una referencia inválida revierte toda la creación", async () => {
  const result = await call("create_trip", { ...payload, request_key: "test-rollback-trip", places: [{ ...payload.places[0], stop_index: 99 }] }); expect(result.isError).toBe(true);
  expect(JSON.parse((await call("list_trips")).content[0].text)).toHaveLength(1);
});
test("amplía sin borrar y recalcula la fecha al actualizar", async () => {
  const result = await call("add_trip_items", { trip_id: created.trip.id, request_key: "test-add-trip-items", places: [{ name: "Paseo", day: 2, category: "naturaleza", stop_index: 0 }], stops: [{ name: "Roma", nights: 2, transport: "avion" }] });
  expect(result.isError).toBeUndefined(); const expanded = JSON.parse(result.content[0].text);
  expect(expanded.places).toHaveLength(2); expect(expanded.places[1].position).toBe(1); expect(expanded.stops).toHaveLength(3); expect(expanded.trip.end_date.slice(0,10)).toBe("2027-10-21");
  const updated = JSON.parse((await call("update_trip", { trip_id: created.trip.id, trip: { start_date: "2027-11-01", notes: "Actualizado" } })).content[0].text);
  expect(updated.trip.end_date.slice(0,10)).toBe("2027-11-08"); expect(updated.trip.notes).toBe("Actualizado");
});
test("edita y elimina elementos existentes solo dentro de su viaje", async () => {
  const before = JSON.parse((await call("get_trip", { trip_id: created.trip.id })).content[0].text);
  const rome = before.stops.find((s: any) => s.name === "Roma"), walk = before.places.find((p: any) => p.name === "Paseo");
  const edited = JSON.parse((await call("update_trip_items", { trip_id: created.trip.id, stops: [{ id: rome.id, nights: 4 }], places: [{ id: walk.id, name: "Paseo por el Retiro", day: 3, cost: 0 }] })).content[0].text);
  expect(edited.stops.find((s: any) => s.id === rome.id).nights).toBe(4);
  const moved = edited.places.find((p: any) => p.id === walk.id);
  expect(moved.name).toBe("Paseo por el Retiro"); expect(moved.day).toBe(3); expect(moved.position).toBe(0);
  expect(edited.trip.end_date.slice(0,10)).toBe("2027-11-10");
  const other = JSON.parse((await call("create_trip", { request_key: "test-other-trip", trip: { name: "Otro", start_date: "2028-01-01", currency: "COP" } })).content[0].text);
  expect((await call("update_trip_items", { trip_id: other.trip.id, places: [{ id: walk.id, name: "Intruso" }] })).isError).toBe(true);
  expect((await call("delete_trip_items", { trip_id: other.trip.id, places: [walk.id] })).isError).toBe(true);
  const removed = JSON.parse((await call("delete_trip_items", { trip_id: created.trip.id, stops: [rome.id], places: [walk.id] })).content[0].text);
  expect(removed.stops.some((s: any) => s.id === rome.id)).toBe(false); expect(removed.places.some((p: any) => p.id === walk.id)).toBe(false);
  expect(removed.trip.end_date.slice(0,10)).toBe("2027-11-06");
});
test("valida coordenadas, fechas, campos desconocidos y categorías", async () => {
  for (const trip of [{ start_date: "2027-02-30" }, { lat: 100, lng: 0 }, { owner: "injected" }]) expect((await call("create_trip", { ...payload, request_key: "invalid-payload-test", trip: { ...payload.trip, ...trip } })).isError).toBe(true);
  expect((await call("search_locations", { query: "a" })).isError).toBe(true);
  expect((await call("search_locations", { query: "Madrid" })).isError).toBe(true);
  expect((await call("add_trip_items", { trip_id: created.trip.id, request_key: "invalid-category-test", places: [{ name: "X", day: 1, category: "invalid" }] })).isError).toBe(true);
});
test("renovar revoca el token anterior y conserva el nuevo", async () => {
  const old = token; token = (await (await request("/api/vacaciones/mcp/token", "POST")).json()).token;
  expect(token).not.toBe(old); expect((await rpc("ping", {}, `Bearer ${old}`)).status).toBe(401); expect((await rpc("ping")).status).toBe(200);
  expect((await (await request("/api/vacaciones/mcp/settings", "GET")).json()).token).toBe(token);
});

test("un cliente del SDK oficial conecta y usa herramientas, recursos y prompts", async () => {
  const client = new Client({ name: "vacaciones-integration-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(origin + "/api/vacaciones/mcp"), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(9);
    const context = await client.callTool({ name: "get_context", arguments: {} });
    expect(context.isError).toBeUndefined();
    expect((await client.readResource({ uri: "vacaciones://context" })).contents).toHaveLength(1);
    expect((await client.getPrompt({ name: "plan_vacation", arguments: { preferences: "Italia" } })).messages).toHaveLength(1);
  } finally { await client.close(); }
});

test("la búsqueda MCP comparte cuota y solo solicita los datos geográficos necesarios", () => {
  let outgoing: any;
  let reserved = 0;
  const ctx = createContext({ module: { exports: {} }, __hooks: "/hooks", $os: { getenv: () => "fake-server-key" }, require: () => ({ limit: () => 4000, reserve: () => { reserved++; return true; } }), $http: { send: (input: any) => { outgoing = input; return { statusCode: 200, json: { places: [{ id: "place-id", displayName: { text: "Madrid" }, formattedAddress: "España", location: { latitude: 40, longitude: -3 } }] } }; } } });
  new Script(readFileSync(join(root, "pb/pb_hooks/mcp.js"), "utf8")).runInContext(ctx);
  const m = (ctx.module as any).exports;
  const results = m.call({}, "user", "search_locations", { query: "Madrid", lat: 40, lng: -3 });
  expect(reserved).toBe(1); expect(results[0].geo_provider).toBe("google"); expect(results[0].google_place_id).toBe("place-id");
  expect(outgoing.headers["X-Goog-FieldMask"]).toBe("places.id,places.displayName,places.formattedAddress,places.location");
  expect(JSON.parse(outgoing.body).locationBias.circle.radius).toBe(50000);
});

test("desactivar bloquea el token vigente y renovarlo no vuelve a activar MCP", async () => {
  const result = await (await request("/api/vacaciones/mcp/settings", "POST", { enabled: false })).json();
  expect(result.enabled).toBe(false); expect(result.token).toBe(token);
  expect((await rpc("ping")).status).toBe(403);
  expect((await rpc("tools/call", { name: "list_trips" })).status).toBe(403);
  const renewed = await (await request("/api/vacaciones/mcp/token", "POST")).json();
  expect(renewed.enabled).toBe(false); expect(renewed.token).not.toBe(token); token = renewed.token;
  expect((await rpc("initialize")).status).toBe(403);
  expect((await (await request("/api/vacaciones/mcp/settings", "GET")).json()).enabled).toBe(false);
  await request("/api/vacaciones/mcp/settings", "POST", { enabled: true });
  expect((await rpc("ping")).status).toBe(200);
});

test("duplica un viaje completo con relaciones independientes y fotos", async () => {
  const source = JSON.parse((await call("get_trip", { trip_id: created.trip.id })).content[0].text);
  const traveler = source.travelers[0];
  const portrait = new FormData();
  portrait.set("portrait", new Blob([await Bun.file(join(root, "web/public/avatars/generic-1.webp")).arrayBuffer()], { type: "image/webp" }), "portrait.webp");
  portrait.set("avatar_variant", "generic-1");
  expect((await fetch(origin + `/api/collections/travelers/records/${traveler.id}`, { method: "PATCH", headers: { Authorization: auth }, body: portrait })).status).toBe(200);
  expect((await request(`/api/vacaciones/trips/${source.trip.id}/duplicate`, "POST", { name: "Copia" }, "")).status).toBe(401);
  expect((await request(`/api/vacaciones/trips/${source.trip.id}/duplicate`, "POST", { name: " " })).status).toBe(400);
  const response = await request(`/api/vacaciones/trips/${source.trip.id}/duplicate`, "POST", { name: " Europa nueva " });
  const trip = await response.json();
  expect(response.status).toBe(201);
  expect(trip.name).toBe("Europa nueva"); expect(trip.id).not.toBe(source.trip.id);
  const copy = JSON.parse((await call("get_trip", { trip_id: trip.id })).content[0].text);
  for (const collection of ["travelers", "stops", "places", "expenses", "checklist"]) {
    expect(copy[collection]).toHaveLength(source[collection].length);
    for (const row of copy[collection]) {
      expect(row.trip).toBe(trip.id);
      expect(source[collection].some((original: any) => original.id === row.id)).toBe(false);
    }
  }
  expect(copy.trip.notes).toBe(source.trip.notes);
  expect(copy.trip.start_date).toBe(source.trip.start_date);
  const stopIds = copy.stops.map((s: any) => s.id), travelerIds = copy.travelers.map((t: any) => t.id);
  for (const row of [...copy.places, ...copy.expenses]) if (row.stop) expect(stopIds).toContain(row.stop);
  for (const row of copy.expenses) {
    if (row.paid_by) expect(travelerIds).toContain(row.paid_by);
    for (const id of row.split) expect(travelerIds).toContain(id);
  }
  for (const row of copy.checklist) for (const id of [...row.assignees, ...row.checked_by]) expect(travelerIds).toContain(id);
  const copiedTraveler = copy.travelers.find((t: any) => t.name === traveler.name);
  expect(copiedTraveler.avatar_variant).toBe("generic-1"); expect(copiedTraveler.portrait).toBeTruthy();
  const file = await fetch(origin + `/api/files/travelers/${copiedTraveler.id}/${copiedTraveler.portrait}`);
  expect(file.status).toBe(200);
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(await Bun.file(join(root, "web/public/avatars/generic-1.webp")).arrayBuffer()));
  expect((await request(`/api/collections/trips/records/${trip.id}`, "DELETE")).status).toBe(204);
  expect((await request(`/api/collections/trips/records/${source.trip.id}`, "GET")).status).toBe(200);
});

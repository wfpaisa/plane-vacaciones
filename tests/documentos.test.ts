import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(30000);
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { servePocketBase } from "./pocketbase";
const root = resolve(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "vacaciones-documentos-test-"));
const origin = "http://127.0.0.1:18194";
const password = "test-password-2026";
let server: ReturnType<typeof Bun.spawn>;
let token = "";
const auth = () => ({ Authorization: token });
async function json(path: string, method = "GET", body?: unknown, headers: Record<string, string> = auth()) {
  return fetch(origin + path, { method, headers: { "Content-Type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function upload(fields: Record<string, string>, name = "seguro.pdf", type = "application/pdf", content = "%PDF-1.4\n%%EOF") {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new File([content], name, { type }));
  return fetch(origin + "/api/collections/documents/records", { method: "POST", headers: auth(), body: form });
}
beforeAll(async () => {
  server = servePocketBase(18194, dir, { ...process.env, ADMIN_USER: "familia", ADMIN_PASSWORD: password, GOOGLE_PLACES_SERVER_KEY: "", GOOGLE_MAPS_BROWSER_KEY: "" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + "/api/health")).ok) break; } catch {} await Bun.sleep(100); }
  token = (await (await json("/api/collections/users/auth-with-password", "POST", { identity: "familia", password }, {})).json()).token;
  expect(token).toBeTruthy();
}, 20000);
afterAll(async () => { server?.kill(); if (server) await server.exited; });

test("los documentos son privados: sin sesión no se listan ni se abren, y no salen en el enlace compartido", async () => {
  const trip = await (await json("/api/collections/trips/records", "POST", { name: "Cartagena" })).json();
  const ana = await (await json("/api/collections/travelers/records", "POST", { trip: trip.id, name: "Ana" })).json();
  const created = await upload({ trip: trip.id, traveler: ana.id, title: "Seguro de Ana", kind: "seguro" });
  expect(created.status).toBe(200);
  const doc = await created.json();

  const url = `/api/files/documents/${doc.id}/${doc.file}`;
  expect((await fetch(origin + url)).status).toBe(404);
  const fileToken = (await (await json("/api/files/token", "POST")).json()).token;
  const file = await fetch(`${origin}${url}?token=${fileToken}`);
  expect(file.status).toBe(200);
  expect(file.headers.get("content-type")).toContain("application/pdf");

  expect((await (await json("/api/collections/documents/records", "GET", undefined, {})).json()).items).toHaveLength(0);
  expect((await json(`/api/collections/documents/records/${doc.id}`, "GET", undefined, {})).status).toBe(404);

  const share = (await (await json(`/api/vacaciones/trips/${trip.id}/share`, "POST")).json()).token;
  const view = await (await json(`/api/vacaciones/shared/${share}`, "GET", undefined, {})).json();
  expect(view.documents).toBeUndefined();
  expect(JSON.stringify(view)).not.toContain(doc.file);
});

test("solo acepta PDF o imágenes; al quitar al viajero el documento pasa al grupo y se borra con el viaje", async () => {
  const trip = await (await json("/api/collections/trips/records", "POST", { name: "Madrid" })).json();
  const ana = await (await json("/api/collections/travelers/records", "POST", { trip: trip.id, name: "Ana" })).json();
  // PocketBase mira el contenido, no la extensión ni el tipo que declara el navegador.
  expect((await upload({ trip: trip.id, title: "Script" }, "virus.exe", "application/x-msdownload", "MZ\x90\x00binario")).status).toBe(400);
  expect((await upload({ trip: trip.id, title: "Disfrazado" }, "falso.pdf", "application/pdf", "<html><script>alert(1)</script></html>")).status).toBe(400);
  const doc = await (await upload({ trip: trip.id, traveler: ana.id, title: "Tiquete", kind: "tiquete" })).json();
  const group = await (await upload({ trip: trip.id, title: "Reserva hotel", kind: "reserva" }, "reserva.png", "image/png")).json();
  expect(group.traveler).toBe("");

  await json(`/api/collections/travelers/records/${ana.id}`, "DELETE");
  const kept = await (await json(`/api/collections/documents/records/${doc.id}`)).json();
  expect(kept.title).toBe("Tiquete");
  expect(kept.traveler).toBe("");

  await json(`/api/collections/trips/records/${trip.id}`, "DELETE");
  expect((await json(`/api/collections/documents/records/${doc.id}`)).status).toBe(404);
  expect((await json(`/api/collections/documents/records/${group.id}`)).status).toBe(404);
});

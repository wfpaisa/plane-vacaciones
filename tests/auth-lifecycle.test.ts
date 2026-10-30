import { afterEach, expect, test } from "bun:test";
import PocketBase, { BaseAuthStore } from "pocketbase";
import { installAuthLifecycle } from "../web/src/lib/authLifecycle";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const token = (seconds: number) => `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;
const record = { id: "family", collectionName: "users" };
function setup(handler: (url: string, options: RequestInit) => Response | Promise<Response>, seconds = 3600) {
  const client = new PocketBase("http://vacaciones.test", new BaseAuthStore());
  client.autoCancellation(false);
  client.authStore.save(token(seconds), record);
  globalThis.fetch = (async (url: string | URL | Request, options: RequestInit) => handler(String(url), options)) as typeof fetch;
  return { client, validate: installAuthLifecycle(client) };
}
const json = (data: unknown, status = 200) => Response.json(data, { status });

test("al volver con un token vencido se elimina también el usuario guardado", async () => {
  let requests = 0;
  const { client, validate } = setup(() => { requests++; return json({}); }, -10);
  await validate(true);
  expect(client.authStore.record).toBeNull();
  expect(client.authStore.token).toBe("");
  expect(requests).toBe(0);
});

test("las consultas simultáneas esperan una sola renovación y usan el nuevo token", async () => {
  let refreshes = 0;
  const fresh = token(7200);
  const authorizations: string[] = [];
  const { client } = setup(async (url, options) => {
    if (url.endsWith("auth-refresh")) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 5));
      return json({ token: fresh, record });
    }
    authorizations.push(new Headers(options.headers).get("Authorization")!);
    return json({});
  }, 120);
  await Promise.all([client.send("/api/vacaciones/accounts", {}), client.send("/api/collections/trips/records", {})]);
  expect(refreshes).toBe(1);
  expect(authorizations).toEqual([fresh, fresh]);
});

test("un rechazo del servidor cierra la sesión y las peticiones posteriores siguen sin token", async () => {
  const sent: (string | null)[] = [];
  const { client } = setup((_url, options) => {
    sent.push(new Headers(options.headers).get("Authorization"));
    return json({}, 401);
  });
  await expect(client.send("/api/vacaciones/accounts", {})).rejects.toMatchObject({ status: 401 });
  expect(client.authStore.record).toBeNull();
  await expect(client.send("/api/vacaciones/accounts", {})).rejects.toMatchObject({ status: 401 });
  expect(sent[1]).toBeNull();
});

test("un fallo de red durante la renovación conserva la sesión y permite reintentar", async () => {
  let attempts = 0;
  const { client, validate } = setup(() => {
    if (++attempts === 1) throw new TypeError("offline");
    return json({ token: token(7200), record });
  });
  await expect(validate(true)).rejects.toMatchObject({ status: 0 });
  expect(client.authStore.record?.id).toBe(record.id);
  await validate(true);
  expect(attempts).toBe(2);
});

test("un error de permisos no cierra una sesión válida", async () => {
  const { client } = setup(() => json({}, 403));
  await expect(client.send("/api/vacaciones/accounts", {})).rejects.toMatchObject({ status: 403 });
  expect(client.authStore.record?.id).toBe(record.id);
});

test("la validación inicial descarta un token revocado aunque todavía no haya vencido", async () => {
  const { client, validate } = setup(() => json({}, 401));
  await expect(validate(true)).rejects.toMatchObject({ status: 401 });
  expect(client.authStore.record).toBeNull();
});

test("una renovación pendiente no vuelve a abrir una sesión cerrada", async () => {
  let finish!: (response: Response) => void;
  const { client, validate } = setup(() => new Promise(resolve => { finish = resolve; }));
  const refreshing = validate(true);
  await Promise.resolve();
  client.authStore.clear();
  finish(json({ token: token(7200), record }));
  await refreshing;
  expect(client.authStore.record).toBeNull();
});

test("un rechazo de una consulta antigua no cierra una sesión nueva", async () => {
  let finish!: (response: Response) => void;
  const { client } = setup(() => new Promise(resolve => { finish = resolve; }));
  const request = client.send("/api/vacaciones/accounts", {});
  // Esperar hasta que la consulta haya salido con el token anterior.
  while (!finish) await Promise.resolve();
  const fresh = token(7200);
  client.authStore.save(fresh, record);
  finish(json({}, 401));
  await expect(request).rejects.toMatchObject({ status: 401 });
  expect(client.authStore.token).toBe(fresh);
});

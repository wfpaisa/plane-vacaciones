import PocketBase, { isTokenExpired, type SendOptions } from "pocketbase";

/** Valida la sesión antes de usarla y renueva una sola vez las consultas simultáneas. */
export function installAuthLifecycle(client: PocketBase) {
  let pending: { token: string; promise: Promise<void> } | null = null;

  async function validate(force = false): Promise<void> {
    const token = client.authStore.token;
    if (!token) return;
    if (!client.authStore.isValid) {
      client.authStore.clear();
      return;
    }
    if (pending?.token === token) return pending.promise;
    if (!force && !isTokenExpired(token, 300)) return;

    const promise = (async () => {
      try {
        // Guardar solo si sigue siendo la misma sesión: pudo cerrarse o cambiar de cuenta.
        const auth = await client.send("/api/collections/users/auth-refresh", { method: "POST" });
        if (client.authStore.token === token) client.authStore.save(auth.token, auth.record);
      } catch (err) {
        // Una caída de red o del servidor no invalida las credenciales guardadas.
        if (client.authStore.token === token && (err as { status?: number }).status === 401) {
          client.authStore.clear();
        }
        throw err;
      }
    })();
    pending = { token, promise };
    try { await promise; }
    finally { if (pending?.promise === promise) pending = null; }
  }

  client.beforeSend = async (url, options) => {
    if (!new URL(url).pathname.startsWith("/api/collections/users/auth-")) {
      const token = client.authStore.token;
      const headers = new Headers(options.headers);
      if (token && headers.get("Authorization") === token) {
        await validate();
        // El SDK añade la autorización antes de ejecutar este hook.
        headers.set("Authorization", client.authStore.token);
        options.headers = Object.fromEntries(headers.entries());
      }
    }
    return { url, options };
  };

  client.afterSend = (response: Response, data: unknown, options?: SendOptions) => {
    const token = client.authStore.token;
    if (response.status === 401 && token && new Headers(options?.headers).get("Authorization") === token) {
      client.authStore.clear();
    }
    return data;
  };

  return validate;
}

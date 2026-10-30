import PocketBase, { ClientResponseError } from "pocketbase";
import { installAuthLifecycle } from "./authLifecycle";

/** En desarrollo Vite pasa `/api` a PocketBase; en producción es el mismo origen. */
export const pb = new PocketBase(location.origin);
pb.autoCancellation(false);
export const validateSession = installAuthLifecycle(pb);

/** Un mensaje legible para cualquier error que venga de PocketBase. */
export function errorText(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) return "No hay conexión con el servidor.";
    if (err.status === 401) return "Tu sesión venció. Inicia sesión de nuevo.";
    if (err.status === 400 && err.url.includes("auth-with-password"))
      return "El usuario o la contraseña no coinciden.";
    if (err.status === 429) return "Demasiados intentos. Espera unos segundos y vuelve a intentarlo.";
    const fields = Object.entries(err.response?.data ?? {})
      .map(([k, v]) => `${k}: ${(v as { message?: string }).message ?? ""}`)
      .join(" · ");
    return fields || err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

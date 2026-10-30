/**
 * Arranca un PocketBase de prueba sobre una carpeta de datos propia.
 *
 * Antes de servir crea un superusuario: sin ninguno, PocketBase abre su
 * instalador en el navegador cada vez que corren los tests.
 */
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const bin = join(root, "pb/pocketbase");

export function servePocketBase(port: number, dir: string, env: Record<string, string | undefined>) {
  const args = [`--dir=${dir}`, `--migrationsDir=${join(root, "pb/pb_migrations")}`, `--hooksDir=${join(root, "pb/pb_hooks")}`];
  Bun.spawnSync([bin, "superuser", "upsert", "tests@vacaciones.test", "test-superuser-2026", ...args], { env, stdout: "ignore", stderr: "inherit" });
  return Bun.spawn([bin, "serve", `--http=127.0.0.1:${port}`, ...args], { env, stdout: "pipe", stderr: "pipe" });
}

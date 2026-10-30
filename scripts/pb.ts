/**
 * Cómo se arranca PocketBase en este proyecto: dónde guarda los datos, de dónde
 * lee las migraciones y qué carpeta publica.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..");
const DIR = join(ROOT, "pb");
const BIN = join(DIR, "pocketbase");

export const PB_PORT = Number(process.env.PB_PORT ?? 8091);

const dirs = [
  `--dir=${join(DIR, "pb_data")}`,
  `--migrationsDir=${join(DIR, "pb_migrations")}`,
  `--hooksDir=${join(DIR, "pb_hooks")}`,
];

function ensureBinary() {
  if (existsSync(BIN)) return;
  console.error("Falta PocketBase. Ejecuta `bun run pocketbase:get`.");
  process.exit(1);
}

/** Crea o actualiza la cuenta de administración con los datos de `.env`. */
export function upsertAdmin() {
  ensureBinary();
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;
  if (!email || !password) return;
  Bun.spawnSync([BIN, "superuser", "upsert", email, password, ...dirs], {
    stdout: "ignore",
    stderr: "inherit",
  });
}

/** Arranca el servidor. `publicDir` es lo que sirve en la raíz. */
export function servePocketBase(publicDir?: string) {
  ensureBinary();
  const args = [BIN, "serve", `--http=127.0.0.1:${PB_PORT}`, ...dirs];
  if (publicDir) args.push(`--publicDir=${publicDir}`);
  return Bun.spawn(args, { cwd: ROOT, stdout: "inherit", stderr: "inherit", env: process.env });
}

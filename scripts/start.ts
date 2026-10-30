/**
 * Producción: compila la web y deja que PocketBase la sirva junto con la API,
 * todo en un solo puerto.
 */
import { join } from "node:path";

import { PB_PORT, ROOT, servePocketBase, upsertAdmin } from "./pb";

const build = Bun.spawnSync(["bun", "run", "build"], { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);

upsertAdmin();
const pb = servePocketBase(join(ROOT, "web", "dist"));
console.log(`\n  Vacaciones lista en http://127.0.0.1:${PB_PORT}\n`);
await pb.exited;

/**
 * Modo desarrollo: PocketBase en su puerto y Vite delante, con recarga en vivo.
 */
import { join } from "node:path";

import { ROOT, servePocketBase, upsertAdmin } from "./pb";

upsertAdmin();
const pb = servePocketBase();

const web = Bun.spawn(["bunx", "--bun", "vite", "--host"], {
  cwd: join(ROOT, "web"),
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
});

const stop = async () => {
  pb.kill();
  web.kill();
  await Promise.allSettled([pb.exited, web.exited]);
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await Promise.race([pb.exited, web.exited]);
stop();

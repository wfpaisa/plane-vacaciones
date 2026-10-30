import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const target = `http://127.0.0.1:${process.env.PB_PORT ?? 8091}`;

export default defineConfig({
  root: here("."),
  plugins: [svelte()],
  resolve: { alias: { "@": here("./src") } },
  css: { devSourcemap: true },
  server: {
    port: Number(process.env.WEB_PORT ?? 3434),
    proxy: {
      "/api": { target, changeOrigin: true, ws: true },
      "/_": { target, changeOrigin: true },
    },
  },
  build: { outDir: here("./dist"), emptyOutDir: true, sourcemap: true },
});

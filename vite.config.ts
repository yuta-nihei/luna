import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { lunaDevGuard } from "./vite.luna-dev-guard";

// Tauri expects a fixed dev server. See https://tauri.app
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [lunaDevGuard(), react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    open: false,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri sources are watched separately. Root index.html is edited as a
      // workspace file — ignore it so saves do not reload the Luna shell.
      ignored: ["**/src-tauri/**", "**/backend/**", "**/index.html"],
    },
  },
  // Env vars starting with these are exposed to the client
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});

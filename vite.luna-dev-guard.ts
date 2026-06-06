import path from "node:path";
import type { Plugin } from "vite";

/**
 * Luna opens the project folder in its own editor while `pnpm tauri dev` runs Vite.
 * Saving the root `index.html` (or other entry HTML) would normally trigger a full
 * page reload — resetting UI state and sometimes focusing a separate browser window.
 * Skip those reloads so workspace saves stay inside the Tauri window.
 */
export function lunaDevGuard(): Plugin {
  return {
    name: "luna-dev-guard",
    handleHotUpdate({ file, server }) {
      const root = server.config.root;
      const rel = path.relative(root, file);
      if (rel === "index.html") {
        return [];
      }
      // Workspace HTML outside src/ must not reload the Luna shell.
      if (rel.endsWith(".html") && !rel.startsWith(`src${path.sep}`)) {
        return [];
      }
    },
  };
}

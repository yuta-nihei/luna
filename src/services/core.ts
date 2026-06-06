import { invoke } from "@tauri-apps/api/core";

// Single entry point to the Go core. Every Core call flows through the Rust
// `core_request` bridge command (Infrastructure layer); services below are thin
// typed wrappers over this.
export async function coreRequest<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return invoke<T>("core_request", { method, params });
}

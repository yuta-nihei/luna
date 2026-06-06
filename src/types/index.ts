// Shared types mirroring the Go core's JSON contracts (backend/*). Keep these in
// sync with the Go structs — they are the wire format across the RPC bridge.

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface ReadFileResult {
  path: string;
  content: string;
  /** CodeMirror-friendly language id; "" means plain text. */
  language: string;
}

export type PaletteItemType = "command" | "url" | "ai" | "workflow" | "terminal";

export interface PaletteItem {
  id: string;
  label: string;
  icon: string;
  type: PaletteItemType;
  value: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

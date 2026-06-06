import type { StateCommand } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

// Thin bridge so commands can read the live CodeMirror document at save time.
// The Editor registers a getter; file.save falls back to the tab store if unset.

let getActiveContent: (() => string | null) | null = null;
let activeView: EditorView | null = null;

export function registerEditorContentGetter(fn: () => string | null): void {
  getActiveContent = fn;
}

export function unregisterEditorContentGetter(): void {
  getActiveContent = null;
}

export function readActiveEditorContent(): string | null {
  return getActiveContent?.() ?? null;
}

export function registerEditorView(view: EditorView): void {
  activeView = view;
}

export function unregisterEditorView(): void {
  activeView = null;
}

export function runEditorCommand(cmd: StateCommand): boolean {
  if (!activeView) return false;
  return cmd(activeView);
}

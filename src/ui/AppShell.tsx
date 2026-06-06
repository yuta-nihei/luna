import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { commands } from "@/commands";
import { usePaletteStore } from "@/store/paletteStore";
import { useUiStore } from "@/store/uiStore";
import { LeftPalette } from "./LeftPalette";
import { PaletteManager } from "./PaletteManager";
import { FolderPicker } from "./FolderPicker";
import { FileTree } from "./FileTree";
import { Editor } from "./Editor";
import { TerminalPanel } from "./TerminalPanel";

export function AppShell(): JSX.Element {
  const loadPalette = usePaletteStore((s) => s.load);
  const fileTreeOpen = useUiStore((s) => s.fileTreeOpen);
  const terminalOpen = useUiStore((s) => s.terminalOpen);
  const paletteManagerOpen = useUiStore((s) => s.paletteManagerOpen);
  const folderPickerOpen = useUiStore((s) => s.folderPickerOpen);

  useEffect(() => {
    void loadPalette();
  }, [loadPalette]);

  // After a dev-server reload, keep focus on the Luna window (not a stray browser).
  useEffect(() => {
    void getCurrentWebviewWindow().setFocus();
  }, []);

  // macOS menu bar Save (Cmd+S) is wired in Rust and emitted here.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("luna:save", () => {
      void commands.execute("file.save");
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // Keyboard-first: global shortcuts route through the command registry.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        void commands.execute("view.toggleFileTree");
      } else if (e.key === "`") {
        e.preventDefault();
        void commands.execute("view.toggleTerminal");
      } else if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        void commands.execute("file.openFolder");
      } else if (key === "w") {
        e.preventDefault();
        void commands.execute("tab.close");
      } else if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        void commands.execute("file.save");
      } else if (e.key === "Tab" || e.key === "PageDown" || e.key === "PageUp") {
        // Ctrl+Tab / Ctrl+PageDown → next, Ctrl+Shift+Tab / Ctrl+PageUp → prev.
        e.preventDefault();
        const prev = e.key === "PageUp" || (e.key === "Tab" && e.shiftKey);
        void commands.execute(prev ? "tab.prev" : "tab.next");
      } else if (key >= "1" && key <= "9" && !e.shiftKey) {
        e.preventDefault();
        void commands.execute("tab.select", Number(key) - 1);
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  return (
    <div className="app">
      <LeftPalette />
      <div className="main">
        <div className="work-area">
          {fileTreeOpen && <FileTree />}
          <Editor />
        </div>
        {terminalOpen && <TerminalPanel />}
      </div>
      {paletteManagerOpen && <PaletteManager />}
      {folderPickerOpen && <FolderPicker />}
    </div>
  );
}

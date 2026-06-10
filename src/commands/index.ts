import { confirm, message } from "@tauri-apps/plugin-dialog";
import type { PaletteItem } from "@/types";
import { basename, dirname, join } from "@/core/path";
import {
  balanceInward,
  balanceOutward,
  decrementNumber1,
  decrementNumber01,
  decrementNumber10,
  enterAbbreviationMode,
  evaluateMath,
  expandAbbreviation,
  goToNextEditPoint,
  goToPreviousEditPoint,
  goToTagPair,
  incrementNumber1,
  incrementNumber01,
  incrementNumber10,
  removeTag,
  selectNextItem,
  selectPreviousItem,
  splitJoinTag,
  toggleComment,
} from "@/editor/emmet";
import { readActiveEditorContent, runEditorCommand } from "@/editor/editorBridge";
import { fsService } from "@/services/fsService";
import { commandService } from "@/services/commandService";
import { urlService } from "@/services/urlService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useFileTreeStore } from "@/store/fileTreeStore";
import { useUiStore } from "@/store/uiStore";
import { useLayoutStore } from "@/store/layoutStore";
import { useTerminalStore } from "@/store/terminalStore";
import { commands } from "./registry";

export { commands } from "./registry";
export type { Command } from "./registry";

// --- File / workspace -------------------------------------------------------

commands.register({
  id: "file.openFolder",
  title: "Open Folder",
  // Luna's own folder picker (FolderPicker.tsx) — the OS dialog's in-window
  // behavior is unreliable on Linux, so we navigate via the Go core instead.
  run: () => useUiStore.getState().setFolderPickerOpen(true),
});

commands.register({
  id: "file.openFolderPath",
  title: "Open Folder Path",
  run: (arg) => {
    if (typeof arg !== "string" || arg.trim() === "") return;
    useWorkspaceStore.getState().setRoot(arg);
    useUiStore.getState().setFileTreeOpen(true);
    useUiStore.getState().setFolderPickerOpen(false);
  },
});

commands.register({
  id: "file.open",
  title: "Open File",
  run: async (arg) => {
    if (typeof arg !== "string") return;
    const ws = useWorkspaceStore.getState();
    // Already open: just focus it — re-reading disk would discard unsaved edits.
    if (ws.tabs.some((t) => t.path === arg)) {
      ws.setActive(arg);
      return;
    }
    const res = await fsService.readFile(arg);
    ws.openTab({
      path: res.path,
      name: basename(res.path),
      content: res.content,
      language: res.language,
    });
  },
});

commands.register({
  id: "file.save",
  title: "Save File",
  run: async () => {
    const ws = useWorkspaceStore.getState();
    const tab = ws.tabs.find((t) => t.path === ws.activePath);
    if (!tab) return;
    const content = readActiveEditorContent() ?? tab.content;
    try {
      await fsService.writeFile(tab.path, content);
      ws.saveTabContent(tab.path, content);
    } catch (e) {
      // Surface the failure — a silent save is worse than a noisy one.
      console.error(e);
      await message(`保存に失敗しました: ${String(e)}`, { title: "Luna", kind: "error" });
    }
  },
});

// --- File operations --------------------------------------------------------
// fs orchestration (path → service → refresh → select/tab sync) lives here, in
// the command layer; the tree store holds only UI + tree data (cf. file.open).

commands.register({
  id: "file.createFile",
  title: "New File",
  run: async (arg) => {
    const { dirPath, name } = (arg ?? {}) as { dirPath?: string; name?: string };
    const tree = useFileTreeStore.getState();
    const trimmed = name?.trim();
    if (!dirPath || !trimmed) return tree.cancelPending();
    try {
      const res = await fsService.createFile(join(dirPath, trimmed));
      tree.cancelPending();
      await tree.refreshDir(dirPath);
      await commands.execute("file.open", res.path);
      tree.select(res.path);
    } catch (e) {
      tree.cancelPending();
      console.error(e);
    }
  },
});

commands.register({
  id: "file.createFolder",
  title: "New Folder",
  run: async (arg) => {
    const { dirPath, name } = (arg ?? {}) as { dirPath?: string; name?: string };
    const tree = useFileTreeStore.getState();
    const trimmed = name?.trim();
    if (!dirPath || !trimmed) return tree.cancelPending();
    try {
      const res = await fsService.createDir(join(dirPath, trimmed));
      tree.cancelPending();
      await tree.refreshDir(dirPath);
      tree.select(res.path);
    } catch (e) {
      tree.cancelPending();
      console.error(e);
    }
  },
});

commands.register({
  id: "file.renameSubmit",
  title: "Rename",
  run: async (arg) => {
    const { path, name } = (arg ?? {}) as { path?: string; name?: string };
    const tree = useFileTreeStore.getState();
    const trimmed = name?.trim();
    if (!path || !trimmed || trimmed === basename(path)) return tree.cancelPending();
    try {
      const res = await fsService.rename(path, join(dirname(path), trimmed));
      tree.cancelPending();
      await tree.refreshDir(dirname(path));
      useWorkspaceStore.getState().renamePath(path, res.path);
      tree.select(res.path);
    } catch (e) {
      tree.cancelPending();
      console.error(e);
    }
  },
});

commands.register({
  id: "file.delete",
  title: "Delete",
  run: async (arg) => {
    if (typeof arg !== "string") return;
    const ok = await confirm(`Delete "${basename(arg)}"? This cannot be undone.`, {
      title: "Luna",
      kind: "warning",
    });
    if (!ok) return;
    const tree = useFileTreeStore.getState();
    try {
      await fsService.delete(arg);
      await tree.refreshDir(dirname(arg));
      if (tree.selectedPath === arg) tree.select(null);
      // Close the deleted file's tab, plus any open file beneath a deleted dir.
      const ws = useWorkspaceStore.getState();
      for (const tab of ws.tabs) {
        if (tab.path === arg || tab.path.startsWith(`${arg}/`) || tab.path.startsWith(`${arg}\\`)) {
          ws.closeTab(tab.path);
        }
      }
    } catch (e) {
      console.error(e);
    }
  },
});

commands.register({
  id: "file.duplicate",
  title: "Duplicate",
  run: async (arg) => {
    if (typeof arg !== "string") return;
    const tree = useFileTreeStore.getState();
    try {
      const res = await fsService.duplicate(arg);
      await tree.refreshDir(dirname(arg));
      tree.select(res.path);
    } catch (e) {
      console.error(e);
    }
  },
});

commands.register({
  id: "files.refresh",
  title: "Refresh File Tree",
  run: () => useFileTreeStore.getState().refresh(),
});

commands.register({
  id: "files.collapseAll",
  title: "Collapse All",
  run: () => useFileTreeStore.getState().collapseAll(),
});

commands.register({
  id: "file.revealActive",
  title: "Reveal Active File",
  run: async () => {
    const active = useWorkspaceStore.getState().activePath;
    if (active) await useFileTreeStore.getState().reveal(active);
  },
});

// --- Tabs -------------------------------------------------------------------

commands.register({
  id: "tab.close",
  title: "Close Tab",
  run: async (arg) => {
    const ws = useWorkspaceStore.getState();
    const path = typeof arg === "string" ? arg : ws.activePath;
    if (!path) return;
    const tab = ws.tabs.find((t) => t.path === path);
    if (tab?.dirty) {
      const ok = await confirm(`"${tab.name}" に保存していない変更があります。閉じますか?`, {
        title: "Luna",
        kind: "warning",
      });
      if (!ok) return;
    }
    ws.closeTab(path);
  },
});

commands.register({
  id: "tab.closeOthers",
  title: "Close Other Tabs",
  run: (arg) => {
    if (typeof arg === "string") useWorkspaceStore.getState().closeOthers(arg);
  },
});

commands.register({
  id: "tab.closeRight",
  title: "Close Tabs to the Right",
  run: (arg) => {
    if (typeof arg === "string") useWorkspaceStore.getState().closeToRight(arg);
  },
});

commands.register({
  id: "tab.closeAll",
  title: "Close All Tabs",
  run: () => useWorkspaceStore.getState().closeAll(),
});

commands.register({
  id: "tab.next",
  title: "Next Tab",
  run: () => useWorkspaceStore.getState().nextTab(),
});

commands.register({
  id: "tab.prev",
  title: "Previous Tab",
  run: () => useWorkspaceStore.getState().prevTab(),
});

commands.register({
  id: "tab.select",
  title: "Select Tab by Index",
  run: (arg) => {
    if (typeof arg === "number") useWorkspaceStore.getState().selectByIndex(arg);
  },
});

// --- Left palette -----------------------------------------------------------

commands.register({
  id: "palette.run",
  title: "Run Palette Action",
  run: async (arg) => {
    const item = arg as PaletteItem | undefined;
    if (!item || typeof item.value !== "string") return;

    if (item.type === "command" || item.type === "terminal") {
      useUiStore.getState().setTerminalOpen(true);
      const term = useTerminalStore.getState();
      const id = term.start(`${item.label}  —  ${item.value}`);
      try {
        const cwd = useWorkspaceStore.getState().rootPath ?? "";
        const result = await commandService.run(item.value, cwd);
        term.finish(id, result);
      } catch (e) {
        term.fail(id, String(e));
      }
      return;
    }
    if (item.type === "url") {
      await urlService.open(item.value);
      return;
    }
    // ai / workflow action types arrive in later slices.
    console.warn(`palette action type not implemented yet: ${item.type}`);
  },
});

commands.register({
  id: "palette.openManager",
  title: "Manage Left Palette",
  run: () => useUiStore.getState().setPaletteManagerOpen(true),
});

// --- View -------------------------------------------------------------------

commands.register({
  id: "view.toggleTerminal",
  title: "Toggle Terminal",
  run: () => useUiStore.getState().toggleTerminal(),
});

commands.register({
  id: "view.toggleFileTree",
  title: "Toggle File Tree",
  run: () => useUiStore.getState().toggleFileTree(),
});

commands.register({
  id: "view.togglePaletteExpanded",
  title: "Toggle Left Palette Expanded",
  run: () => useLayoutStore.getState().togglePaletteExpanded(),
});

// --- Emmet ------------------------------------------------------------------

function emmetCmd(id: string, title: string, cmd: Parameters<typeof runEditorCommand>[0]): void {
  commands.register({
    id,
    title,
    run: () => {
      runEditorCommand(cmd);
    },
  });
}

emmetCmd("emmet.expandAbbreviation", "Emmet: Expand Abbreviation", expandAbbreviation);
emmetCmd("emmet.enterAbbreviationMode", "Emmet: Enter Abbreviation Mode", enterAbbreviationMode);
emmetCmd("emmet.balanceOutward", "Emmet: Balance Outward", balanceOutward);
emmetCmd("emmet.balanceInward", "Emmet: Balance Inward", balanceInward);
emmetCmd("emmet.toggleComment", "Emmet: Toggle Comment", toggleComment);
emmetCmd("emmet.evaluateMath", "Emmet: Evaluate Math", evaluateMath);
emmetCmd("emmet.goToNextEditPoint", "Emmet: Go to Next Edit Point", goToNextEditPoint);
emmetCmd("emmet.goToPreviousEditPoint", "Emmet: Go to Previous Edit Point", goToPreviousEditPoint);
emmetCmd("emmet.goToTagPair", "Emmet: Go to Matching Pair", goToTagPair);
emmetCmd("emmet.removeTag", "Emmet: Remove Tag", removeTag);
emmetCmd("emmet.splitJoinTag", "Emmet: Split/Join Tag", splitJoinTag);
emmetCmd("emmet.selectNextItem", "Emmet: Select Next Item", selectNextItem);
emmetCmd("emmet.selectPreviousItem", "Emmet: Select Previous Item", selectPreviousItem);
emmetCmd("emmet.incrementNumber", "Emmet: Increment Number", incrementNumber1);
emmetCmd("emmet.decrementNumber", "Emmet: Decrement Number", decrementNumber1);
emmetCmd("emmet.incrementNumber01", "Emmet: Increment Number by 0.1", incrementNumber01);
emmetCmd("emmet.decrementNumber01", "Emmet: Decrement Number by 0.1", decrementNumber01);
emmetCmd("emmet.incrementNumber10", "Emmet: Increment Number by 10", incrementNumber10);
emmetCmd("emmet.decrementNumber10", "Emmet: Decrement Number by 10", decrementNumber10);

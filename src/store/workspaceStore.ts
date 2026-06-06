import { create } from "zustand";
import { basename } from "@/core/path";

/** One open file in the editor. `content` tracks in-editor edits; `dirty` is
 * true while those edits are unsaved. */
export interface Tab {
  path: string;
  name: string;
  content: string;
  language: string;
  dirty: boolean;
}

interface WorkspaceState {
  rootPath: string | null;
  tabs: Tab[];
  activePath: string | null;
  setRoot: (path: string) => void;
  openTab: (tab: Omit<Tab, "dirty">) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  /** Sync in-editor edits into the open tab and mark it unsaved. */
  updateContent: (path: string, content: string) => void;
  /** Clear the unsaved flag after a successful save. */
  markSaved: (path: string) => void;
  reorderTabs: (fromPath: string, toPath: string) => void;
  closeOthers: (path: string) => void;
  closeToRight: (path: string) => void;
  closeAll: () => void;
  nextTab: () => void;
  prevTab: () => void;
  selectByIndex: (index: number) => void;
  /** Follow a file renamed/moved in the tree so its open tab stays in sync. */
  renamePath: (oldPath: string, newPath: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  rootPath: null,
  tabs: [],
  activePath: null,

  setRoot: (path) => set({ rootPath: path }),

  openTab: (tab) =>
    set((s) => {
      const opened: Tab = { ...tab, dirty: false };
      const exists = s.tabs.some((t) => t.path === opened.path);
      return {
        tabs: exists
          ? s.tabs.map((t) => (t.path === opened.path ? opened : t))
          : [...s.tabs, opened],
        activePath: opened.path,
      };
    }),

  updateContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, content, dirty: true } : t)),
    })),

  markSaved: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, dirty: false } : t)),
    })),

  closeTab: (path) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path);
      const activePath =
        s.activePath === path ? (tabs.length > 0 ? tabs[tabs.length - 1]!.path : null) : s.activePath;
      return { tabs, activePath };
    }),

  setActive: (path) => set({ activePath: path }),

  reorderTabs: (fromPath, toPath) =>
    set((s) => {
      if (fromPath === toPath) return s;
      const from = s.tabs.findIndex((t) => t.path === fromPath);
      const to = s.tabs.findIndex((t) => t.path === toPath);
      if (from < 0 || to < 0) return s;
      const tabs = [...s.tabs];
      const [moved] = tabs.splice(from, 1);
      tabs.splice(to, 0, moved!);
      return { tabs };
    }),

  closeOthers: (path) =>
    set((s) => {
      const keep = s.tabs.find((t) => t.path === path);
      return keep ? { tabs: [keep], activePath: keep.path } : s;
    }),

  closeToRight: (path) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.path === path);
      if (idx < 0) return s;
      const tabs = s.tabs.slice(0, idx + 1);
      const activeOpen = tabs.some((t) => t.path === s.activePath);
      return { tabs, activePath: activeOpen ? s.activePath : path };
    }),

  closeAll: () => set({ tabs: [], activePath: null }),

  nextTab: () =>
    set((s) => {
      if (s.tabs.length === 0) return s;
      const idx = s.tabs.findIndex((t) => t.path === s.activePath);
      return { activePath: s.tabs[(idx + 1 + s.tabs.length) % s.tabs.length]!.path };
    }),

  prevTab: () =>
    set((s) => {
      if (s.tabs.length === 0) return s;
      const idx = s.tabs.findIndex((t) => t.path === s.activePath);
      return { activePath: s.tabs[(idx - 1 + s.tabs.length) % s.tabs.length]!.path };
    }),

  selectByIndex: (index) =>
    set((s) => {
      const tab = s.tabs[index];
      return tab ? { activePath: tab.path } : s;
    }),

  renamePath: (oldPath, newPath) =>
    set((s) => {
      if (!s.tabs.some((t) => t.path === oldPath)) return s;
      return {
        tabs: s.tabs.map((t) =>
          t.path === oldPath ? { ...t, path: newPath, name: basename(newPath) } : t,
        ),
        activePath: s.activePath === oldPath ? newPath : s.activePath,
      };
    }),
}));

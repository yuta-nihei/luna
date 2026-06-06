import { create } from "zustand";
import type { FileEntry } from "@/types";
import { basename, dirname } from "@/core/path";
import { fsService } from "@/services/fsService";

// The file tree's single source of truth. Tree state used to live in the
// recursive row component; keyboard navigation, refresh, collapse-all and
// post-mutation re-reads all need one shared model, so it lives here and the
// view renders a flattened list of visible nodes.

export type PendingKind = "newFile" | "newFolder" | "rename";

/** An in-progress inline edit (new entry name, or a rename). */
export interface Pending {
  kind: PendingKind;
  /** Directory the new entry is created in (newFile / newFolder). */
  dirPath?: string;
  /** Existing entry being renamed (rename). */
  targetPath?: string;
  /** Initial text shown in the inline input. */
  initial: string;
}

interface NodeState {
  expanded: boolean;
  children: FileEntry[] | null; // null = not loaded yet
  loading: boolean;
}

export interface VisibleNode {
  entry: FileEntry;
  depth: number;
}

interface FileTreeState {
  rootPath: string | null;
  roots: FileEntry[] | null;
  nodes: Record<string, NodeState>;
  selectedPath: string | null;
  error: string | null;
  pending: Pending | null;

  loadRoot: (rootPath: string | null) => Promise<void>;
  toggle: (path: string) => Promise<void>;
  expand: (path: string) => Promise<void>;
  collapse: (path: string) => void;
  select: (path: string | null) => void;
  move: (delta: number) => void;
  refresh: () => Promise<void>;
  refreshDir: (dir: string) => Promise<void>;
  collapseAll: () => void;
  reveal: (path: string) => Promise<void>;
  startCreate: (kind: "newFile" | "newFolder", dirPath: string) => Promise<void>;
  startRename: (path: string) => void;
  cancelPending: () => void;
}

/** Flatten the tree into the ordered rows currently visible (expanded dirs). */
export function visibleNodes(state: Pick<FileTreeState, "roots" | "nodes">): VisibleNode[] {
  const out: VisibleNode[] = [];
  const walk = (entries: FileEntry[], depth: number): void => {
    for (const entry of entries) {
      out.push({ entry, depth });
      if (entry.isDir) {
        const node = state.nodes[entry.path];
        if (node?.expanded && node.children) walk(node.children, depth + 1);
      }
    }
  };
  if (state.roots) walk(state.roots, 0);
  return out;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  rootPath: null,
  roots: null,
  nodes: {},
  selectedPath: null,
  error: null,
  pending: null,

  loadRoot: async (rootPath) => {
    if (!rootPath) {
      set({ rootPath: null, roots: null, nodes: {}, selectedPath: null, error: null, pending: null });
      return;
    }
    set({ rootPath, roots: null, nodes: {}, selectedPath: null, error: null, pending: null });
    try {
      const roots = await fsService.listDir(rootPath);
      if (get().rootPath === rootPath) set({ roots });
    } catch (e) {
      if (get().rootPath === rootPath) set({ error: String(e) });
    }
  },

  expand: async (path) => {
    const node = get().nodes[path];
    if (node?.expanded && node.children) return;
    const needsLoad = node?.children == null;
    set((s) => ({
      nodes: {
        ...s.nodes,
        [path]: { expanded: true, loading: needsLoad, children: s.nodes[path]?.children ?? null },
      },
    }));
    if (!needsLoad) return;
    try {
      const children = await fsService.listDir(path);
      set((s) => ({ nodes: { ...s.nodes, [path]: { ...s.nodes[path]!, children, loading: false } } }));
    } catch {
      set((s) => ({ nodes: { ...s.nodes, [path]: { ...s.nodes[path]!, children: [], loading: false } } }));
    }
  },

  collapse: (path) =>
    set((s) => ({
      nodes: {
        ...s.nodes,
        [path]: { children: null, loading: false, ...s.nodes[path], expanded: false },
      },
    })),

  toggle: async (path) => {
    if (get().nodes[path]?.expanded) get().collapse(path);
    else await get().expand(path);
  },

  select: (path) => set({ selectedPath: path }),

  move: (delta) => {
    const state = get();
    const list = visibleNodes(state);
    if (list.length === 0) return;
    const idx = list.findIndex((n) => n.entry.path === state.selectedPath);
    const next = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, idx + delta));
    set({ selectedPath: list[next]!.entry.path });
  },

  refresh: async () => {
    const { rootPath, nodes } = get();
    if (!rootPath) return;
    try {
      set({ roots: await fsService.listDir(rootPath), error: null });
    } catch (e) {
      set({ error: String(e) });
      return;
    }
    for (const dir of Object.keys(nodes)) {
      if (nodes[dir]!.children == null) continue;
      try {
        const children = await fsService.listDir(dir);
        set((s) => ({ nodes: { ...s.nodes, [dir]: { ...s.nodes[dir]!, children } } }));
      } catch {
        // Directory vanished (e.g. deleted elsewhere); drop its cached node.
        set((s) => {
          const nextNodes = { ...s.nodes };
          delete nextNodes[dir];
          return { nodes: nextNodes };
        });
      }
    }
  },

  refreshDir: async (dir) => {
    if (dir === get().rootPath) {
      try {
        set({ roots: await fsService.listDir(dir), error: null });
      } catch (e) {
        set({ error: String(e) });
      }
      return;
    }
    try {
      const children = await fsService.listDir(dir);
      set((s) => ({
        nodes: { ...s.nodes, [dir]: { expanded: s.nodes[dir]?.expanded ?? true, loading: false, children } },
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  collapseAll: () =>
    set((s) => {
      const nodes: Record<string, NodeState> = {};
      for (const [path, node] of Object.entries(s.nodes)) nodes[path] = { ...node, expanded: false };
      return { nodes };
    }),

  reveal: async (path) => {
    const { rootPath } = get();
    if (!rootPath) return;
    const ancestors: string[] = [];
    let cur = dirname(path);
    while (cur.length > rootPath.length && cur !== rootPath) {
      ancestors.unshift(cur);
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    for (const dir of ancestors) await get().expand(dir);
    set({ selectedPath: path });
  },

  startCreate: async (kind, dirPath) => {
    if (dirPath !== get().rootPath) await get().expand(dirPath);
    set({ pending: { kind, dirPath, initial: "" } });
  },

  startRename: (path) => set({ pending: { kind: "rename", targetPath: path, initial: basename(path) } }),

  cancelPending: () => set({ pending: null }),
}));

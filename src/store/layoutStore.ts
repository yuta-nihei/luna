import { create } from "zustand";

const STORAGE_KEY = "luna:layout";

export const DEFAULT_FILE_TREE_WIDTH = 240;
export const DEFAULT_TERMINAL_RATIO = 0.3;
export const DEFAULT_PALETTE_EXPANDED = false;

const FILE_TREE_MIN = 160;
const FILE_TREE_MAX = 480;
const TERMINAL_MIN_PX = 120;
const TERMINAL_RATIO_MAX = 0.6;

interface PersistedLayout {
  fileTreeWidth: number;
  terminalRatio: number;
  paletteExpanded?: boolean;
}

interface LayoutState {
  fileTreeWidth: number;
  terminalRatio: number;
  paletteExpanded: boolean;
  setFileTreeWidth: (width: number) => void;
  adjustFileTreeWidth: (delta: number) => void;
  setTerminalRatio: (ratio: number) => void;
  adjustTerminalRatio: (deltaPx: number, mainHeight: number) => void;
  togglePaletteExpanded: () => void;
  resetLayout: () => void;
}

function clampFileTreeWidth(width: number): number {
  const viewportMax = Math.min(FILE_TREE_MAX, window.innerWidth * 0.3);
  return Math.min(Math.max(width, FILE_TREE_MIN), viewportMax);
}

function clampTerminalRatio(ratio: number, mainHeight: number): number {
  const minRatio = mainHeight > 0 ? TERMINAL_MIN_PX / mainHeight : 0.1;
  return Math.min(Math.max(ratio, minRatio), TERMINAL_RATIO_MAX);
}

function loadLayout(): PersistedLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedLayout;
    if (typeof data.fileTreeWidth !== "number" || typeof data.terminalRatio !== "number") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveLayout(data: PersistedLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota or private browsing — non-fatal.
  }
}

function persistFromState(state: Pick<LayoutState, "fileTreeWidth" | "terminalRatio" | "paletteExpanded">): void {
  saveLayout({
    fileTreeWidth: state.fileTreeWidth,
    terminalRatio: state.terminalRatio,
    paletteExpanded: state.paletteExpanded,
  });
}

const persisted = loadLayout();

export const useLayoutStore = create<LayoutState>((set, get) => ({
  fileTreeWidth: persisted
    ? clampFileTreeWidth(persisted.fileTreeWidth)
    : DEFAULT_FILE_TREE_WIDTH,
  terminalRatio: persisted?.terminalRatio ?? DEFAULT_TERMINAL_RATIO,
  paletteExpanded: persisted?.paletteExpanded ?? DEFAULT_PALETTE_EXPANDED,

  setFileTreeWidth: (width) => {
    const fileTreeWidth = clampFileTreeWidth(width);
    set({ fileTreeWidth });
    persistFromState({ ...get(), fileTreeWidth });
  },

  adjustFileTreeWidth: (delta) => {
    get().setFileTreeWidth(get().fileTreeWidth + delta);
  },

  setTerminalRatio: (ratio) => {
    const mainHeight = document.querySelector(".main")?.clientHeight ?? window.innerHeight;
    const terminalRatio = clampTerminalRatio(ratio, mainHeight);
    set({ terminalRatio });
    persistFromState({ ...get(), terminalRatio });
  },

  adjustTerminalRatio: (deltaPx, mainHeight) => {
    if (mainHeight <= 0) return;
    const next = get().terminalRatio + deltaPx / mainHeight;
    const terminalRatio = clampTerminalRatio(next, mainHeight);
    set({ terminalRatio });
    persistFromState({ ...get(), terminalRatio });
  },

  togglePaletteExpanded: () => {
    const paletteExpanded = !get().paletteExpanded;
    set({ paletteExpanded });
    persistFromState({ ...get(), paletteExpanded });
  },

  resetLayout: () => {
    set({
      fileTreeWidth: DEFAULT_FILE_TREE_WIDTH,
      terminalRatio: DEFAULT_TERMINAL_RATIO,
    });
    persistFromState({
      fileTreeWidth: DEFAULT_FILE_TREE_WIDTH,
      terminalRatio: DEFAULT_TERMINAL_RATIO,
      paletteExpanded: get().paletteExpanded,
    });
  },
}));

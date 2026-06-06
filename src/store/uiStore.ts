import { create } from "zustand";

// Panel visibility. Per ui.md both the file tree and terminal start hidden and
// appear only when needed.
interface UiState {
  fileTreeOpen: boolean;
  terminalOpen: boolean;
  paletteManagerOpen: boolean;
  folderPickerOpen: boolean;
  toggleFileTree: () => void;
  toggleTerminal: () => void;
  togglePaletteManager: () => void;
  setFileTreeOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  setPaletteManagerOpen: (open: boolean) => void;
  setFolderPickerOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  fileTreeOpen: false,
  terminalOpen: false,
  paletteManagerOpen: false,
  folderPickerOpen: false,
  toggleFileTree: () => set((s) => ({ fileTreeOpen: !s.fileTreeOpen })),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  togglePaletteManager: () => set((s) => ({ paletteManagerOpen: !s.paletteManagerOpen })),
  setFileTreeOpen: (open) => set({ fileTreeOpen: open }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setPaletteManagerOpen: (open) => set({ paletteManagerOpen: open }),
  setFolderPickerOpen: (open) => set({ folderPickerOpen: open }),
}));

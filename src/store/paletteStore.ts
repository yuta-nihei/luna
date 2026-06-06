import { create } from "zustand";
import type { PaletteItem } from "@/types";
import { paletteService } from "@/services/paletteService";

interface PaletteState {
  items: PaletteItem[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: Omit<PaletteItem, "id">) => Promise<void>;
  update: (id: string, patch: Partial<Omit<PaletteItem, "id">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (from: number, to: number) => Promise<void>;
}

export const usePaletteStore = create<PaletteState>((set, get) => {
  // Optimistically apply the next items, then persist to ~/.luna/palette.json.
  // On a write failure the in-memory state still reflects the edit, but `error`
  // is surfaced so the UI can warn that the change wasn't saved.
  const persist = async (items: PaletteItem[]): Promise<void> => {
    set({ items, error: null });
    try {
      await paletteService.save(items);
    } catch (e) {
      set({ error: String(e) });
    }
  };

  return {
    items: [],
    loaded: false,
    error: null,

    load: async () => {
      try {
        const items = await paletteService.load();
        set({ items, loaded: true, error: null });
      } catch (e) {
        set({ error: String(e), loaded: true });
      }
    },

    add: (input) => persist([...get().items, { ...input, id: crypto.randomUUID() }]),

    update: (id, patch) =>
      persist(get().items.map((it) => (it.id === id ? { ...it, ...patch } : it))),

    remove: (id) => persist(get().items.filter((it) => it.id !== id)),

    reorder: (from, to) => {
      const items = [...get().items];
      if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) {
        return Promise.resolve();
      }
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved!);
      return persist(items);
    },
  };
});

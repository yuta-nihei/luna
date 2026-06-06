import type { PaletteItem } from "@/types";
import { coreRequest } from "./core";

// Loads and persists the user's Left Palette definition (seeded on first run by
// the core, then editable from the UI).
export const paletteService = {
  load(): Promise<PaletteItem[]> {
    return coreRequest<PaletteItem[]>("palette.load");
  },
  save(items: PaletteItem[]): Promise<PaletteItem[]> {
    return coreRequest<PaletteItem[]>("palette.save", { items });
  },
};

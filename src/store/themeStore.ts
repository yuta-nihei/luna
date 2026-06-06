import { create } from "zustand";

// Luna Dark is the only theme in this slice; Luna Light is a later addition.
// Kept as a store so the rest of the app reads the active theme from one place.
export type ThemeName = "luna-dark" | "luna-light";

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "luna-dark",
  setTheme: (theme) => set({ theme }),
}));

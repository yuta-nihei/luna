import { create } from "zustand";

/** Output of one palette/command run, shown in the bottom panel. */
export interface TerminalBlock {
  id: string;
  label: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  running: boolean;
  error?: string;
}

interface TerminalState {
  blocks: TerminalBlock[];
  start: (label: string) => string;
  finish: (id: string, result: { stdout: string; stderr: string; exitCode: number }) => void;
  fail: (id: string, message: string) => void;
  clear: () => void;
}

let seq = 0;
const nextId = (): string => `blk-${++seq}`;

export const useTerminalStore = create<TerminalState>((set) => ({
  blocks: [],

  start: (label) => {
    const id = nextId();
    set((s) => ({
      blocks: [...s.blocks, { id, label, stdout: "", stderr: "", exitCode: null, running: true }],
    }));
    return id;
  },

  finish: (id, result) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, ...result, running: false } : b,
      ),
    })),

  fail: (id, message) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, running: false, exitCode: null, error: message } : b,
      ),
    })),

  clear: () => set({ blocks: [] }),
}));

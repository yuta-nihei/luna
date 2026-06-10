import { basename, dirname, join } from "@/core/path";
import type { FileEntry } from "@/types";

export interface CompletionContext {
  baseDir: string;
  prefix: string;
}

/** Derives the directory and partial name to complete from a draft path. */
export function parseCompletionContext(draft: string, cwd: string | null): CompletionContext | null {
  const trimmed = draft.trimEnd();
  if (!trimmed) return null;

  if (/[\\/]$/.test(trimmed)) {
    const baseDir = trimmed.replace(/[\\/]+$/, "") || trimmed;
    return baseDir ? { baseDir, prefix: "" } : null;
  }

  if (/[\\/]/.test(trimmed)) {
    return { baseDir: dirname(trimmed), prefix: basename(trimmed) };
  }

  if (!cwd) return null;
  return { baseDir: cwd, prefix: trimmed };
}

/** Case-insensitive prefix match against directory names. */
export function filterDirCandidates(dirs: FileEntry[], prefix: string): FileEntry[] {
  const needle = prefix.toLowerCase();
  return dirs
    .filter((d) => d.isDir && d.name.toLowerCase().startsWith(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Builds the completed path for a chosen directory name. */
export function buildCompletedPath(baseDir: string, name: string): string {
  return join(baseDir, name);
}

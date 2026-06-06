// Small cross-platform path helpers for the UI. Path semantics that touch the
// filesystem live in the Go core; these only format strings already returned.

/** Last path segment, handling both POSIX and Windows separators. */
export function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

/** Parent directory of a path, preserving the separator style it was given. */
export function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  if (idx < 0) return p;
  // Keep the root separator (e.g. "/file" -> "/", "C:\\file" -> "C:\\").
  return idx === 0 ? p.slice(0, 1) : p.slice(0, idx);
}

/** Joins a directory and a child name using the directory's separator style. */
export function join(dir: string, name: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${sep}${name}`;
}

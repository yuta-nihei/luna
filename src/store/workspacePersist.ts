const SESSION_KEY = "luna:workspace";

interface PersistedTab {
  path: string;
  name: string;
  content: string;
  language: string;
  dirty: boolean;
}

export interface PersistedWorkspace {
  rootPath: string | null;
  tabs: PersistedTab[];
  activePath: string | null;
}

function isTab(value: unknown): value is PersistedTab {
  if (!value || typeof value !== "object") return false;
  const t = value as PersistedTab;
  return (
    typeof t.path === "string" &&
    typeof t.name === "string" &&
    typeof t.content === "string" &&
    typeof t.language === "string" &&
    typeof t.dirty === "boolean"
  );
}

/** Restore tabs and folder from the current browser session (survives Vite full reload). */
export function loadWorkspaceSession(): PersistedWorkspace | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedWorkspace;
    if (!Array.isArray(data.tabs) || !data.tabs.every(isTab)) return null;
    return {
      rootPath: typeof data.rootPath === "string" ? data.rootPath : null,
      tabs: data.tabs,
      activePath: typeof data.activePath === "string" ? data.activePath : null,
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceSession(data: PersistedWorkspace): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Quota or private browsing — non-fatal.
  }
}

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Folder, FolderOpen, X } from "lucide-react";
import type { FileEntry } from "@/types";
import { dirname } from "@/core/path";
import { fsService } from "@/services/fsService";
import { commands } from "@/commands";
import { useUiStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

// In-app folder picker. Luna opens folders without the OS dialog (whose in-window
// behavior we can't control on Linux); navigation here is keyboard-first and runs
// entirely on the Go core's fs.listDir. Closes by choosing a folder or Esc.
export function FolderPicker(): JSX.Element {
  const close = useUiStore((s) => s.setFolderPickerOpen);
  const rootPath = useWorkspaceStore((s) => s.rootPath);

  const [cwd, setCwd] = useState<string | null>(null);
  const [dirs, setDirs] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);

  async function navigateTo(path: string): Promise<void> {
    const target = path.trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await fsService.listDir(target);
      setCwd(target);
      setDraft(target);
      setDirs(entries.filter((e) => e.isDir));
      setSelected(0);
    } catch (e) {
      // Keep cwd at the attempted path so the user can still go back up.
      setCwd(target);
      setDraft(target);
      setDirs([]);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Start at the open workspace root, falling back to the home directory.
  useEffect(() => {
    void (async () => {
      const start = rootPath ?? (await fsService.home().then((r) => r.path).catch(() => "/"));
      await navigateTo(start);
    })();
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to the list after each navigation so arrow keys work immediately.
  useEffect(() => {
    if (!loading) listRef.current?.focus();
  }, [cwd, loading]);

  // Keep the selected row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function goUp(): void {
    if (!cwd) return;
    const parent = dirname(cwd);
    if (parent && parent !== cwd) void navigateTo(parent);
  }

  function choose(): void {
    if (cwd) void commands.execute("file.openFolderPath", cwd);
  }

  function onListKeyDown(e: React.KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelected((i) => Math.min(dirs.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        if (dirs[selected]) void navigateTo(dirs[selected]!.path);
        break;
      case "ArrowLeft":
      case "Backspace":
        e.preventDefault();
        goUp();
        break;
      case "Enter":
        e.preventDefault();
        // Ctrl/Cmd+Enter (or an empty folder) opens the current folder;
        // a plain Enter steps into the highlighted subfolder.
        if (e.ctrlKey || e.metaKey || dirs.length === 0) choose();
        else if (dirs[selected]) void navigateTo(dirs[selected]!.path);
        break;
      default:
        break;
    }
  }

  // Esc closes the picker (unless the path field is mid-edit; that's handled there).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="modal-overlay" onClick={() => close(false)}>
      <div
        className="modal fp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Open Folder"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 className="modal-title">Open Folder</h2>
          <button type="button" className="icon-btn" title="Close (Esc)" onClick={() => close(false)}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>

        <div className="fp-pathbar">
          <button type="button" className="icon-btn" title="Up (Backspace)" onClick={goUp}>
            <ArrowUp size={16} strokeWidth={1.75} />
          </button>
          <input
            className="fp-path"
            value={draft}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") void navigateTo(draft);
              else if (e.key === "Escape") setDraft(cwd ?? "");
            }}
          />
        </div>

        <div className="fp-list" ref={listRef} tabIndex={0} onKeyDown={onListKeyDown}>
          {error && <div className="tree-error">{error}</div>}
          {!error && !loading && dirs.length === 0 && (
            <div className="fp-empty">サブフォルダはありません</div>
          )}
          {dirs.map((dir, idx) => (
            <div
              key={dir.path}
              data-idx={idx}
              className={`fp-row${idx === selected ? " fp-row--selected" : ""}`}
              title={dir.path}
              onClick={() => setSelected(idx)}
              onDoubleClick={() => void navigateTo(dir.path)}
            >
              <span className="fp-row-icon">
                <Folder size={15} />
              </span>
              <span className="fp-row-name">{dir.name}</span>
            </div>
          ))}
        </div>

        <footer className="fp-foot">
          <span className="fp-hint">Enter: 開く / 入る ・ Backspace: 上へ</span>
          <div className="fp-actions">
            <button type="button" className="btn" onClick={() => close(false)}>
              キャンセル
            </button>
            <button type="button" className="btn btn--primary" disabled={!cwd} onClick={choose}>
              <FolderOpen size={15} strokeWidth={1.75} />
              このフォルダを開く
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

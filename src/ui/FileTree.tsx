import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  File as FileIcon,
  FileCode,
  FileJson,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FileEntry } from "@/types";
import { basename, dirname } from "@/core/path";
import { commands } from "@/commands";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useFileTreeStore, visibleNodes } from "@/store/fileTreeStore";
import { ContextMenu, type MenuItem } from "./ContextMenu";

const INDENT = 14;

// Extension → Lucide icon. Kept deliberately small (Calm Interface, ui.md):
// code, JSON, and prose buckets, with a neutral fallback.
const EXT_ICON: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  mjs: FileCode,
  cjs: FileCode,
  go: FileCode,
  rs: FileCode,
  py: FileCode,
  html: FileCode,
  css: FileCode,
  sh: FileCode,
  bash: FileCode,
  json: FileJson,
  md: FileText,
  markdown: FileText,
  txt: FileText,
  yml: FileText,
  yaml: FileText,
  toml: FileText,
};

function iconFor(entry: FileEntry): LucideIcon {
  if (entry.isDir) return Folder;
  const dot = entry.name.lastIndexOf(".");
  const ext = dot >= 0 ? entry.name.slice(dot + 1).toLowerCase() : "";
  return EXT_ICON[ext] ?? FileIcon;
}

/** Inline text input for an in-progress create (new file/folder) or rename. */
function InlineInput({
  depth,
  icon: IconComponent,
  showChevron,
  initial,
  onSubmit,
}: {
  depth: number;
  icon: LucideIcon;
  showChevron: boolean;
  initial: string;
  onSubmit: (value: string) => void;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <div className="tree-row tree-row--input" style={{ paddingLeft: `${8 + depth * INDENT}px` }}>
      <span className="tree-chevron">{showChevron ? <ChevronRight size={14} /> : null}</span>
      <span className="tree-icon">
        <IconComponent size={15} />
      </span>
      <input
        className="tree-input"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onSubmit(value);
          else if (e.key === "Escape") useFileTreeStore.getState().cancelPending();
        }}
        onBlur={() => useFileTreeStore.getState().cancelPending()}
      />
    </div>
  );
}

export function FileTree({ style }: { style?: React.CSSProperties }): JSX.Element {
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const roots = useFileTreeStore((s) => s.roots);
  const nodes = useFileTreeStore((s) => s.nodes);
  const selectedPath = useFileTreeStore((s) => s.selectedPath);
  const pending = useFileTreeStore((s) => s.pending);
  const error = useFileTreeStore((s) => s.error);
  const activePath = useWorkspaceStore((s) => s.activePath);

  const [menu, setMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load (and reload) the tree whenever the workspace root changes.
  useEffect(() => {
    void useFileTreeStore.getState().loadRoot(rootPath);
  }, [rootPath]);

  const visible = useMemo(() => visibleNodes({ roots, nodes }), [roots, nodes]);

  // Keep the keyboard cursor in view as it moves.
  useEffect(() => {
    if (!selectedPath || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-path="${CSS.escape(selectedPath)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedPath]);

  function activate(entry: FileEntry): void {
    const tree = useFileTreeStore.getState();
    tree.select(entry.path);
    if (entry.isDir) void tree.toggle(entry.path);
    else void commands.execute("file.open", entry.path);
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    const tree = useFileTreeStore.getState();
    const entry = visible.find((n) => n.entry.path === tree.selectedPath)?.entry;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        tree.move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        tree.move(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (entry?.isDir) {
          if (!tree.nodes[entry.path]?.expanded) void tree.expand(entry.path);
          else tree.move(1);
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (entry?.isDir && tree.nodes[entry.path]?.expanded) {
          tree.collapse(entry.path);
        } else if (entry) {
          const parent = dirname(entry.path);
          if (visible.some((n) => n.entry.path === parent)) tree.select(parent);
        }
        break;
      case "Enter":
        e.preventDefault();
        if (entry) activate(entry);
        break;
      case "F2":
        e.preventDefault();
        if (entry && entry.path !== rootPath) tree.startRename(entry.path);
        break;
      case "Delete":
        e.preventDefault();
        if (entry) void commands.execute("file.delete", entry.path);
        break;
      default:
        break;
    }
  }

  function openMenu(e: React.MouseEvent, entry: FileEntry): void {
    e.preventDefault();
    useFileTreeStore.getState().select(entry.path);
    setMenu({ x: e.clientX, y: e.clientY, entry });
  }

  function menuItems(entry: FileEntry): MenuItem[] {
    const tree = useFileTreeStore.getState();
    const targetDir = entry.isDir ? entry.path : dirname(entry.path);
    return [
      { label: "New File", onClick: () => void tree.startCreate("newFile", targetDir) },
      { label: "New Folder", onClick: () => void tree.startCreate("newFolder", targetDir) },
      { label: "Rename", onClick: () => tree.startRename(entry.path) },
      { label: "Duplicate", onClick: () => void commands.execute("file.duplicate", entry.path) },
      { label: "Reveal", onClick: () => void tree.reveal(entry.path) },
      { label: "Delete", danger: true, onClick: () => void commands.execute("file.delete", entry.path) },
    ];
  }

  function startRootCreate(kind: "newFile" | "newFolder"): void {
    if (rootPath) void useFileTreeStore.getState().startCreate(kind, rootPath);
  }

  if (!rootPath) {
    return (
      <aside className="file-tree" style={style}>
        <div className="panel-header">Explorer</div>
        <div className="tree-welcome">
          <span className="tree-welcome-icon" aria-hidden="true">
            <Folder size={28} strokeWidth={1.25} />
          </span>
          <p className="tree-welcome-title">フォルダーが開かれていません</p>
          <p className="tree-welcome-desc">プロジェクトフォルダーを選ぶと、ここにファイル一覧が表示されます。</p>
          <button
            type="button"
            className="btn btn--primary tree-welcome-btn"
            onClick={() => void commands.execute("file.openFolder")}
          >
            <FolderOpen size={15} strokeWidth={1.75} />
            フォルダーを開く
          </button>
          <span className="tree-welcome-hint">
            <kbd>Ctrl</kbd>+<kbd>O</kbd>
          </span>
        </div>
      </aside>
    );
  }

  // Build the row list, splicing in the inline create input under its parent dir
  // (or at the top for a root-level create).
  const createPending = pending && pending.kind !== "rename" ? pending : null;
  const rows: JSX.Element[] = [];

  function pushCreateInput(depth: number, dirPath: string): void {
    if (!createPending || createPending.dirPath !== dirPath) return;
    rows.push(
      <InlineInput
        key="__create"
        depth={depth}
        icon={createPending.kind === "newFolder" ? Folder : FileIcon}
        showChevron={createPending.kind === "newFolder"}
        initial=""
        onSubmit={(name) =>
          void commands.execute(
            createPending.kind === "newFolder" ? "file.createFolder" : "file.createFile",
            { dirPath, name },
          )
        }
      />,
    );
  }

  pushCreateInput(0, rootPath);

  for (const { entry, depth } of visible) {
    const IconComponent = iconFor(entry);
    const isRenaming = pending?.kind === "rename" && pending.targetPath === entry.path;
    if (isRenaming) {
      rows.push(
        <InlineInput
          key={entry.path}
          depth={depth}
          icon={IconComponent}
          showChevron={entry.isDir}
          initial={basename(entry.path)}
          onSubmit={(name) => void commands.execute("file.renameSubmit", { path: entry.path, name })}
        />,
      );
    } else {
      const expanded = entry.isDir && nodes[entry.path]?.expanded;
      const loading = entry.isDir && nodes[entry.path]?.loading;
      rows.push(
        <div
          key={entry.path}
          data-path={entry.path}
          className={`tree-row${entry.path === selectedPath ? " tree-row--selected" : ""}${
            !entry.isDir && entry.path === activePath ? " tree-row--active" : ""
          }`}
          style={{ paddingLeft: `${8 + depth * INDENT}px` }}
          title={entry.path}
          onClick={() => {
            scrollRef.current?.focus();
            activate(entry);
          }}
          onContextMenu={(e) => openMenu(e, entry)}
        >
          <span className="tree-chevron">
            {entry.isDir ? expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
          </span>
          <span className="tree-icon">
            <IconComponent size={15} />
          </span>
          <span className="tree-label">{entry.name}</span>
        </div>,
      );
      if (loading) {
        rows.push(
          <div key={`${entry.path}::loading`} className="tree-hint" style={{ paddingLeft: `${8 + (depth + 1) * INDENT}px` }}>
            loading…
          </div>,
        );
      }
    }
    if (entry.isDir) pushCreateInput(depth + 1, entry.path);
  }

  return (
    <aside className="file-tree" style={style}>
      <div className="panel-header tree-header">
        <span className="tree-header-name" title={rootPath}>
          {basename(rootPath)}
        </span>
        <div className="tree-actions">
          <button type="button" className="icon-btn" title="New File" onClick={() => startRootCreate("newFile")}>
            <FilePlus size={15} />
          </button>
          <button type="button" className="icon-btn" title="New Folder" onClick={() => startRootCreate("newFolder")}>
            <FolderPlus size={15} />
          </button>
          <button type="button" className="icon-btn" title="Refresh" onClick={() => void commands.execute("files.refresh")}>
            <RefreshCw size={14} />
          </button>
          <button type="button" className="icon-btn" title="Collapse All" onClick={() => void commands.execute("files.collapseAll")}>
            <ChevronsDownUp size={15} />
          </button>
        </div>
      </div>
      <div className="tree-scroll" ref={scrollRef} tabIndex={0} onKeyDown={onKeyDown}>
        {error && <div className="tree-error">{error}</div>}
        {rows}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.entry)} onClose={() => setMenu(null)} />
      )}
    </aside>
  );
}

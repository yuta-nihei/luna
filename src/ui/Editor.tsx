import { useEffect, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { lunaDark } from "@/themes/lunaDark";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { commands } from "@/commands";
import { emmetExtensions } from "@/editor/emmet";
import {
  registerEditorContentGetter,
  registerEditorView,
  unregisterEditorContentGetter,
  unregisterEditorView,
} from "@/editor/editorBridge";
import { languageExtension } from "./editor-lang";
import { ContextMenu, type MenuItem } from "./ContextMenu";

// Builds editor state for one file. `onDocChange` fires on every edit so the
// open tab's content + dirty flag stay in sync with what's on screen.
function saveCommand(): boolean {
  void commands.execute("file.save");
  return true;
}

function buildState(
  content: string,
  language: string,
  onDocChange: (content: string) => void,
): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      bracketMatching(),
      history(),
      keymap.of([
        { key: "Mod-s", run: saveCommand },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onDocChange(u.state.doc.toString());
      }),
      EditorView.lineWrapping,
      lunaDark,
      ...languageExtension(language),
      ...emmetExtensions(language),
    ],
  });
}

export function Editor(): JSX.Element {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const activeTab = useWorkspaceStore((s) =>
    s.activePath ? s.tabs.find((t) => t.path === s.activePath) ?? null : null,
  );
  const setActive = useWorkspaceStore((s) => s.setActive);
  const reorderTabs = useWorkspaceStore((s) => s.reorderTabs);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const suppressDocSync = useRef(false);
  const dragPath = useRef<string | null>(null);
  const [overPath, setOverPath] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  // Stable across renders: routes editor edits to the currently active tab,
  // reading the latest active path at call time so buildState needn't capture it.
  const handleDocChange = useRef((content: string) => {
    if (suppressDocSync.current) return;
    const path = useWorkspaceStore.getState().activePath;
    if (path) useWorkspaceStore.getState().updateContent(path, content);
  }).current;

  // Create the editor view once.
  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: buildState("", "", handleDocChange),
    });
    viewRef.current = view;
    registerEditorContentGetter(() => {
      const current = viewRef.current;
      return current ? current.state.doc.toString() : null;
    });
    registerEditorView(view);
    return () => {
      unregisterEditorContentGetter();
      unregisterEditorView();
      view.destroy();
      viewRef.current = null;
    };
  }, [handleDocChange]);

  // Swap document + language only when the active *tab* changes — not on its
  // content, so our own edits (which update the store) never rebuild the state
  // and reset the cursor. Content is read fresh from the store at switch time,
  // preserving any unsaved edits made before leaving the tab.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const storeTabs = useWorkspaceStore.getState().tabs;
    suppressDocSync.current = true;
    try {
      if (!activePath) {
        view.setState(buildState("", "", handleDocChange));
        return;
      }
      const tab = storeTabs.find((t) => t.path === activePath);
      if (!tab) return;
      view.setState(buildState(tab.content, tab.language, handleDocChange));
    } finally {
      suppressDocSync.current = false;
    }
  }, [activePath, activeTab?.language, handleDocChange]);

  function menuItems(path: string): MenuItem[] {
    return [
      { label: "Close", onClick: () => void commands.execute("tab.close", path) },
      { label: "Close Others", onClick: () => void commands.execute("tab.closeOthers", path) },
      { label: "Close to the Right", onClick: () => void commands.execute("tab.closeRight", path) },
      { label: "Close All", onClick: () => void commands.execute("tab.closeAll") },
    ];
  }

  return (
    <div className="editor-area">
      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            role="tab"
            aria-selected={tab.path === activePath}
            className={`tab${tab.path === activePath ? " tab--active" : ""}${
              tab.path === overPath ? " tab--over" : ""
            }${tab.path === dragPath.current ? " tab--dragging" : ""}`}
            title={tab.path}
            draggable
            onClick={() => setActive(tab.path)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                void commands.execute("tab.close", tab.path);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, path: tab.path });
            }}
            onDragStart={(e) => {
              dragPath.current = tab.path;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragPath.current && dragPath.current !== tab.path) {
                e.preventDefault();
                setOverPath(tab.path);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragPath.current) reorderTabs(dragPath.current, tab.path);
              dragPath.current = null;
              setOverPath(null);
            }}
            onDragEnd={() => {
              dragPath.current = null;
              setOverPath(null);
            }}
          >
            <span className="tab__name">{tab.name}</span>
            {tab.dirty && (
              <span className="tab__dirty" aria-label="Unsaved changes" title="Unsaved changes">
                ●
              </span>
            )}
            <button
              type="button"
              className={`tab__close${tab.dirty ? " tab__close--dirty" : ""}`}
              aria-label={`Close ${tab.name}`}
              onClick={(e) => {
                e.stopPropagation();
                void commands.execute("tab.close", tab.path);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="editor-body">
        <div className="cm-host" ref={hostRef} />
        {tabs.length === 0 && !rootPath && (
          <div className="editor-empty">
            <span className="welcome-icon" aria-hidden="true">
              <img src="/images/luna-icon-macos.png" alt="" className="luna-brand-icon luna-brand-icon--lg" />
            </span>
            <h1>Luna</h1>
            <p className="welcome-lead">フォルダーを開いて開発を始めましょう</p>
            <button
              type="button"
              className="btn btn--primary btn--lg welcome-open-btn"
              onClick={() => void commands.execute("file.openFolder")}
            >
              <FolderOpen size={18} strokeWidth={1.75} />
              フォルダーを開く
            </button>
            <ul className="shortcut-list">
              <li><kbd>Ctrl</kbd>+<kbd>O</kbd> フォルダーを開く</li>
              <li><kbd>Ctrl</kbd>+<kbd>B</kbd> ファイルツリー</li>
              <li><kbd>Ctrl</kbd>+<kbd>`</kbd> ターミナル</li>
            </ul>
          </div>
        )}
        {tabs.length === 0 && rootPath && (
          <div className="editor-empty editor-empty--hint">
            <p className="welcome-lead">左のファイルツリーからファイルを開いてください</p>
          </div>
        )}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.path)} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

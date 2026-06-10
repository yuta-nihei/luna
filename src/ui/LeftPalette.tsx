import { useState } from "react";
import { ChevronsLeft, ChevronsRight, FolderOpen, Pencil } from "lucide-react";
import { useLayoutStore } from "@/store/layoutStore";
import { usePaletteStore } from "@/store/paletteStore";
import { commands } from "@/commands";
import { Icon } from "./icons";

// Luna's signature control panel. Icon-first, user-configurable: actions run
// through the command registry, can be reordered by drag-and-drop, and are
// added/edited/removed via the palette manager (Pencil button). Persisted to
// ~/.luna/palette.json.
export function LeftPalette(): JSX.Element {
  const items = usePaletteStore((s) => s.items);
  const reorder = usePaletteStore((s) => s.reorder);
  const expanded = useLayoutStore((s) => s.paletteExpanded);
  const toggleExpanded = useLayoutStore((s) => s.togglePaletteExpanded);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const resetDrag = (): void => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <nav
      className={`left-palette${expanded ? " left-palette--expanded" : ""}`}
      aria-label="Left palette"
    >
      <button
        type="button"
        className={`palette-btn palette-btn--folder${expanded ? " palette-btn--wide" : ""}`}
        title="フォルダーを開く (Ctrl+O)"
        onClick={() => void commands.execute("file.openFolder")}
      >
        <FolderOpen size={20} strokeWidth={1.75} />
        {expanded && <span className="palette-btn-label">フォルダーを開く</span>}
      </button>
      <div className="palette-divider" />
      <div className="palette-items">
        {items.map((item, i) => {
          const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
          return (
            <button
              key={item.id}
              type="button"
              draggable
              className={
                "palette-btn" +
                (expanded ? " palette-btn--wide" : "") +
                (dragIndex === i ? " palette-btn--dragging" : "") +
                (isOver ? " palette-btn--over" : "")
              }
              title={expanded ? item.value : `${item.label} — ${item.value}`}
              onClick={() => void commands.execute("palette.run", item)}
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overIndex !== i) setOverIndex(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("text/plain");
                const from = raw === "" ? dragIndex : Number(raw);
                if (from !== null && !Number.isNaN(from)) void reorder(from, i);
                resetDrag();
              }}
              onDragEnd={resetDrag}
            >
              <Icon name={item.icon} />
              {expanded && <span className="palette-btn-label">{item.label}</span>}
            </button>
          );
        })}
      </div>
      <div className="palette-divider" />
      <button
        type="button"
        className={`palette-btn palette-btn--toggle${expanded ? " palette-btn--wide" : ""}`}
        title={expanded ? "パレットを折りたたむ" : "パレットを展開"}
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        {expanded ? <ChevronsLeft size={18} strokeWidth={1.75} /> : <ChevronsRight size={18} strokeWidth={1.75} />}
        {expanded && <span className="palette-btn-label">折りたたむ</span>}
      </button>
      <button
        type="button"
        className={`palette-btn${expanded ? " palette-btn--wide" : ""}`}
        title="Manage Palette"
        onClick={() => void commands.execute("palette.openManager")}
      >
        <Pencil size={20} strokeWidth={1.75} />
        {expanded && <span className="palette-btn-label">パレット管理</span>}
      </button>
    </nav>
  );
}

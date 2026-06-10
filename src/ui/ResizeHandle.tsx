import { useRef } from "react";

interface ResizeHandleProps {
  orientation: "vertical" | "horizontal";
  onResize: (delta: number) => void;
  onDoubleClick?: () => void;
  label: string;
}

export function ResizeHandle({
  orientation,
  onResize,
  onDoubleClick,
  label,
}: ResizeHandleProps): JSX.Element {
  const startPos = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return;
    e.preventDefault();
    startPos.current = orientation === "vertical" ? e.clientX : e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const pos = orientation === "vertical" ? e.clientX : e.clientY;
    const delta = pos - startPos.current;
    if (delta === 0) return;
    startPos.current = pos;
    onResize(delta);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  return (
    <div
      className={`resize-handle resize-handle--${orientation}`}
      role="separator"
      aria-orientation={orientation === "vertical" ? "vertical" : "horizontal"}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    />
  );
}

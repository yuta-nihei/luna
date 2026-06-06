import { useEffect, useRef } from "react";
import { Trash2, X } from "lucide-react";
import { useTerminalStore } from "@/store/terminalStore";
import { useUiStore } from "@/store/uiStore";

// Bottom output panel. In this slice it shows the captured output of one-shot
// palette/command runs; an interactive PTY terminal is a later slice.
export function TerminalPanel(): JSX.Element {
  const blocks = useTerminalStore((s) => s.blocks);
  const clear = useTerminalStore((s) => s.clear);
  const setTerminalOpen = useUiStore((s) => s.setTerminalOpen);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [blocks]);

  return (
    <section className="terminal-panel" aria-label="Terminal output">
      <header className="terminal-header">
        <span className="terminal-title">TERMINAL</span>
        <div className="terminal-actions">
          <button type="button" className="icon-btn" title="Clear" onClick={() => clear()}>
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Close (Ctrl+`)"
            onClick={() => setTerminalOpen(false)}
          >
            <X size={14} />
          </button>
        </div>
      </header>
      <div className="terminal-scroll" ref={scrollRef}>
        {blocks.length === 0 && (
          <div className="terminal-empty">No output yet. Run a Left Palette action.</div>
        )}
        {blocks.map((b) => (
          <div key={b.id} className="terminal-block">
            <div className="terminal-cmd">
              <span className="terminal-prompt">$</span> {b.label}
              {b.running && <span className="terminal-status"> …running</span>}
              {!b.running && b.exitCode !== null && (
                <span className={`terminal-exit${b.exitCode === 0 ? "" : " terminal-exit--err"}`}>
                  {" "}
                  exit {b.exitCode}
                </span>
              )}
            </div>
            {b.stdout && <pre className="terminal-out">{b.stdout}</pre>}
            {b.stderr && <pre className="terminal-out terminal-out--err">{b.stderr}</pre>}
            {b.error && <pre className="terminal-out terminal-out--err">{b.error}</pre>}
          </div>
        ))}
      </div>
    </section>
  );
}

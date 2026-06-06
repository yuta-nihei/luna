import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import type { PaletteItem, PaletteItemType } from "@/types";
import { usePaletteStore } from "@/store/paletteStore";
import { useUiStore } from "@/store/uiStore";
import { Icon, iconNames } from "./icons";

// Action types that have a working runtime (see commands/index.ts). ai/workflow
// are intentionally omitted until their slices land, so users can't create
// palette items that do nothing.
const TYPES: { value: PaletteItemType; label: string }[] = [
  { value: "command", label: "Command" },
  { value: "terminal", label: "Terminal" },
  { value: "url", label: "URL" },
];

interface FormState {
  label: string;
  type: PaletteItemType;
  value: string;
  icon: string;
}

const emptyForm = (): FormState => ({
  label: "",
  type: "command",
  value: "",
  icon: iconNames[0] ?? "box",
});

const valuePlaceholder = (type: PaletteItemType): string =>
  type === "url" ? "https://example.com" : "npm run dev";

// Add / edit / delete dialog for the Left Palette. Reorder happens by dragging
// the icons in the palette itself; this dialog owns the rest of the CRUD.
export function PaletteManager(): JSX.Element {
  const items = usePaletteStore((s) => s.items);
  const error = usePaletteStore((s) => s.error);
  const add = usePaletteStore((s) => s.add);
  const update = usePaletteStore((s) => s.update);
  const remove = usePaletteStore((s) => s.remove);
  const close = useUiStore((s) => s.setPaletteManagerOpen);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const resetForm = (): void => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (item: PaletteItem): void => {
    setEditingId(item.id);
    setForm({ label: item.label, type: item.type, value: item.value, icon: item.icon });
  };

  const onDelete = (id: string): void => {
    void remove(id);
    if (editingId === id) resetForm();
  };

  const valid = form.label.trim() !== "" && form.value.trim() !== "";

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!valid) return;
    const data = {
      label: form.label.trim(),
      type: form.type,
      value: form.value.trim(),
      icon: form.icon,
    };
    if (editingId) void update(editingId, data);
    else void add(data);
    resetForm();
  };

  return (
    <div className="modal-overlay" onClick={() => close(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Manage Left Palette"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 className="modal-title">Manage Palette</h2>
          <button type="button" className="icon-btn" title="Close (Esc)" onClick={() => close(false)}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>

        <div className="modal-body">
          <ul className="pm-list">
            {items.length === 0 && <li className="pm-empty">No actions yet. Add one below.</li>}
            {items.map((item) => (
              <li
                key={item.id}
                className={"pm-row" + (editingId === item.id ? " pm-row--editing" : "")}
              >
                <span className="pm-row-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="pm-row-label">{item.label}</span>
                <span className="pm-row-type">{item.type}</span>
                <button type="button" className="pm-row-btn" onClick={() => startEdit(item)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="pm-row-btn pm-row-btn--danger"
                  title="Delete"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>

          <form className="pm-form" onSubmit={onSubmit}>
            <div className="pm-field">
              <label htmlFor="pm-label">Label</label>
              <input
                id="pm-label"
                ref={firstFieldRef}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Git Status"
              />
            </div>

            <div className="pm-field">
              <label htmlFor="pm-type">Type</label>
              <select
                id="pm-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PaletteItemType })}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pm-field">
              <label htmlFor="pm-value">{form.type === "url" ? "URL" : "Command"}</label>
              <input
                id="pm-value"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={valuePlaceholder(form.type)}
              />
            </div>

            <div className="pm-field">
              <span className="pm-field-label">Icon</span>
              <div className="pm-icons" role="radiogroup" aria-label="Icon">
                {iconNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={form.icon === name}
                    className={"pm-icon" + (form.icon === name ? " pm-icon--on" : "")}
                    title={name}
                    onClick={() => setForm({ ...form, icon: name })}
                  >
                    <Icon name={name} size={18} />
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="pm-error">Save failed: {error}</p>}

            <div className="pm-actions">
              {editingId && (
                <button type="button" className="btn" onClick={resetForm}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn--primary" disabled={!valid}>
                {editingId ? "Save changes" : "Add action"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

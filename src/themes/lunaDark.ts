import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// CodeMirror 6 theme matching Luna Dark (ui.md). Kept restrained — the code is
// the focus, the chrome stays quiet.
const c = {
  bg: "#151922",
  fg: "#d7dae0",
  caret: "#7aa2f7",
  selection: "#283457",
  gutter: "#11151e",
  gutterFg: "#454b5a",
  activeLine: "#1a2030",
  comment: "#5a6072",
  keyword: "#7aa2f7",
  string: "#9ece6a",
  number: "#ff9e64",
  func: "#7dcfff",
  type: "#bb9af7",
  variable: "#d7dae0",
};

const theme = EditorView.theme(
  {
    "&": { color: c.fg, backgroundColor: c.bg, height: "100%" },
    ".cm-content": {
      caretColor: c.caret,
      fontFamily: "var(--luna-font-code)",
      fontSize: "13px",
      "-webkit-font-smoothing": "antialiased",
      "-moz-osx-font-smoothing": "grayscale",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: c.caret },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: c.selection },
    ".cm-activeLine": { backgroundColor: c.activeLine },
    ".cm-activeLineGutter": { backgroundColor: c.activeLine },
    ".cm-gutters": {
      backgroundColor: c.gutter,
      color: c.gutterFg,
      border: "none",
    },
    ".cm-scroller": { fontFamily: "var(--luna-font-code)" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: t.comment, color: c.comment, fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: c.keyword },
  { tag: [t.string, t.special(t.string)], color: c.string },
  { tag: [t.number, t.bool, t.null], color: c.number },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: c.func },
  { tag: [t.typeName, t.className, t.tagName], color: c.type },
  { tag: [t.propertyName, t.attributeName], color: c.func },
  { tag: [t.variableName, t.punctuation], color: c.variable },
  { tag: [t.heading], color: c.keyword, fontWeight: "600" },
  { tag: [t.link, t.url], color: c.func, textDecoration: "underline" },
]);

export const lunaDark: Extension = [theme, syntaxHighlighting(highlight)];

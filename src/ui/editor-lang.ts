import type { Extension } from "@codemirror/state";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";

// Maps the core's detected language id to a CodeMirror language extension.
// Only the languages bundled in this slice are wired; others render as plain
// text and gain highlighting as packages are added.
export function languageExtension(language: string): Extension[] {
  switch (language) {
    case "javascript":
    case "jsx":
      return [javascript({ jsx: true })];
    case "typescript":
      return [javascript({ typescript: true })];
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "json":
      return [json()];
    case "markdown":
      return [markdown()];
    case "html":
      return [html()];
    case "css":
      return [css()];
    default:
      return [];
  }
}

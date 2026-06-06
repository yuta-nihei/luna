import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { indentLess, indentMore } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import {
  abbreviationTracker,
  balanceInward,
  balanceOutward,
  decrementNumber1,
  decrementNumber01,
  decrementNumber10,
  emmetConfig,
  EmmetKnownSyntax,
  enterAbbreviationMode,
  evaluateMath,
  expandAbbreviation,
  goToNextEditPoint,
  goToPreviousEditPoint,
  goToTagPair,
  incrementNumber1,
  incrementNumber01,
  incrementNumber10,
  removeTag,
  selectNextItem,
  selectPreviousItem,
  splitJoinTag,
  toggleComment,
  wrapWithAbbreviation,
} from "@emmetio/codemirror6-plugin";

/** Maps Luna tab language ids to Emmet document syntax. */
export function emmetSyntaxForLanguage(language: string): EmmetKnownSyntax | null {
  switch (language) {
    case "html":
      return EmmetKnownSyntax.html;
    case "css":
      return EmmetKnownSyntax.css;
    case "javascript":
    case "jsx":
    case "tsx":
      return EmmetKnownSyntax.jsx;
    default:
      return null;
  }
}

/** Tab expands a tracked abbreviation, otherwise indents. */
export function emmetTab(view: EditorView): boolean {
  return expandAbbreviation(view) || indentMore(view);
}

function emmetKeymap(): Extension {
  return keymap.of([
    { key: "Tab", run: emmetTab },
    { key: "Shift-Tab", run: indentLess },
    { key: "Mod-e", run: enterAbbreviationMode },
    { key: "Mod-Shift-T", run: goToTagPair },
    { key: "Mod-/", run: toggleComment },
  ]);
}

/** CodeMirror extensions for Emmet; empty when the file language is unsupported. */
export function emmetExtensions(language: string): Extension[] {
  const syntax = emmetSyntaxForLanguage(language);
  if (!syntax) return [];

  return [
    emmetConfig.of({ syntax }),
    ...abbreviationTracker({ syntax }),
    ...wrapWithAbbreviation("Mod-Shift-A"),
    emmetKeymap(),
  ];
}

// Re-export Emmet StateCommands for Luna command registration.
export {
  balanceInward,
  balanceOutward,
  decrementNumber1,
  decrementNumber01,
  decrementNumber10,
  enterAbbreviationMode,
  evaluateMath,
  expandAbbreviation,
  goToNextEditPoint,
  goToPreviousEditPoint,
  goToTagPair,
  incrementNumber1,
  incrementNumber01,
  incrementNumber10,
  removeTag,
  selectNextItem,
  selectPreviousItem,
  splitJoinTag,
  toggleComment,
};

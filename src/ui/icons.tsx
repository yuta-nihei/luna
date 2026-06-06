import {
  Box,
  File,
  Folder,
  FolderOpen,
  GitBranch,
  Globe,
  List,
  Play,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Maps palette/icon names (kebab-case, as stored in palette.json) to Lucide
// components. Unknown names fall back to a neutral box.
const ICONS: Record<string, LucideIcon> = {
  terminal: TerminalSquare,
  "terminal-square": TerminalSquare,
  "git-branch": GitBranch,
  list: List,
  folder: Folder,
  "folder-open": FolderOpen,
  file: File,
  play: Play,
  globe: Globe,
  sparkles: Sparkles,
  box: Box,
};

// The icon names users can choose from in the palette editor.
export const iconNames: string[] = Object.keys(ICONS);

export function Icon({ name, size = 20 }: { name: string; size?: number }): JSX.Element {
  const Component = ICONS[name] ?? Box;
  return <Component size={size} strokeWidth={1.75} />;
}

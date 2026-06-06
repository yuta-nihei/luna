import type { FileEntry, ReadFileResult } from "@/types";
import { coreRequest } from "./core";

// Filesystem access. The UI never touches disk directly — all reads go through
// the Go core (CLAUDE.md: Go owns file operations).
export const fsService = {
  listDir(path: string): Promise<FileEntry[]> {
    return coreRequest<FileEntry[]>("fs.listDir", { path });
  },
  home(): Promise<{ path: string }> {
    return coreRequest<{ path: string }>("fs.home");
  },
  readFile(path: string): Promise<ReadFileResult> {
    return coreRequest<ReadFileResult>("fs.readFile", { path });
  },
  writeFile(path: string, content: string): Promise<{ path: string }> {
    return coreRequest<{ path: string }>("fs.writeFile", { path, content });
  },
  createFile(path: string): Promise<{ path: string }> {
    return coreRequest<{ path: string }>("fs.createFile", { path });
  },
  createDir(path: string): Promise<{ path: string }> {
    return coreRequest<{ path: string }>("fs.createDir", { path });
  },
  rename(path: string, newPath: string): Promise<{ path: string }> {
    return coreRequest<{ path: string }>("fs.rename", { path, newPath });
  },
  delete(path: string): Promise<{ path: string }> {
    return coreRequest<{ path: string }>("fs.delete", { path });
  },
  duplicate(path: string): Promise<{ path: string }> {
    return coreRequest<{ path: string }>("fs.duplicate", { path });
  },
};

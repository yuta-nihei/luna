import type { CommandResult } from "@/types";
import { coreRequest } from "./core";

// Runs a one-shot shell command via the core and returns its captured output.
export const commandService = {
  run(value: string, cwd = ""): Promise<CommandResult> {
    return coreRequest<CommandResult>("command.run", { value, cwd });
  },
};

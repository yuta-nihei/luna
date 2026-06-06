// The Command layer (architecture.md). Every user operation is a Command; the
// UI only ever calls into this registry, never the services directly. This is
// also the future backing store for the command palette.

export interface Command {
  id: string;
  title: string;
  run: (arg?: unknown) => void | Promise<void>;
}

class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  all(): Command[] {
    return [...this.commands.values()];
  }

  async execute(id: string, arg?: unknown): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      console.warn(`unknown command: ${id}`);
      return;
    }
    await command.run(arg);
  }
}

export const commands = new CommandRegistry();

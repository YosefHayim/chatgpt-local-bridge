import type { CommandDef, CommandContext } from "../../types/types.ts";

const commands = new Map<string, CommandDef>();

/** Register a command. */
export function registerCommand(cmd: CommandDef): void {
  commands.set(cmd.name, cmd);
}

function listCommands(): CommandDef[] {
  return [...commands.values()];
}

function parseCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIdx = trimmed.indexOf(" ");
  const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);

  if (!commands.has(name)) return null;
  return { name, args };
}

/** Execute a command, returning true if it was handled. */
export async function executeCommand(
  input: string,
  ctx: CommandContext,
): Promise<boolean> {
  const parsed = parseCommand(input);
  if (!parsed) return false;

  const cmd = commands.get(parsed.name);
  if (!cmd) return false;

  await cmd.handler(parsed.args, ctx);
  return true;
}

/** Built-in /help command — lists all registered commands. */
registerCommand({
  name: "help",
  description: "List all available commands",
  handler: async (_args: string, _ctx: CommandContext) => {
    const all = listCommands();
    console.log("\nAvailable commands:\n");
    for (const cmd of all) {
      console.log(`  /${cmd.name.padEnd(16)} ${cmd.description}`);
    }
    console.log("");
  },
});

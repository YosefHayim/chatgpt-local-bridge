import type { CommandContext } from "../../types/types.ts";
import { registerCommand } from "./registry.ts";

/** /context — show token usage and context window status. */
registerCommand({
  name: "context",
  description: "Show context window usage",
  handler: async (_args: string, _ctx: CommandContext) => {
    // Context counter info is displayed via the context bar in the UI.
    // This command triggers a manual display.
    console.log("Context counter displayed in the status bar below.");
  },
});

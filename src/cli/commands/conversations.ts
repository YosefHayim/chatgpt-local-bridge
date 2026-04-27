import type { CommandContext } from "../../types/types.ts";
import { registerCommand } from "./registry.ts";

/** /conversations — list sidebar conversations from ChatGPT. */
registerCommand({
  name: "conversations",
  description: "List ChatGPT sidebar conversations",
  handler: async (_args: string, ctx: CommandContext) => {
    console.log("Fetching conversations from ChatGPT sidebar...");
    // Orchestrator will handle the actual browser interaction
    // This is a signal to the UI layer
    await ctx.sendMessage("/conversations");
  },
});

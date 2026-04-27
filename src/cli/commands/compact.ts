import type { CommandContext } from "../../types/types.ts";
import { registerCommand } from "./registry.ts";

/** /compact — trigger context compaction by asking ChatGPT to summarize. */
registerCommand({
  name: "compact",
  description: "Summarize conversation and reset context window",
  handler: async (_args: string, ctx: CommandContext) => {
    await ctx.sendMessage(
      "Summarize our progress so far in a structured format: what we've done, what's in progress, what's next. Be concise.",
    );
    console.log("Compaction requested. A new context window will start after the summary.");
  },
});

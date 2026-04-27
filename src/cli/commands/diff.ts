import type { CommandContext } from "../../types/types.ts";
import { registerCommand } from "./registry.ts";

/** /diff — show current git diff. */
registerCommand({
  name: "diff",
  description: "Show current git diff",
  handler: async (_args: string, ctx: CommandContext) => {
    await ctx.sendMessage("Show me the current git diff for the repository.");
  },
});

import type { CommandContext } from "../../types/types.ts";
import { registerCommand } from "./registry.ts";

/** /exit — graceful shutdown. */
registerCommand({
  name: "exit",
  description: "Shutdown the bridge",
  handler: async (_args: string, _ctx: CommandContext) => {
    console.log("Shutting down...");
    process.exit(0);
  },
});

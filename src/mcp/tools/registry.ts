import type { ToolDef } from "../../types/types.ts";
import { grepTool } from "./grep.ts";
import { readFileDef } from "./read-file.ts";
import { applyPatchTool } from "./apply-patch.ts";
import { runTestsTool } from "./run-tests.ts";
import { gitDiffTool } from "./git-diff.ts";

/** All available MCP tools, indexed by name. */
export const toolRegistry: Map<string, ToolDef> = new Map();

for (const tool of [grepTool, readFileDef, applyPatchTool, runTestsTool, gitDiffTool]) {
  toolRegistry.set(tool.name, tool);
}

/** Get a tool by name, or undefined if not registered. */
export function getTool(name: string): ToolDef | undefined {
  return toolRegistry.get(name);
}

/** List all registered tool names. */
export function listToolNames(): string[] {
  return [...toolRegistry.keys()];
}

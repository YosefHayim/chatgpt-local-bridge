import { readFile, stat } from "node:fs/promises";
import { ensureInsideRepo, trimOutput } from "../sandbox.ts";
import type { ToolDef } from "../../types/types.ts";

/** Read a repo file with line numbers. */
async function readFileTool(
  args: Record<string, unknown>,
): Promise<{ ok: boolean; output: string }> {
  const path = String(args.path);
  const startLine = Number(args.start_line ?? 1);
  const maxLines = Number(args.max_lines ?? 200);
  const repoRoot = String(args._repoRoot);

  const safePath = ensureInsideRepo(path, repoRoot);

  try {
    const s = await stat(safePath);
    if (!s.isFile()) {
      return { ok: false, output: `Not a file: ${path}` };
    }
  } catch {
    return { ok: false, output: `File not found: ${path}` };
  }

  const raw = await readFile(safePath, "utf-8");
  const lines = raw.split("\n");

  const start = Math.max(startLine - 1, 0);
  const end = Math.min(start + maxLines, lines.length);

  const numbered = lines
    .slice(start, end)
    .map((line, i) => `${start + i + 1}: ${line}`)
    .join("\n");

  const header = `path: ${path}\nlines: ${start + 1}-${end} of ${lines.length}\n`;
  return { ok: true, output: trimOutput(header + numbered) };
}

export const readFileDef: ToolDef = {
  name: "read_file",
  description: "Read a repo file with line numbers. Use after grep_code before proposing edits.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repo-relative file path." },
      start_line: { type: "number", description: "1-based line number to start reading." },
      max_lines: { type: "number", description: "Maximum number of lines to read." },
    },
    required: ["path"],
  },
  handler: readFileTool,
};

import { spawn } from "node:child_process";
import { trimOutput } from "../sandbox.ts";
import type { ToolDef } from "../../types/types.ts";

/** Run a subprocess and capture stdout/stderr. No shell involved. */
function run(args: string[], cwd: string, timeout = 30_000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(args[0], args.slice(1), { cwd });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { proc.kill(); }, timeout);

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    proc.on("error", (err) => { clearTimeout(timer); resolve({ stdout, stderr: err.message, code: 1 }); });
  });
}

/** Show the current git diff and diff stat. */
async function gitDiff(
  args: Record<string, unknown>,
): Promise<{ ok: boolean; output: string }> {
  const repoRoot = String(args._repoRoot);

  const [stat, diff] = await Promise.all([
    run(["git", "diff", "--stat"], repoRoot, 10_000),
    run(["git", "diff"], repoRoot, 20_000),
  ]);

  const combined = `--- stat ---\n${stat.stdout}\n\n--- diff ---\n${diff.stdout}`;
  return { ok: true, output: trimOutput(combined) };
}

export const gitDiffTool: ToolDef = {
  name: "git_diff",
  description: "Show the current git diff and diff stat for the working tree.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: gitDiff,
};

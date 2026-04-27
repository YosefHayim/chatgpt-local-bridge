import { spawn } from "node:child_process";
import { ensureInsideRepo, trimOutput } from "../sandbox.ts";
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

/** Grep the repository using ripgrep with line numbers. */
async function grepCode(
  args: Record<string, unknown>,
): Promise<{ ok: boolean; output: string }> {
  const pattern = String(args.pattern);
  const path = String(args.path);
  const glob = args.glob ? String(args.glob) : undefined;
  const repoRoot = String(args._repoRoot);

  const safePath = ensureInsideRepo(path, repoRoot);

  const rgArgs = [
    "rg",
    "--line-number",
    "--hidden",
    "--glob", "!.git",
    "--glob", "!node_modules",
    "--glob", "!dist",
    "--glob", "!build",
  ];

  if (glob) {
    rgArgs.push("--glob", glob);
  }

  rgArgs.push(pattern, safePath);

  const result = await run(rgArgs, repoRoot, 20_000);

  // ripgrep exits with code 1 when no matches — that's not an error
  if (result.code === 1) {
    return { ok: true, output: "" };
  }

  if (result.code !== 0) {
    return { ok: false, output: result.stderr };
  }

  return { ok: true, output: trimOutput(result.stdout) };
}

export const grepTool: ToolDef = {
  name: "grep_code",
  description:
    "Search the repository using ripgrep. Locate symbols, imports, routes, tests, configs, and references.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "The ripgrep search pattern." },
      path: { type: "string", description: "Repo-relative path to search." },
      glob: { type: "string", description: "Optional ripgrep glob, e.g. '*.ts'." },
    },
    required: ["pattern", "path"],
  },
  handler: grepCode,
};

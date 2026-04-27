import { spawn } from "node:child_process";
import { isAllowedTestCommand, trimOutput } from "../sandbox.ts";
import type { ToolDef } from "../../types/types.ts";

/** Run a subprocess and capture stdout/stderr. No shell involved. */
function run(args: string[], cwd: string, timeout = 120_000): Promise<{ stdout: string; stderr: string; code: number | null }> {
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

/** Run an allowed project test command. */
async function runTests(
  args: Record<string, unknown>,
): Promise<{ ok: boolean; output: string }> {
  const command = String(args.command);
  const repoRoot = String(args._repoRoot);

  const parts = command.trim().split(/\s+/);
  if (parts.length === 0) {
    return { ok: false, output: "Empty command." };
  }

  if (!isAllowedTestCommand(parts)) {
    return {
      ok: false,
      output: `Command not allowlisted: ${command}\nAllowed: npm test, pnpm test, pytest, go test ./..., cargo test, make test`,
    };
  }

  const result = await run(parts, repoRoot, 120_000);

  const combined = result.stdout + "\n" + result.stderr;
  return {
    ok: result.code === 0,
    output: trimOutput(combined.trim()),
  };
}

export const runTestsTool: ToolDef = {
  name: "run_tests",
  description: "Run an allowed project test command (npm test, pytest, go test, etc.).",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Allowed test command, e.g. 'npm test' or 'pytest'.",
      },
    },
    required: ["command"],
  },
  handler: runTests,
};

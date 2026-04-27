import { spawn } from "node:child_process";
import { ensureInsideRepo, trimOutput } from "../sandbox.ts";
import type { ToolDef } from "../../types/types.ts";

/** Run a subprocess and capture stdout/stderr. No shell involved. */
function runWithStdin(
  args: string[],
  cwd: string,
  stdin: string,
  timeout = 30_000,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(args[0], args.slice(1), { cwd });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { proc.kill(); }, timeout);

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    proc.on("error", (err) => { clearTimeout(timer); resolve({ stdout, stderr: err.message, code: 1 }); });

    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

/** Apply a unified diff patch via git apply. */
async function applyPatch(
  args: Record<string, unknown>,
): Promise<{ ok: boolean; output: string }> {
  const patch = String(args.patch);
  const repoRoot = String(args._repoRoot);
  ensureInsideRepo(".", repoRoot);

  // Dry-run check first
  const check = await runWithStdin(["git", "apply", "--check", "-"], repoRoot, patch, 20_000);
  if (check.code !== 0) {
    return { ok: false, output: `Patch check failed:\n${trimOutput(check.stderr || check.stdout)}` };
  }

  // Apply for real
  const applied = await runWithStdin(["git", "apply", "-"], repoRoot, patch, 20_000);
  if (applied.code !== 0) {
    return { ok: false, output: `Patch apply failed:\n${trimOutput(applied.stderr || applied.stdout)}` };
  }

  return { ok: true, output: "Patch applied successfully." };
}

export const applyPatchTool: ToolDef = {
  name: "apply_patch",
  description:
    "Apply a unified diff patch to the repository. Use only after reading the relevant files.",
  parameters: {
    type: "object",
    properties: {
      patch: { type: "string", description: "Unified diff patch compatible with git apply." },
    },
    required: ["patch"],
  },
  handler: applyPatch,
};

# PROJECT.md — ai-browser-bridge

Purpose and direction. Read this to understand *why* the project exists and where
it's going; read `CONTEXT.md` for how it's shaped, `LANGUAGE.md` for the words,
and `CODE-STYLE.md` for how code is written.

## What it is

A terminal tool that drives a **real ChatGPT or Gemini browser conversation** from
the shell, and gives ChatGPT a narrow, sandboxed set of local repo tools over MCP
— `grep`, `read`, `apply_patch`, `run_tests`, `git_diff` — **without ever handing
it a shell**.

## Who it's for

Developers who want ChatGPT/Gemini at their best (real account state, model picker,
message editing, regeneration, history) while staying in a terminal coding workflow
(files, tests, diffs, patches inspected and changed directly). Local-first, single
user, one repo at a time.

## Why it exists

The browser is where the provider is strongest; the terminal is where coding is
strongest. Nothing bridged the two without either scraping an API or granting raw
shell access. This connects them: a terminal prompt drives the existing browser
session, and the model reaches into the current repo only through **validated MCP
tools** — never arbitrary commands.

## Direction

- Keep the **browser conversation as the source of truth**; the Bridge drives, it
  never replaces the provider UI.
- Widen provider coverage behind the fixed `BrowserProvider` contract (ChatGPT and
  Gemini today).
- Keep the tool surface **narrow and sandboxed** — new capabilities are added as
  validated MCP handlers, not shell.
- Sharpen the dual-mode CLI (interactive TUI + scriptable headless) so both stay
  first-class and share one core.

## Non-goals

- Not a hosted, multi-user, or deployed service — local-first by design.
- Not an API client — it drives the real web UI on purpose.
- Not a general shell for the model — every file op goes through the Sandbox.

## What success looks like

A developer signs in once per repo, then drives ChatGPT/Gemini from the terminal;
patches land through checkpointed, validated tools; sessions and transcripts stay
recorded under `.bridge/` and never leak; the same commands work interactively and
in scripts.

## Constraints

- **macOS-only today** (hardcoded Chrome path; `pbcopy`/`lsof` helpers).
- Requires Google Chrome and Node ≥ 20 (`pnpm@10.14.0`).
- ChatGPT MCP tools need `cloudflared` (optional; the TUI runs without it).
- Provider selectors break when the web UI changes — fixes are localized to the
  browser layer (`src/features/providers/*`).
- Context usage is an **estimate**; the browser exposes no exact token counts.

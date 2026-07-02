# CLI command surface and the dual-mode "interactive front door"

`bridge` is both a human TUI and a scriptable tool. A deep audit confirmed the
routing is structural (which Commander action fires), the two modes share one core,
and there was one real gap: a bare `bridge` in a non-TTY still tried to mount Ink.

## Command surface

| Verb | Purpose | Key flags |
|------|---------|-----------|
| `bridge` (bare) | Interactive Ink TUI | `-r/--repo`, `-p/--port`, `--provider`, `--no-browser` |
| `bridge ask <prompt…>` | One-shot headless send-and-print | `--json --tools --fresh --conversation --model --timeout --attach` |
| `bridge download` | Conversation attachments (ChatGPT) | `--conversation --out --id --scan --json` |
| `bridge sessions` | List stored sessions as JSON | — |
| `bridge login` | One-time browser sign-in | `--repo --provider` |
| `bridge stop` | Kill the warm Chrome on the debug port | — |

In-TUI: 42 built-in slash commands via one registry (metadata arrays composed +
`executeCommand`), plus custom markdown commands loaded at dispatch from
`.bridge/commands/` and `~/.ai-browser-bridge/commands/`.

## Decision — the dual-mode contract

1. **Bare + TTY → menu (Ink TUI); flags or non-TTY → defer and never hang.** Bare
   `bridge` in a non-TTY prints a one-line stderr hint and `exit(1)` — it never
   mounts Ink into a pipe. `runTui` awaits `app.waitUntilExit()` so Ink owns its
   lifecycle and restores the terminal on crash.
2. **Both routes call the same core** — `startEngine` + `engine.ask`. No send logic
   is duplicated between headless and TUI.
3. **Headless is stdout-clean** — `console.log`→stderr; machine-readable payload on
   stdout; every headless path ends in an explicit `process.exit`.
4. **Slash commands and headless subcommands share the underlying functions.**
5. Signal handlers use `process.once`.

## Audit fix-list (tracked)

- **High:** TTY guard in `runTui`; `await app.waitUntilExit()`.
- **Medium:** surface orchestrator `error` events in the TUI message pane (currently
  dropped); fix the single-slot prompt queue (a 2nd queued prompt silently clobbers
  the 1st).
- **Low:** remove dead `downloadConversationIdFromPage`; reconcile `/statusline` vs
  identical `/status`; show aliases (`/work /retry /open`) in autocomplete; guard
  `/copy` (pbcopy) off-macOS.

## Consequences

Scripting `bridge` can no longer produce the cryptic Ink raw-mode crash; the
contract is documented and codified as CLI rules in `CODE-STYLE.md`.

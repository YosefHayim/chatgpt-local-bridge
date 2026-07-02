# AGENTS.md — ai-browser-bridge

Terminal CLI that drives ChatGPT or Gemini in Chrome and exposes sandboxed local repo tools over MCP (ChatGPT only).

## Read order (humans, no AI required)

1. `src/main.ts`
2. `src/features/terminal/create-cli.factory.ts` → `cli-runner.class.ts`
3. `src/features/bridge/create-engine.factory.ts` → `bridge-engine.class.ts`
4. `src/features/bridge/orchestrator.class.ts`
5. `src/features/providers/create-provider.factory.ts` → `chatgpt-page.class.ts` or `gemini-page.class.ts`
6. `src/features/tools/create-mcp-server.factory.ts` → `mcp-server.class.ts`

## Feature ownership

| Feature | Owns | Main class |
|---------|------|------------|
| `bridge` | Engine start, orchestrator | `BridgeEngine`, `Orchestrator` |
| `providers/chatgpt` | ChatGPT DOM + MCP connector UI | `ChatGptPage` |
| `providers/gemini` | Gemini DOM | `GeminiPage` |
| `providers/chrome` | CDP attach, Chrome profiles | `BrowserManager` |
| `tools` | MCP server, sandbox, handlers | `McpServer` |
| `tunnel` | cloudflared | `CloudflareTunnel` |
| `terminal` | CLI, headless commands | `CliRunner` (+ `tui/` React components) |
| `store` | Sessions, checkpoints, logs | `SessionStore` |
| `domain` | Pure types, permissions, model catalog | (no classes) |
| `user-config` | `~/.ai-browser-bridge/` readers | `UserConfig` |

Cross-feature imports go through **factories only** (`create-*.factory.ts`) — never deep-import another feature's internals or its `*.class.ts`. Enforced by `scripts/check-boundaries.mjs`.

## Conventions

<!-- rules digest — full guide in CODE-STYLE.md; edit there -->

- **One class per `*.class.ts`**, `PascalCase`, named after the file.
- **Thin facades:** ≤5 **public** methods (CI-enforced via `check-class-api`), each delegating to module-level `function` helpers. **Exempt:** `BrowserProvider` implementers (~17-method contract) and `Orchestrator`. Private logic lives at module scope, not as private methods.
- **JSDoc** — single line, no `@param`/`@returns` — on every **public** method (CI-enforced via `check-jsdoc`).
- **Named exports only**, no default exports. `function` declarations for module helpers; arrows only inline.
- **No `any`** — `unknown` + type guards. `strict` + `noUncheckedIndexedAccess`. One `PermissionMode` (from `PERMISSION_MODES`).
- **Errors:** MCP handlers return `{ ok, output }`; internals throw; one catch-net per boundary. Non-critical I/O is fire-and-forget (`await x.catch(() => {})`).
- **Static config** only in `*.config.ts` — `const` objects/arrays, no functions, no I/O. Provider selectors/DOM live inside the provider class file.
- **Big provider/CLI classes are legitimate hand-edited source** — no merge/concat build, no file/function-size rule.
- **Formatting** is Biome (`pnpm format`) — never hand-argue style.

## Verification

```bash
pnpm verify   # biome ci + typecheck + test + build + check:class-api + check:jsdoc + check:boundaries
```

## Safety

- All file ops through sandbox validation
- No raw shell in MCP tools
- Do not commit unless explicitly asked
- TypeScript strict (+ `noUncheckedIndexedAccess`), no `any`
- No cross-feature `*.class.ts` imports (`check-boundaries`)

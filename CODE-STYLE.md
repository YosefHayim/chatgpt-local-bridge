# CODE-STYLE.md

How code is written in ai-browser-bridge. **Prescriptive** (how to write), not
descriptive (what exists — that's `AGENTS.md`). The load-bearing rules are mirrored
into the `AGENTS.md` `## Conventions` digest; **this file is the source — edit
here.** `deslop` reads this file to enforce style per-diff.

## Stack & framework practices

For framework/library best-practices, follow these skills (don't restate them here):

- **Claude API / Anthropic SDK work** → `claude-api`
- This file covers only what's specific to THIS project on top of those.

Formatting is owned by **Biome** (`biome.json`) — never hand-argue quotes/semis/
width; run `pnpm format`. See `docs/adr/0002-adopt-biome-and-unified-ci.md`.

## Rules

Load-bearing, project-specific rules. Each is a one-liner plus a real before/after.

### Cross-feature access goes through a factory — no cross-feature `*.class.ts` imports

Within a feature, import its files directly. **Across** features (`src/features/*`),
import only through that feature's `create-*.factory.ts` (or its declared public
module). Pure re-export barrels are deleted. Enforced by `scripts/check-boundaries.mjs`.

```ts
// before  (src/features/terminal/cli-runner.class.ts:17-20)
import { BridgeEngine } from "../bridge/bridge-engine.class.ts";            // ✗ cross-feature .class.ts
import { extractAllMessages, loadManifest }
  from "../providers/chatgpt/chatgpt-page.class.ts";                       // ✗ deep provider import
import { BrowserManager } from "../providers/chrome/browser-manager.ts";   // ✗ pure barrel
// after
import { startEngine } from "../bridge/create-engine.factory.ts";         // ✓ factory front door
import { loadManifest } from "../store/attachments.ts";                    // ✓ single-job home
import { getBrowserProvider } from "../providers/create-provider.factory.ts"; // ✓
```
_Why:_ pureness, single jobs, no crossings — each file has one owner and one reason to change.

### Big facade classes are legitimate — the `.class.ts` is hand-edited source

Provider (`ChatGptPage`, `GeminiPage`) and CLI (`CliRunner`) classes are large by
nature. They are the real source of truth — there is **no** merge/concat build and
**no** file- or function-size rule. Keep them sectioned; delegate to module-level helpers.

```ts
// there is NO merge step. Do not add scripts/merge-*.mjs back; editing the
// .class.ts directly is correct. `// --- actions/… ---` comments are not markers.
```
_Why:_ the abandoned split-and-merge left dangerous dormant generators; the monolith won.

### Layered error contract — boundaries return, internals throw

MCP tool handlers **return** `{ ok, output }` and never throw. Internals **throw**
`Error`. Exactly one catch-net per boundary converts throws → results. A custom
`Error` subclass only when a caller branches on its type; otherwise `throw new Error(msg)`.

```ts
// boundary — src/features/tools/mcp-server.class.ts (invokeToolHandler)
try { return await handler(args); }
catch (e) { return { ok: false, output: e.message }; }   // catch-net
// internal — throw, never a sentinel
if (!isInsideRepo(absPath, repoRoot)) throw new Error(`Path escapes repo root: ${absPath}`);
```
_Why:_ callers of Tools get data; internals fail loudly; the boundary is the single seam.

### Non-critical I/O is fire-and-forget

Logging, session-event persistence, config saves, and hook runs never block or
surface failures.

```ts
// src/features/bridge/bridge-engine.class.ts:189,266
appendSessionEvent(...).catch(() => {});
saveConfig(input.config).catch(() => {});
```
_Why:_ a failed log write must not derail a live browser turn.

### `function` declarations for module helpers; arrows only inline

No module-level `const f = () =>`. Class methods are methods. React components and
hooks are `function` declarations; arrows appear only as callbacks / `useCallback` /
`useMemo` bodies.

```ts
// before (never)                         // after
const resolveEngineLog = (o) => {...};    function resolveEngineLog(options: StartEngineOptions) {...}
```

### Named exports only — zero default exports

Every export is named (`export class/function/const/type`). Re-export via named
`export { … }` blocks, not a default.

### No `any` — `unknown` + type guards at boundaries

`tsconfig` is `strict` with `noUncheckedIndexedAccess`. Untyped input is `unknown`,
narrowed by an `is*` guard. Casts (`as`) are sparse and purposeful.

```ts
// after
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
```

### Thin service classes — ≤5 public methods, delegate to module helpers

Service classes are facades: ≤5 public methods (enforced by
`scripts/check-class-api.mjs`), each delegating to a module-level `function`.
Private helpers live at module scope, not as private methods. **Exempt:** classes
implementing `BrowserProvider` (fixed ~17-method contract) and `Orchestrator`.
Every public method gets a single-line `/** … */` JSDoc (no `@param`/`@returns`),
enforced by `scripts/check-jsdoc.mjs`.

### One canonical `PermissionMode`

The `read-only | ask | auto` type is `PermissionMode`, derived from
`PERMISSION_MODES` in `domain/permissions.ts`. Never redeclare it as a literal union.

```ts
// before  (domain/types/bridge.types.ts:5)   // after
export type BridgePermissionMode = "read-only" | "ask" | "auto";  // deleted
// use PermissionMode = (typeof PERMISSION_MODES)[number] everywhere
```

### File & naming conventions

- Suffixes: `*.class.ts` (one class) · `*.factory.ts` (`create*`/`start*`) ·
  `*.types.ts` (types only) · `*.config.ts` (static `const`, no I/O) ·
  `*.profiles.ts` (data arrays) · `*.helpers.ts` · `use-*.ts` (hooks) ·
  `PascalCase.tsx` (components).
- Helper files are kebab-case, **except** helpers named after a `PascalCase`
  component they sit beside (`StatusBar.helpers.ts` ↔ `StatusBar.tsx`).
- Verb prefixes: `is/has/get/build/resolve/load/create/read/capture/parse/normalize/
  find/wait/ensure/format`. Type suffixes: `*Input/*Options/*Result/*Context/*State/*Record`.
- Directories kebab-case; classes/types `PascalCase`; module constants `SCREAMING_SNAKE_CASE`.

### Tests

- `*.test.ts` only (no `.spec.ts`), mirroring `src/` under `tests/features/**`.
- `import { describe, it, expect } from "vitest"` explicitly (no globals). `describe`
  names a symbol; `it` names the scenario condition in plain English.
- Real FS tests use `mkdtemp` + `chdir` in `beforeEach`/`afterEach`. Browser surfaces
  use `{} as unknown as Page` fakes; shared fakes live in `tests/support/`.

## Recipes

### Add a Tool (MCP)
1. Define the handler in `tools/` returning `{ ok, output }`; validate params with a Zod schema.
2. Confine every path with the Sandbox (`isInsideRepo`) before any I/O.
3. Register it on the MCP server; gate it behind the right `PermissionMode`.
4. Test the pure handler with literal inputs; no real browser.

### Add a CLI command
- **Headless subcommand:** register in `terminal/register-cli.ts`; the action must
  redirect `console.log`→stderr, call the shared `startEngine`/`engine.ask` core,
  and end with an explicit `process.exit`. Never prompt in a non-TTY.
- **TUI slash command:** add to the metadata array + the `executeCommand` registry
  in `cli-runner.class.ts`; both modes must call the same underlying function.
- Bare `bridge` opens the TUI in a TTY and defers (never mounts Ink) when non-TTY.

### Add a feature
Create `src/features/<name>/`, expose a `create-<name>.factory.ts` as its only
cross-feature entry, keep types in `*.types.ts`, static config in `*.config.ts`.

## Exemplars

Write new code like these:
- `src/features/bridge/orchestrator.class.ts` — thin facade delegating to module helpers.
- `src/features/domain/permissions.ts` — pure logic, derived types, guards.
- `src/features/tools/mcp-server.class.ts` — the `{ ok, output }` boundary + Sandbox.
- `src/features/terminal/tui/use-composer.ts` — vertically composed hooks.

## Never

- Add a cross-feature `*.class.ts` import, or a pure re-export barrel.
- Re-add `scripts/merge-*.mjs`, `fix-imports.mjs`, or a file/function-size check.
- `any`, default exports, or a module-level arrow function.
- Throw out of an MCP handler, or use a thrown-error function as a boolean.
- Prompt (Ink or otherwise) in a non-TTY / headless path.

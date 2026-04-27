# AGENTS.md

## Project: chatgpt-local-bridge

Terminal CLI that bridges ChatGPT browser conversations with local machine tools via MCP.

## Architecture

- **CLI layer** (Ink/React): terminal UI with @file mentions and /commands
- **Browser layer** (Playwright): injects prompts into ChatGPT, captures responses
- **MCP layer** (MCP SDK): exposes local tools (grep/read/patch/test/diff) to ChatGPT
- **Tunnel layer** (Cloudflare): bridges ChatGPT to local MCP server over HTTPS

## Rules

- Prefer minimal diffs. Follow existing patterns.
- Do not commit unless explicitly asked.
- TypeScript strict mode. No `any` types.
- All file operations must pass through sandbox validation.
- Test commands are allowlisted only — no raw shell exposure.
- Run the smallest relevant test first, then broader tests if needed.
- Never add new production dependencies without explaining why.
- After implementation, summarize: changed files, tests run, remaining risks.

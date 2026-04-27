import { render } from "ink";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import React from "react";
import { BridgeApp } from "../src/cli/app.tsx";
import { loadConfig } from "../src/core/config.ts";
import { Orchestrator } from "../src/core/orchestrator.ts";
import { ContextCounter } from "../src/core/context-counter.ts";
import { startMcpServer } from "../src/mcp/server.ts";
import { CloudflareTunnel } from "../src/tunnel/cloudflare.ts";
import { BrowserManager } from "../src/browser/manager.ts";
import type { Message } from "../src/types/types.ts";

async function main() {
  const { values } = parseArgs({
    options: {
      repo: { type: "string", short: "r" },
      port: { type: "string", short: "p" },
      "browser-profile": { type: "string", short: "b" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`chatgpt-local-bridge — Terminal CLI that bridges ChatGPT with local tools

Usage: bridge [options]

Options:
  -r, --repo <path>           Path to the target repository (default: cwd)
  -p, --port <number>         MCP server port (default: 8765)
  -b, --browser-profile <path> Chrome profile path for ChatGPT login
  -h, --help                  Show this help
`);
    process.exit(0);
  }

  const config = await loadConfig({
    repoPath: values.repo ? resolve(values.repo) : process.cwd(),
    mcpPort: values.port ? Number(values.port) : undefined,
    browserProfilePath: values["browser-profile"]
      ? resolve(values["browser-profile"])
      : undefined,
  });

  console.log("Starting chatgpt-local-bridge...");
  console.log(`  Repo: ${config.repoPath}`);
  console.log(`  MCP port: ${config.mcpPort}`);

  // Start MCP server
  const mcpServer = await startMcpServer(config.repoPath, config.mcpPort);
  console.log(`  MCP server: ${mcpServer.url}`);

  // Start Cloudflare tunnel
  let tunnelUrl = "";
  try {
    const tunnel = new CloudflareTunnel();
    tunnelUrl = await tunnel.start(config.mcpPort);
    config.tunnelUrl = tunnelUrl;
    console.log(`  Tunnel: ${tunnelUrl}`);
    console.log(`\n  Register this URL as an MCP connector in ChatGPT settings.\n`);
  } catch (err) {
    console.warn("  Tunnel: failed to start (cloudflared not installed?)");
    console.warn("  MCP tools will only work if ChatGPT can reach localhost directly.");
  }

  // Start browser
  const browser = new BrowserManager();
  try {
    await browser.launch(config.browserProfilePath);
    console.log("  Browser: launched, navigating to ChatGPT...");
  } catch (err) {
    console.warn("  Browser: failed to launch. Browser sync disabled.");
    console.warn(`  ${(err instanceof Error ? err.message : String(err))}`);
  }

  // Wire up orchestrator
  const orchestrator = new Orchestrator(config);
  const counter = new ContextCounter(config.contextLimit);
  const messages: Message[] = [];

  orchestrator.on((event) => {
    if (event.type === "message") {
      messages.push(event.message);
      counter.add(event.message);
    }
  });

  await orchestrator.start();

  // Render terminal UI
  const sendMessage = async (content: string) => {
    await orchestrator.sendPrompt(content);
  };

  render(
    React.createElement(BridgeApp, {
      config,
      sendMessage,
      messages,
      counter,
    }),
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

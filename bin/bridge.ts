#!/usr/bin/env node
import { Command } from "commander";
import inquirer, { type DistinctQuestion } from "inquirer";
import { render } from "ink";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import React from "react";
import { BridgeApp } from "../src/cli/app.tsx";
import { loadConfig, saveConfig } from "../src/core/config.ts";
import { Orchestrator } from "../src/core/orchestrator.ts";
import { ContextCounter } from "../src/core/context-counter.ts";
import { startMcpServer } from "../src/mcp/server.ts";
import { CloudflareTunnel } from "../src/tunnel/cloudflare.ts";
import { BrowserManager } from "../src/browser/manager.ts";
import type { Message } from "../src/types/types.ts";

interface SetupAnswers {
  repoPath: string;
  mcpPort: number;
  useBrowser: boolean;
  browserProfilePath?: string;
}

/** Interactive first-run / reconfigure flow. */
async function interactiveSetup(
  savedRepo: string,
  savedPort: number,
  savedProfile?: string,
): Promise<{ repoPath: string; mcpPort: number; browserProfilePath?: string }> {
  const answers = await inquirer.prompt<SetupAnswers>(
    [
      {
        type: "input",
        name: "repoPath",
        message: "Path to the target repository:",
        default: savedRepo,
        validate: (v: string) => {
          if (!v.trim()) return "Path is required";
          if (!existsSync(resolve(v))) return `Path does not exist: ${resolve(v)}`;
          return true;
        },
      },
      {
        type: "number",
        name: "mcpPort",
        message: "MCP server port:",
        default: savedPort,
      },
      {
        type: "confirm",
        name: "useBrowser",
        message: "Connect to a Chrome browser profile for ChatGPT?",
        default: !!savedProfile,
      },
      {
        type: "input",
        name: "browserProfilePath",
        message: "Chrome profile directory path:",
        default: savedProfile ?? "~/Library/Application Support/Google/Chrome",
        when: (ans: SetupAnswers) => ans.useBrowser,
      },
    ] as DistinctQuestion[],
  );

  return {
    repoPath: resolve(answers.repoPath),
    mcpPort: answers.mcpPort,
    browserProfilePath: answers.useBrowser
      ? resolve(answers.browserProfilePath ?? "")
      : undefined,
  };
}

async function runBridge(opts: {
  repo?: string;
  port?: string;
  browserProfile?: string;
  yes: boolean;
}): Promise<void> {
  const saved = await loadConfig();

  let repoPath: string;
  let mcpPort: number;
  let browserProfilePath: string | undefined;

  if (opts.repo) {
    repoPath = resolve(opts.repo);
    mcpPort = opts.port ? Number(opts.port) : saved.mcpPort;
    browserProfilePath = opts.browserProfile
      ? resolve(opts.browserProfile)
      : saved.browserProfilePath;
  } else if (opts.yes) {
    repoPath = saved.repoPath;
    mcpPort = saved.mcpPort;
    browserProfilePath = saved.browserProfilePath;
  } else {
    const setup = await interactiveSetup(
      saved.repoPath,
      saved.mcpPort,
      saved.browserProfilePath,
    );
    repoPath = setup.repoPath;
    mcpPort = setup.mcpPort;
    browserProfilePath = setup.browserProfilePath;
  }

  const config = await loadConfig({ repoPath, mcpPort, browserProfilePath });
  await saveConfig(config);

  console.log("\nStarting chatgpt-local-bridge...");
  console.log(`  Repo:   ${config.repoPath}`);
  console.log(`  Port:   ${config.mcpPort}`);

  const mcpServer = await startMcpServer(config.repoPath, config.mcpPort);
  console.log(`  MCP:    ${mcpServer.url}`);

  let tunnelUrl = "";
  try {
    const tunnel = new CloudflareTunnel();
    tunnelUrl = await tunnel.start(config.mcpPort);
    config.tunnelUrl = tunnelUrl;
    console.log(`  Tunnel: ${tunnelUrl}`);
    console.log("\n  Register this URL as an MCP connector in ChatGPT settings.\n");
  } catch (err) {
    console.warn("  Tunnel: failed to start (cloudflared not installed?)");
    console.warn("  MCP tools will only work if ChatGPT can reach localhost directly.");
  }

  const browser = new BrowserManager();
  try {
    await browser.launch(config.browserProfilePath);
    console.log("  Browser: launched, navigating to ChatGPT...");
  } catch (err) {
    console.warn("  Browser: failed to launch. Browser sync disabled.");
    console.warn(`  ${(err instanceof Error ? err.message : String(err))}`);
  }

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

const program = new Command();

program
  .name("bridge")
  .description("Terminal CLI that bridges ChatGPT with local tools via MCP")
  .version("0.1.0")
  .option("-r, --repo <path>", "Path to the target repository")
  .option("-p, --port <number>", "MCP server port")
  .option("-b, --browser-profile <path>", "Chrome profile path for ChatGPT login")
  .option("-y, --yes", "Skip interactive prompts, use saved defaults")
  .action(runBridge);

program.parse();

import { execFile } from "node:child_process";
import { BrowserManager } from "../browser/manager.ts";
import { CloudflareTunnel } from "../tunnel/cloudflare.ts";
import { startMcpServer, type McpToolAction, type McpServerHandle } from "../mcp/server.ts";
import { Orchestrator } from "./orchestrator.ts";
import { ContextCounter } from "./context-counter.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { loadHooksConfig, runHooks, type LoadedHooksConfig } from "./hooks.ts";
import { normalizePermissionMode, type PermissionMode } from "./permissions.ts";
import { resolveFileMentions } from "./file-resolver.ts";
import { appendBridgeLog } from "./logging.ts";
import { appendSessionEvent, createSession, updateSession } from "./session-store.ts";
import type { BridgeConfig, Message } from "../types/types.ts";

const DEFAULT_PORT = 8765;

/**
 * Knobs for {@link startEngine}. The two frontends (Ink TUI and the headless
 * `bridge ask` command) differ only in these flags — the wiring underneath is
 * identical, which is the whole point of extracting the engine.
 */
export interface StartEngineOptions {
  /** Target repository the MCP tools operate inside. Defaults to the saved/cwd repo. */
  repoPath?: string;
  /** MCP server port. Defaults to the saved port or 8765. */
  mcpPort?: number;
  /** Launch/attach Chrome. The TUI always wants this; headless `sessions` does not. */
  withBrowser?: boolean;
  /**
   * Start the local MCP server. Defaults to true. A plain headless `ask` sets this
   * false so it never binds the MCP port (which a running TUI may already hold).
   */
  withTools?: boolean;
  /**
   * Start the Cloudflare tunnel + sync the ChatGPT connector so ChatGPT can call
   * local tools. Defaults to `withTools` (a tunnel without the MCP server is useless).
   */
  withTunnel?: boolean;
  /**
   * Diagnostics sink. Defaults to stderr so that a headless command can keep
   * stdout reserved for machine-readable JSON.
   */
  log?: (line: string) => void;
}

/**
 * A fully wired, running bridge: browser + MCP server + orchestrator + session,
 * with message persistence and context counting already attached.
 *
 * Created by {@link startEngine} and consumed by both frontends. Callers send
 * prompts with {@link Engine.ask} and tear down with {@link Engine.shutdown}.
 */
export interface Engine {
  config: BridgeConfig;
  orchestrator: Orchestrator;
  counter: ContextCounter;
  browser: BrowserManager | null;
  /** Running MCP server, or null when started without tools. */
  mcpServer: McpServerHandle | null;
  tunnel: CloudflareTunnel | null;
  /** Public connector URL (`<tunnel>/mcp`) or "" when no tunnel is running. */
  connectorUrl: string;
  hooksConfig: LoadedHooksConfig;
  /** Tool-call actions recorded this run (used for the status line counter). */
  toolActions: McpToolAction[];
  /** Current git branch of the repo, if any. */
  branch?: string;
  getSessionId(): string;
  setSessionId(id: string): void;
  getPermissionMode(): PermissionMode;
  setPermissionMode(mode: PermissionMode): void;
  /**
   * Resolve `@file` mentions, run the UserPromptSubmit hook, send the prompt
   * through ChatGPT, and return the captured assistant reply (null on failure).
   * Persistence (logs + session events + context counting) happens via the
   * engine's own orchestrator listener, so both frontends get it for free.
   */
  ask(content: string): Promise<Message | null>;
  /** Stop the MCP server and tunnel. Pass `closeBrowser` to also close Chrome. */
  shutdown(opts?: { closeBrowser?: boolean }): Promise<void>;
}

/** Build `<tunnelUrl>/mcp`, the URL ChatGPT's connector points at. */
export function mcpConnectorUrl(tunnelUrl: string): string {
  return `${tunnelUrl.replace(/\/+$/, "")}/mcp`;
}

/**
 * Wire up and start a bridge engine: config, MCP server, optional tunnel and
 * browser, orchestrator, and a fresh session. Diagnostics are written through
 * `options.log` (stderr by default).
 */
export async function startEngine(options: StartEngineOptions = {}): Promise<Engine> {
  const log = options.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  const withTools = options.withTools ?? true;
  const withTunnel = options.withTunnel ?? withTools;
  const saved = await loadConfig();

  const repoPath = options.repoPath ?? saved.repoPath;
  const mcpPort = options.mcpPort ?? saved.mcpPort ?? DEFAULT_PORT;

  const config = await loadConfig({ repoPath, mcpPort, tunnelUrl: undefined });
  config.permissionMode = normalizePermissionMode(config.permissionMode ?? "auto");
  await saveConfig(config);

  let permissionMode = config.permissionMode;
  const hooksConfig = await loadHooksConfig({ repoRoot: config.repoPath });
  for (const error of hooksConfig.errors) log(`Hooks warning: ${error}`);

  const branch = await currentGitBranch(config.repoPath);
  const session = await createSession({
    repoPath: config.repoPath,
    model: config.model ?? null,
    contextLimit: config.contextLimit,
    tunnelUrl: config.tunnelUrl ?? null,
  });
  let sessionId = session.metadata.id;

  const toolActions: McpToolAction[] = [];
  const recordToolAction = async (action: McpToolAction): Promise<void> => {
    toolActions.push(action);
    await appendSessionEvent(sessionId, {
      type: "action",
      name: action.name,
      status: action.status,
      content: action.data?.error ? String(action.data.error) : undefined,
      data: action.data,
    }).catch(() => {});
  };

  await runHooks("SessionStart", hooksConfig.hooks).catch(() => []);

  let mcpServer: McpServerHandle | null = null;
  if (withTools) {
    mcpServer = await startMcpServer(config.repoPath, config.mcpPort, {
      getPermissionMode: () => permissionMode,
      hooks: hooksConfig.hooks,
      onToolAction: recordToolAction,
    });
    log(`MCP:     ${mcpServer.url}`);
  }

  const orchestrator = new Orchestrator(config);
  const counter = new ContextCounter(config.contextLimit, config.model);

  // Single source of truth for persistence + context counting. Both frontends
  // attach their own listeners on top for view concerns; this one owns state.
  orchestrator.on((event) => {
    if (event.type === "message") {
      counter.add(event.message);
      appendBridgeLog({
        repoPath: config.repoPath,
        type: `chatgpt_${event.message.role}_message`,
        data: { content: event.message.content },
      }).catch(() => {});
      appendSessionEvent(sessionId, {
        type: "message",
        role: event.message.role,
        content: event.message.content,
        data: { messageId: event.message.id },
      }).catch(() => {});
    }
    if (event.type === "conversation_synced") {
      counter.reset();
      for (const message of event.messages) counter.add(message);
    }
    if (event.type === "reset") {
      counter.reset();
    }
    if (event.type === "model_changed") {
      counter.setModel(event.model);
      config.model = event.model;
      config.contextLimit = event.contextLimit;
      saveConfig(config).catch(() => {});
      updateSession(sessionId, { model: event.model, contextLimit: event.contextLimit }).catch(() => {});
    }
  });

  let tunnel: CloudflareTunnel | null = null;
  let connectorUrl = "";
  if (withTunnel) {
    try {
      tunnel = new CloudflareTunnel();
      const tunnelUrl = await tunnel.start(config.mcpPort);
      config.tunnelUrl = tunnelUrl;
      connectorUrl = mcpConnectorUrl(tunnelUrl);
      await updateSession(sessionId, { tunnelUrl }).catch(() => {});
      log(`Tunnel:  ${tunnelUrl}`);
      log(`Connector: ${connectorUrl}`);
    } catch {
      tunnel = null;
      log("Tunnel: failed to start (cloudflared not installed?). MCP tools require a public URL ChatGPT can reach.");
    }
  }

  let browser: BrowserManager | null = null;
  if (options.withBrowser !== false) {
    browser = new BrowserManager();
    try {
      const page = await browser.launch();
      orchestrator.setPage(page);
      log("Browser: connected to isolated chatgpt-local-bridge profile.");
      if (connectorUrl) {
        const result = await orchestrator.openConnectorSetup(connectorUrl, { automatic: true });
        log(`Connector setup: ${result.completed ? "ready" : "needs attention"}`);
      }
    } catch (err) {
      browser = null;
      log(`Browser: failed to connect (${err instanceof Error ? err.message : String(err)}).`);
    }
    await orchestrator.start().catch(() => {});
  }

  return {
    config,
    orchestrator,
    counter,
    browser,
    mcpServer,
    tunnel,
    connectorUrl,
    hooksConfig,
    toolActions,
    branch,
    getSessionId: () => sessionId,
    setSessionId: (id) => {
      sessionId = id;
    },
    getPermissionMode: () => permissionMode,
    setPermissionMode: (mode) => {
      permissionMode = mode;
      config.permissionMode = mode;
      saveConfig(config).catch(() => {});
    },
    ask: async (content) => {
      await runHooks("UserPromptSubmit", hooksConfig.hooks).catch(() => []);
      const resolved = await resolveFileMentions(content, config.repoPath);
      return orchestrator.sendPrompt(resolved.prompt);
    },
    shutdown: async ({ closeBrowser = false } = {}) => {
      await runHooks("SessionEnd", hooksConfig.hooks).catch(() => []);
      tunnel?.stop();
      mcpServer?.close();
      if (closeBrowser) await browser?.close().catch(() => {});
    },
  };
}

/** Resolve the repo's current git branch, or undefined when not a git repo. */
function currentGitBranch(repoPath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoPath }, (error, stdout) => {
      resolve(error ? undefined : stdout.trim() || undefined);
    });
  });
}

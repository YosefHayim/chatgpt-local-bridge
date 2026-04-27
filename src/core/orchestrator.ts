import type { BridgeConfig, Message, ToolResult } from "../types/types.ts";

/** Events emitted by the orchestrator that the CLI subscribes to. */
export type OrchestratorEvent =
  | { type: "message"; message: Message }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: ToolResult }
  | { type: "status"; text: string }
  | { type: "error"; error: string }
  | { type: "context_update"; count: number; limit: number }
  | { type: "conversation_synced"; messages: Message[] };

export type OrchestratorListener = (event: OrchestratorEvent) => void;

/**
 * Main loop coordinator.
 *
 * Ties together browser automation, MCP server, tunnel, and context tracking.
 * Emits events that the terminal UI renders.
 */
export class Orchestrator {
  private listeners: OrchestratorListener[] = [];
  private messages: Message[] = [];

  constructor(private config: BridgeConfig) {}

  /** Subscribe to orchestrator events. Returns an unsubscribe function. */
  on(fn: OrchestratorListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(event: OrchestratorEvent): void {
    for (const fn of this.listeners) {
      fn(event);
    }
  }

  /** Start all subsystems: MCP server, tunnel, browser. */
  async start(): Promise<void> {
    this.emit({ type: "status", text: "Bridge ready. Type a prompt to begin." });
  }

  /** Send a user prompt: resolve @files, inject into browser, capture response. */
  async sendPrompt(content: string): Promise<void> {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    this.messages.push(userMsg);
    this.emit({ type: "message", message: userMsg });
  }

  /** Sync conversation history from the browser into the terminal. */
  async syncConversation(conversationId: string): Promise<void> {
    this.emit({ type: "status", text: `Syncing conversation ${conversationId}...` });
  }

  /** List conversations visible in the ChatGPT sidebar. */
  async listConversations(): Promise<Array<{ id: string; title: string; url: string }>> {
    return [];
  }

  /** Graceful shutdown: stop tunnel, close browser, exit MCP server. */
  async stop(): Promise<void> {
    this.emit({ type: "status", text: "Shutting down..." });
  }

  get currentMessages(): Message[] {
    return this.messages;
  }
}

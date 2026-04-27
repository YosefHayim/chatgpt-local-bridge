export interface BridgeConfig {
  repoPath: string;
  browserProfilePath?: string;
  mcpPort: number;
  tunnelUrl?: string;
  contextLimit: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  url: string;
}

export interface CommandContext {
  config: BridgeConfig;
  messages: Message[];
  sendMessage: (content: string) => Promise<void>;
}

export interface CommandDef {
  name: string;
  description: string;
  handler: (args: string, ctx: CommandContext) => Promise<void>;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

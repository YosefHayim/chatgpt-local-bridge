/** DOM selectors describing a web-chat provider's core surface. */
export interface ProviderSelectors {
  /** Composer input (contenteditable or textarea). */
  composer: string;
  /** Container for a single assistant message; the last match is the latest reply. */
  assistant: string;
  /** Container for a single user message (optional; enables full transcript capture). */
  user?: string;
  /** Stop-generating control (optional). */
  stop?: string;
  /** Element whose presence means "not signed in" (optional). */
  signedOut?: string;
}

/** Static metadata + core selectors for a supported browser provider. */
export interface ProviderConfigEntry {
  /** Human-readable name for CLI/TUI and logs. */
  displayName: string;
  /** Whether MCP connector setup is supported (ChatGPT only today). */
  supportsMcpConnector: boolean;
  /** Origin hostname used to locate an existing tab. */
  origin: string;
  /** URL opened when no provider tab exists. */
  defaultUrl: string;
  /** Fallback model label before detection runs. */
  defaultModel: string;
  /** Core DOM selectors (composer + assistant, plus optional extras). */
  selectors: ProviderSelectors;
}

/**
 * Single source of truth for supported web-chat providers, keyed by id.
 * The provider id type, the CLI `--provider` help, `bridge login`, and the browser
 * adapters all derive from this table. Adding a provider is one entry here plus (for a
 * bespoke DOM) a `*Page` class — the registry binds behavior, never redeclares metadata.
 */
export const PROVIDER_CONFIG = {
  chatgpt: {
    displayName: "ChatGPT",
    supportsMcpConnector: true,
    origin: "chatgpt.com",
    defaultUrl: "https://chatgpt.com",
    defaultModel: "ChatGPT",
    selectors: {
      composer: '#prompt-textarea, [contenteditable="true"]',
      assistant: '[data-message-author-role="assistant"]',
    },
  },
  gemini: {
    displayName: "Gemini",
    supportsMcpConnector: false,
    origin: "gemini.google.com",
    defaultUrl: "https://gemini.google.com/app",
    defaultModel: "Gemini",
    selectors: {
      composer: 'div.ql-editor, [contenteditable="true"]',
      assistant: "model-response, message-content, .model-response-text, .response-content",
    },
  },
  claude: {
    displayName: "Claude",
    supportsMcpConnector: false,
    origin: "claude.ai",
    defaultUrl: "https://claude.ai/new",
    defaultModel: "Claude",
    selectors: {
      composer: 'div[contenteditable="true"]',
      assistant: "div.font-claude-message",
      user: '[data-testid="user-message"]',
      stop: 'button[aria-label="Stop response"]',
      signedOut: 'a[href*="/login"]',
    },
  },
  deepseek: {
    displayName: "DeepSeek",
    supportsMcpConnector: false,
    origin: "chat.deepseek.com",
    defaultUrl: "https://chat.deepseek.com/",
    defaultModel: "DeepSeek",
    selectors: {
      composer: "textarea#chat-input, textarea",
      assistant: ".ds-markdown",
      stop: 'div[role="button"][aria-label*="Stop"]',
      signedOut: 'button:has-text("Log in")',
    },
  },
  grok: {
    displayName: "Grok",
    supportsMcpConnector: false,
    origin: "grok.com",
    defaultUrl: "https://grok.com/",
    defaultModel: "Grok",
    selectors: {
      composer: "textarea",
      assistant: '[class*="message-bubble"]',
      stop: 'button[aria-label*="Stop"]',
      signedOut: 'button:has-text("Sign in")',
    },
  },
  perplexity: {
    displayName: "Perplexity",
    supportsMcpConnector: false,
    origin: "perplexity.ai",
    defaultUrl: "https://www.perplexity.ai/",
    defaultModel: "Perplexity",
    selectors: {
      composer: 'textarea, div[contenteditable="true"]',
      assistant: ".prose",
      stop: 'button[aria-label*="Stop"]',
      signedOut: 'button:has-text("Sign Up")',
    },
  },
} satisfies Record<string, ProviderConfigEntry>;

/** Supported provider id — derived from the config keys (the single source of truth). */
export type BridgeProviderId = keyof typeof PROVIDER_CONFIG;

/** All supported provider ids, in config order. */
export const PROVIDER_IDS = Object.keys(PROVIDER_CONFIG) as BridgeProviderId[];

/** Provider used when a command specifies none. */
export const DEFAULT_PROVIDER: BridgeProviderId = "chatgpt";

/** Human-typed aliases mapped to canonical ids. */
export const PROVIDER_ALIASES: Record<string, BridgeProviderId> = {
  gpt: "chatgpt",
  "chat-gpt": "chatgpt",
  bard: "gemini",
  "claude.ai": "claude",
  anthropic: "claude",
  x: "grok",
  ppl: "perplexity",
};

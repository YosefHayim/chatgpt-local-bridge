import { useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Message, BridgeConfig } from "../types/types.ts";
import { executeCommand } from "./commands/registry.ts";
import { ContextCounter } from "../core/context-counter.ts";

/** Ensure all command modules are loaded (they self-register). */
import "./commands/conversations.ts";
import "./commands/compact.ts";
import "./commands/context.ts";
import "./commands/diff.ts";
import "./commands/exit.ts";

interface AppProps {
  config: BridgeConfig;
  sendMessage: (content: string) => Promise<void>;
  messages: Message[];
  counter: ContextCounter;
}

export function BridgeApp({ config, sendMessage, messages, counter }: AppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Ready");

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setInput("");

    const ctx = {
      config,
      messages,
      sendMessage,
    };

    const handled = await executeCommand(trimmed, ctx);
    if (!handled) {
      setStatus("Sending...");
      await sendMessage(trimmed);
      setStatus("Ready");
    }
  }, [config, messages, sendMessage]);

  useInput((_char, key) => {
    if (key.ctrl && _char === "c") {
      exit();
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat messages */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
      </Box>

      {/* Status bar */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>{status}</Text>
        <Text> | </Text>
        <Text color={counter.isNearLimit ? "red" : "green"}>
          ctx: {counter.summary}
        </Text>
        <Text> | </Text>
        <Text dimColor>tunnel: {config.tunnelUrl ?? "starting..."}</Text>
      </Box>

      {/* Input bar */}
      <Box paddingX={1}>
        <Text color="cyan">{">"} </Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}

function MessageRow({ message }: { message: Message }) {
  const color = message.role === "user" ? "cyan" : "green";
  const label = message.role === "user" ? "You" : "ChatGPT";
  const prefix = message.role === "user" ? ">" : "<";

  return (
    <Box flexDirection="column" marginBottom={0}>
      <Text>
        <Text color={color} bold>{prefix} {label}:</Text>
        {" "}
        <Text>{message.content.slice(0, 500)}{message.content.length > 500 ? "..." : ""}</Text>
      </Text>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <Box marginLeft={2}>
          <Text dimColor>
            [tools: {message.toolCalls.map((tc) => tc.name).join(", ")}]
          </Text>
        </Box>
      )}
    </Box>
  );
}

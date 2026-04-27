import type { Message } from "../types/types.ts";

/** Rough character-to-token ratio for estimation. */
const CHARS_PER_TOKEN = 4;

/** Estimate token count for a single string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Running context counter that tracks usage against a limit. */
export class ContextCounter {
  private total = 0;

  constructor(private limit: number) {}

  /** Add a message to the running count. */
  add(message: Message): void {
    this.total += estimateTokens(message.content);
    for (const tc of message.toolCalls ?? []) {
      this.total += estimateTokens(JSON.stringify(tc.arguments));
    }
  }

  /** Current estimated token count. */
  get count(): number {
    return this.total;
  }

  /** Fraction used (0–1). */
  get fraction(): number {
    return this.total / this.limit;
  }

  /** Human-readable usage string, e.g. "12,400 / 128,000 (9.7%)". */
  get summary(): string {
    const pct = (this.fraction * 100).toFixed(1);
    return `${this.total.toLocaleString()} / ${this.limit.toLocaleString()} (${pct}%)`;
  }

  /** Whether usage exceeds the warning threshold (80%). */
  get isNearLimit(): boolean {
    return this.fraction > 0.8;
  }

  /** Reset the counter (e.g. after /compact). */
  reset(): void {
    this.total = 0;
  }

  /** Set a new limit. */
  setLimit(limit: number): void {
    this.limit = limit;
  }
}

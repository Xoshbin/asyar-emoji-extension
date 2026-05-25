import { rank } from '../fuzzy';
import type { EmojiRecord } from '../types';

export interface EmojiFindResult {
  char: string;
  name: string;
  shortcode: string;
}

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

/**
 * Builds a tool handler bound to the given emoji catalog + frequency reader.
 * The handler accepts `{ description, limit? }`, runs the literal ranker, and
 * returns a minimal `{ char, name, shortcode }[]` payload — the chat agent
 * doesn't need internal fields like codepoints or keywords.
 */
export function buildEmojiFindHandler(
  records: EmojiRecord[],
  getFrequency: () => Map<string, number>,
): (args: unknown) => Promise<EmojiFindResult[]> {
  return async (args: unknown): Promise<EmojiFindResult[]> => {
    const { description, limit } = args as { description: string; limit?: number };
    const cap = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const ranked = rank(records, description, getFrequency());
    return ranked.slice(0, cap).map(({ char, name, shortcode }) => ({ char, name, shortcode }));
  };
}

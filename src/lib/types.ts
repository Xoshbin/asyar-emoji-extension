/**
 * Unicode group/category as returned by unicode-emoji-json. Used internally
 * to bucket emojis into the section structure spec §7.1 expects.
 */
export type EmojiCategory =
  | 'smileys-people'
  | 'animals-nature'
  | 'food-drink'
  | 'activity'
  | 'travel-places'
  | 'objects'
  | 'symbols'
  | 'flags';

export interface EmojiRecord {
  /** The Unicode char (may be a multi-codepoint grapheme cluster). */
  char: string;
  /** Canonical name, e.g. "red heart". */
  name: string;
  /** Slack-style shortcode with colons, e.g. ":red_heart:". */
  shortcode: string;
  /** Asyar's normalized category bucket (see EmojiCategory). */
  category: EmojiCategory;
  /** Searchable keyword tokens (in addition to name tokens). */
  keywords: string[];
  /** Unicode scalar values that compose `char`. */
  codepoints: number[];
  /** Decimal HTML entity, e.g. "&#10084;&#65039;". */
  htmlEntity: string;
  /** Present when the emoji supports skin-tone variants. */
  skinToneBase?: boolean;
}

export type SymbolCategory = 'arrows' | 'math' | 'currency' | 'punctuation' | 'brackets' | 'misc';

export interface SymbolRecord {
  char: string;
  name: string;
  category: SymbolCategory;
  keywords: string[];
  codepoints: number[];
  htmlEntity: string;
}

export type KaomojiCategory = 'happy' | 'sad' | 'angry' | 'love' | 'action' | 'animals' | 'misc';

export interface KaomojiRecord {
  text: string;
  name: string;
  category: KaomojiCategory;
  keywords: string[];
}

import { EMOJIS } from './emojis';

type ShortcodeMap = Record<string, string>;

/**
 * Common shortcode aliases that differ from canonical Unicode slugs
 * (e.g. :heart: vs :red_heart:, :thumbsup: vs :thumbs_up:, :tada: vs :party_popper:).
 * These ensure standard shortcodes typed in chat/editors expand instantly offline.
 */
const COMMON_ALIASES: Record<string, string> = {
  ':heart:': '❤️',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':tada:': '🎉',
  ':smile:': '😄',
  ':smiley:': '😃',
  ':laughing:': '😆',
  ':joy:': '😂',
  ':sob:': '😭',
  ':pray:': '🙏',
  ':wave:': '👋',
  ':clap:': '👏',
  ':thinking:': '🤔',
  ':wink:': '😉',
  ':blush:': '😊',
  ':sunglasses:': '😎',
  ':cry:': '😢',
  ':kiss:': '💋',
  ':poop:': '💩',
  ':ok_hand:': '👌',
  ':muscle:': '💪',
  ':eyes:': '👀',
  ':heart_eyes:': '😍',
  ':sweat_smile:': '😅',
  ':rofl:': '🤣',
  ':100:': '💯',
  ':star:': '⭐',
  ':sparkles:': '✨',
  ':rocket:': '🚀',
  ':fire:': '🔥',
  ':check:': '✔️',
  ':white_check_mark:': '✅',
  ':x:': '❌',
  ':skull:': '💀',
  ':raised_hands:': '🙌',
  ':handshake:': '🤝',
  ':heartbreak:': '💔',
  ':point_up:': '☝️',
  ':point_down:': '👇',
  ':point_left:': '👈',
  ':point_right:': '👉',
};

/**
 * Built once at module-evaluation time from the generated emoji catalog.
 * Used by the worker to register the catalog with the launcher's
 * snippets engine via the SnippetsServiceProxy.
 */
function buildShortcodeMap(): ShortcodeMap {
  const map: ShortcodeMap = {};
  for (const r of EMOJIS) {
    map[r.shortcode] = r.char;
  }
  for (const [alias, char] of Object.entries(COMMON_ALIASES)) {
    if (!map[alias]) {
      map[alias] = char;
    }
  }
  return map;
}

export const SHORTCODE_MAP = buildShortcodeMap();

import { EMOJIS } from './emojis';

type ShortcodeMap = Record<string, string>;

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
  return map;
}

export const SHORTCODE_MAP = buildShortcodeMap();

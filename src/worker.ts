import {
  ExtensionContext as WorkerExtensionContext,
  extensionBridge,
} from 'asyar-sdk/worker';
import type {
  Extension,
  ExtensionContext,
  CommandExecuteArgs,
  ExtensionStateProxy,
  ILogService,
  IToolsService,
  ManifestTool,
} from 'asyar-sdk/contracts';
import type { ISnippetsService } from 'asyar-sdk/contracts';

import manifest from '../manifest.json';
import { EMOJIS } from './data/emojis';
import { SYMBOLS } from './data/symbols';
import { KAOMOJI } from './data/kaomoji';
import { SHORTCODE_MAP } from './data/shortcodeMap';
import { rank } from './lib/fuzzy';
import { pushRecent } from './lib/recents';
import { toggleFavorite } from './lib/favorites';
import { buildEmojiFindHandler } from './lib/tools/emojiFind';
import { handleSetSetting, type SetSettingPayload, type SettingContext } from './lib/settings';
import { STATE_KEYS } from './stateKeys';

const extensionId =
  window.location.hostname === 'localhost' ||
  window.location.hostname === 'asyar-extension.localhost'
    ? window.location.pathname.split('/').filter(Boolean)[0] ||
      'org.asyar.emoji'
    : window.location.hostname || 'org.asyar.emoji';

const workerContext = new WorkerExtensionContext();
workerContext.setExtensionId(extensionId);

const log = workerContext.getService<ILogService>('log');
const toolsService = workerContext.getService<IToolsService>('tools');
const stateProxy = workerContext.getService<ExtensionStateProxy>('state');
const snippets = workerContext.getService<ISnippetsService>('snippets');

const aiToolDefinition = manifest.tools[0] as ManifestTool;

let frequencyCache: Map<string, number> = new Map();

const aiToolHandler = buildEmojiFindHandler(EMOJIS, () => frequencyCache);

const settingsCtx: SettingContext = {
  state: {
    get: (k) => stateProxy.get(k),
    set: (k, v) => stateProxy.set(k, v),
  },
  tools: {
    registerTool: (def, handler) => toolsService.registerTool(def as ManifestTool, handler),
    unregisterTool: (id) => toolsService.unregisterTool(id),
  },
  snippets,
  log,
  aiToolDefinition,
  aiToolHandler,
  shortcodeMap: SHORTCODE_MAP,
};

class EmojiExtension implements Extension {
  async initialize(_ctx: ExtensionContext): Promise<void> {}

  async activate(): Promise<void> {
    log.info(`[${extensionId}] worker activated`);

    const freq = (await stateProxy.get(STATE_KEYS.frequency)) as Record<string, number> | null;
    frequencyCache = new Map(Object.entries(freq ?? {}));

    const aiToolEnabled =
      ((await stateProxy.get(STATE_KEYS.aiToolEnabled)) as boolean | null) ?? true;
    if (aiToolEnabled) {
      try {
        await toolsService.registerTool(aiToolDefinition, aiToolHandler);
      } catch (err: unknown) {
        log.warn(`registerTool(emoji_find) failed: ${describe(err)}`);
      }
    }

    const shortcodesEnabled =
      ((await stateProxy.get(STATE_KEYS.shortcodesEnabled)) as boolean | null) ?? true;
    if (shortcodesEnabled) {
      try {
        await snippets.registerShortcodes(SHORTCODE_MAP);
      } catch (err: unknown) {
        log.warn(`registerShortcodes failed: ${describe(err)}`);
      }
    }

    const aiFallbackEnabled =
      ((await stateProxy.get(STATE_KEYS.aiFallbackEnabled)) as boolean | null) ?? true;
    try {
      await snippets.setInlineFallbackEnabled(aiFallbackEnabled);
    } catch (err: unknown) {
      log.warn(`setInlineFallbackEnabled failed: ${describe(err)}`);
    }
  }

  async deactivate(): Promise<void> {
    await toolsService.unregisterTool('emoji_find').catch(() => undefined);
    await snippets.unregisterShortcodes().catch(() => undefined);
    log.info(`[${extensionId}] worker deactivated`);
  }

  async executeCommand(_commandId: string, _args?: CommandExecuteArgs): Promise<unknown> {
    return undefined;
  }

  async search(_query: string): Promise<never[]> {
    return [];
  }

  onUnload = (): void => {};
}

const ext = new EmojiExtension();
extensionBridge.registerManifest(
  manifest as Parameters<typeof extensionBridge.registerManifest>[0],
);
extensionBridge.registerExtensionImplementation(extensionId, ext);

workerContext.onRequest<{ query: string }, unknown>('emoji.search', async (p) => {
  const q = (p?.query ?? '').trim();
  if (q.length === 0) return { emojis: [], symbols: [], kaomoji: [] };
  const emojiHits = rank(EMOJIS, q, frequencyCache);
  const symbolHits = rank(SYMBOLS, q, frequencyCache);
  const showKaomoji =
    ((await stateProxy.get(STATE_KEYS.showKaomoji)) as boolean | null) ?? true;
  const kaomojiHits = showKaomoji ? rank(KAOMOJI, q, frequencyCache) : [];
  return { emojis: emojiHits, symbols: symbolHits, kaomoji: kaomojiHits };
});

// Clipboard ops happen in the view (SDK keeps clipboard view-only). The worker
// only tracks usage to feed the ranker's frequency tiebreak + Recents section.
workerContext.onRequest<{ char: string }, void>('emoji.recordUsage', async (p) => {
  const recents =
    ((await stateProxy.get(STATE_KEYS.recents)) as string[] | null) ?? [];
  await stateProxy.set(STATE_KEYS.recents, pushRecent(recents, p.char));
  const freq =
    ((await stateProxy.get(STATE_KEYS.frequency)) as Record<string, number> | null) ?? {};
  freq[p.char] = (freq[p.char] ?? 0) + 1;
  await stateProxy.set(STATE_KEYS.frequency, freq);
  frequencyCache = new Map(Object.entries(freq));
});

workerContext.onRequest<{ char: string }, void>('emoji.togglePin', async (p) => {
  const favorites =
    ((await stateProxy.get(STATE_KEYS.favorites)) as string[] | null) ?? [];
  await stateProxy.set(STATE_KEYS.favorites, toggleFavorite(favorites, p.char));
});

workerContext.onRequest<{ tone: 0 | 1 | 2 | 3 | 4 | 5 }, void>('emoji.setSkinTone', async (p) => {
  await stateProxy.set(STATE_KEYS.skinTone, p.tone);
});

workerContext.onRequest<SetSettingPayload, void>('emoji.setSetting', async (p) => {
  await handleSetSetting(settingsCtx, p);
});

workerContext.onRequest<void, void>('emoji.clearRecents', async () => {
  await stateProxy.set(STATE_KEYS.recents, []);
  await stateProxy.set(STATE_KEYS.frequency, {});
  frequencyCache = new Map();
});

workerContext.onRequest<void, Array<[string, string]>>('emoji.listLearnedShortcodes', async () => {
  return snippets.listLearnedShortcodes();
});

workerContext.onRequest<{ shortcode: string }, void>('emoji.promoteLearned', async (p) => {
  await snippets.promoteLearnedShortcode(p.shortcode);
});

workerContext.onRequest<{ shortcode: string }, void>('emoji.forgetLearned', async (p) => {
  await snippets.forgetLearnedShortcode(p.shortcode);
});

workerContext.onRequest<void, void>('emoji.clearLearned', async () => {
  await snippets.clearLearnedShortcodes();
});

void (async () => {
  try {
    await ext.activate();
  } catch (err: unknown) {
    log.error(`[${extensionId}] worker activate failed: ${describe(err)}`);
  }
})();

window.addEventListener('beforeunload', () => {
  void ext.deactivate();
});

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

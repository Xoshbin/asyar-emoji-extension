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
import {
  applyPreferenceTransition,
  readEmojiPreferences,
  type EmojiPreferences,
  type PreferenceEffectsContext,
} from './lib/preferencesEffects';
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
let lastPrefs: EmojiPreferences | null = null;

const aiToolHandler = buildEmojiFindHandler(EMOJIS, () => frequencyCache);

const effectsCtx: PreferenceEffectsContext = {
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

async function syncPreferences(): Promise<void> {
  const next = readEmojiPreferences(
    workerContext.preferences.values as Record<string, unknown>,
  );
  try {
    await applyPreferenceTransition(effectsCtx, lastPrefs, next);
  } catch (err: unknown) {
    log.warn(`preference transition failed: ${describe(err)}`);
  }
  lastPrefs = next;
}

class EmojiExtension implements Extension {
  async initialize(_ctx: ExtensionContext): Promise<void> {}

  async activate(): Promise<void> {
    log.info(`[${extensionId}] worker activated`);

    const freq = (await stateProxy.get(STATE_KEYS.frequency)) as Record<string, number> | null;
    frequencyCache = new Map(Object.entries(freq ?? {}));

    await syncPreferences();
  }

  async deactivate(): Promise<void> {
    await toolsService.unregisterTool('emoji_find').catch(() => undefined);
    await snippets.unregisterShortcodes().catch(() => undefined);
    log.info(`[${extensionId}] worker deactivated`);
  }

  async executeCommand(commandId: string, _args?: CommandExecuteArgs): Promise<unknown> {
    if (commandId === 'clear-recents') {
      await stateProxy.set(STATE_KEYS.recents, []);
      await stateProxy.set(STATE_KEYS.frequency, {});
      frequencyCache = new Map();
      return;
    }
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

workerContext.onPreferencesChanged(() => {
  void syncPreferences();
});

workerContext.onRequest<{ query: string }, unknown>('emoji.search', async (p) => {
  const q = (p?.query ?? '').trim();
  if (q.length === 0) return { emojis: [], symbols: [], kaomoji: [] };
  const emojiHits = rank(EMOJIS, q, frequencyCache);
  const symbolHits = rank(SYMBOLS, q, frequencyCache);
  const showKaomoji = lastPrefs?.showKaomoji ?? true;
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

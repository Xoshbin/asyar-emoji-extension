import type { ShortcodeMap } from 'asyar-sdk/contracts';

export interface EmojiPreferences {
  aiToolEnabled: boolean;
  shortcodesEnabled: boolean;
  aiFallbackEnabled: boolean;
  showKaomoji: boolean;
  skinTone: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface PreferenceEffectsContext {
  tools: {
    registerTool: (
      def: { id: string; name: string; description: string; parameters: unknown },
      handler: (args: unknown) => Promise<unknown>,
    ) => Promise<void>;
    unregisterTool: (id: string) => Promise<void>;
  };
  snippets: {
    registerShortcodes: (map: ShortcodeMap) => Promise<void>;
    unregisterShortcodes: () => Promise<void>;
    setInlineFallbackEnabled: (enabled: boolean) => Promise<void>;
  };
  log: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string | Error) => void;
  };
  aiToolDefinition: { id: string; name: string; description: string; parameters: unknown };
  aiToolHandler: (args: unknown) => Promise<unknown>;
  shortcodeMap: ShortcodeMap;
}

function clampTone(n: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, Math.trunc(n))) as 0 | 1 | 2 | 3 | 4 | 5;
}

export function readEmojiPreferences(
  values: Record<string, unknown>,
): EmojiPreferences {
  const skinToneRaw =
    typeof values.skinTone === 'string'
      ? Number.parseInt(values.skinTone, 10)
      : typeof values.skinTone === 'number'
        ? values.skinTone
        : 0;
  return {
    aiToolEnabled: values.aiToolEnabled !== false,
    shortcodesEnabled: values.shortcodesEnabled !== false,
    aiFallbackEnabled: values.aiFallbackEnabled !== false,
    showKaomoji: values.showKaomoji !== false,
    skinTone: clampTone(skinToneRaw),
  };
}

export async function applyPreferenceTransition(
  ctx: PreferenceEffectsContext,
  prev: EmojiPreferences | null,
  next: EmojiPreferences,
): Promise<void> {
  if (prev === null || prev.aiToolEnabled !== next.aiToolEnabled) {
    if (next.aiToolEnabled) {
      await ctx.tools.registerTool(ctx.aiToolDefinition, ctx.aiToolHandler);
    } else {
      await ctx.tools.unregisterTool(ctx.aiToolDefinition.id);
    }
  }
  if (prev === null || prev.shortcodesEnabled !== next.shortcodesEnabled) {
    if (next.shortcodesEnabled) {
      await ctx.snippets.registerShortcodes(ctx.shortcodeMap);
    } else {
      await ctx.snippets.unregisterShortcodes();
    }
  }
  if (prev === null || prev.aiFallbackEnabled !== next.aiFallbackEnabled) {
    await ctx.snippets.setInlineFallbackEnabled(next.aiFallbackEnabled);
  }
  // skinTone, showKaomoji: pure-state, no side effect.
}

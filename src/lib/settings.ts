import { STATE_KEYS } from '../stateKeys';
import type { ShortcodeMap } from 'asyar-sdk/contracts';

// Structural types only — these match the SDK proxies but we don't pull the
// imports here to keep settings.ts unit-testable in isolation.
export interface SettingContext {
  state: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
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

export type SettingKey =
  | 'aiToolEnabled'
  | 'shortcodesEnabled'
  | 'aiFallbackEnabled'
  | 'skinTone'
  | 'showKaomoji';

export interface SetSettingPayload {
  key: SettingKey;
  value: unknown;
}

export async function handleSetSetting(
  ctx: SettingContext,
  payload: SetSettingPayload,
): Promise<void> {
  const { key, value } = payload;
  await ctx.state.set(STATE_KEYS[key], value);

  if (key === 'aiToolEnabled') {
    if (value === true) {
      await ctx.tools.registerTool(ctx.aiToolDefinition, ctx.aiToolHandler);
    } else {
      await ctx.tools.unregisterTool('emoji_find');
    }
  } else if (key === 'shortcodesEnabled') {
    if (value === true) {
      await ctx.snippets.registerShortcodes(ctx.shortcodeMap);
    } else {
      await ctx.snippets.unregisterShortcodes();
    }
  } else if (key === 'aiFallbackEnabled') {
    await ctx.snippets.setInlineFallbackEnabled(value as boolean);
  }
  // skinTone, showKaomoji: pure-state persist, no side effect.
}

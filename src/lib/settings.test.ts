import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSetSetting, type SettingContext } from './settings';
import { STATE_KEYS } from '../stateKeys';

function buildContext() {
  const state = new Map<string, unknown>();
  return {
    state: {
      get: vi.fn(async (k: string) => state.get(k)),
      set: vi.fn(async (k: string, v: unknown) => { state.set(k, v); }),
    },
    tools: {
      registerTool: vi.fn(async () => {}),
      unregisterTool: vi.fn(async () => {}),
    },
    snippets: {
      registerShortcodes: vi.fn(async () => {}),
      unregisterShortcodes: vi.fn(async () => {}),
      setInlineFallbackEnabled: vi.fn(async () => {}),
    },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    aiToolDefinition: { id: 'emoji_find', name: 'Find emoji', description: '', parameters: {} },
    aiToolHandler: vi.fn(async () => []),
    shortcodeMap: { ':party:': '🎉' },
  } as unknown as SettingContext & { state: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } };
}

describe('handleSetSetting', () => {
  let ctx: ReturnType<typeof buildContext>;
  beforeEach(() => { ctx = buildContext(); });

  it('toggling aiToolEnabled off unregisters emoji_find', async () => {
    await handleSetSetting(ctx, { key: 'aiToolEnabled', value: false });
    expect(ctx.tools.unregisterTool).toHaveBeenCalledWith('emoji_find');
    expect(ctx.state.set).toHaveBeenCalledWith(STATE_KEYS.aiToolEnabled, false);
  });

  it('toggling aiToolEnabled on registers emoji_find with the bound handler', async () => {
    await handleSetSetting(ctx, { key: 'aiToolEnabled', value: true });
    expect(ctx.tools.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'emoji_find' }),
      ctx.aiToolHandler,
    );
  });

  it('toggling shortcodesEnabled off unregisters shortcodes', async () => {
    await handleSetSetting(ctx, { key: 'shortcodesEnabled', value: false });
    expect(ctx.snippets.unregisterShortcodes).toHaveBeenCalled();
  });

  it('toggling shortcodesEnabled on registers shortcodes with the bound map', async () => {
    await handleSetSetting(ctx, { key: 'shortcodesEnabled', value: true });
    expect(ctx.snippets.registerShortcodes).toHaveBeenCalledWith(ctx.shortcodeMap);
  });

  it('other settings just persist without side-effects', async () => {
    await handleSetSetting(ctx, { key: 'skinTone', value: 3 });
    expect(ctx.state.set).toHaveBeenCalledWith(STATE_KEYS.skinTone, 3);
    expect(ctx.tools.registerTool).not.toHaveBeenCalled();
    expect(ctx.snippets.registerShortcodes).not.toHaveBeenCalled();
  });

  it('toggling aiFallbackEnabled off calls setInlineFallbackEnabled(false)', async () => {
    await handleSetSetting(ctx, { key: 'aiFallbackEnabled', value: false });
    expect(ctx.snippets.setInlineFallbackEnabled).toHaveBeenCalledWith(false);
    expect(ctx.state.set).toHaveBeenCalledWith(STATE_KEYS.aiFallbackEnabled, false);
  });

  it('toggling aiFallbackEnabled on calls setInlineFallbackEnabled(true)', async () => {
    await handleSetSetting(ctx, { key: 'aiFallbackEnabled', value: true });
    expect(ctx.snippets.setInlineFallbackEnabled).toHaveBeenCalledWith(true);
    expect(ctx.state.set).toHaveBeenCalledWith(STATE_KEYS.aiFallbackEnabled, true);
  });

  it('showKaomoji persists', async () => {
    await handleSetSetting(ctx, { key: 'showKaomoji', value: false });
    expect(ctx.state.set).toHaveBeenCalledWith(STATE_KEYS.showKaomoji, false);
  });
});

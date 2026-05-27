import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readEmojiPreferences,
  applyPreferenceTransition,
  type EmojiPreferences,
  type PreferenceEffectsContext,
} from './preferencesEffects';

function buildCtx(): PreferenceEffectsContext & {
  tools: { registerTool: ReturnType<typeof vi.fn>; unregisterTool: ReturnType<typeof vi.fn> };
  snippets: {
    registerShortcodes: ReturnType<typeof vi.fn>;
    unregisterShortcodes: ReturnType<typeof vi.fn>;
    setInlineFallbackEnabled: ReturnType<typeof vi.fn>;
  };
} {
  return {
    tools: {
      registerTool: vi.fn(async () => {}),
      unregisterTool: vi.fn(async () => {}),
    },
    snippets: {
      registerShortcodes: vi.fn(async () => {}),
      unregisterShortcodes: vi.fn(async () => {}),
      setInlineFallbackEnabled: vi.fn(async () => {}),
    },
    aiToolDefinition: { id: 'emoji_find', name: 'Find emoji', description: '', parameters: {} },
    aiToolHandler: vi.fn(async () => []),
    shortcodeMap: { ':party:': '🎉' },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

const DEFAULTS: EmojiPreferences = {
  aiToolEnabled: true,
  shortcodesEnabled: true,
  aiFallbackEnabled: true,
  showKaomoji: true,
  skinTone: 0,
};

describe('readEmojiPreferences', () => {
  it('returns full defaults for empty values', () => {
    expect(readEmojiPreferences({})).toEqual(DEFAULTS);
  });

  it('honors explicit false for boolean checkboxes', () => {
    const p = readEmojiPreferences({
      aiToolEnabled: false,
      shortcodesEnabled: false,
      aiFallbackEnabled: false,
      showKaomoji: false,
    });
    expect(p.aiToolEnabled).toBe(false);
    expect(p.shortcodesEnabled).toBe(false);
    expect(p.aiFallbackEnabled).toBe(false);
    expect(p.showKaomoji).toBe(false);
  });

  it('parses skinTone string from dropdown', () => {
    expect(readEmojiPreferences({ skinTone: '3' }).skinTone).toBe(3);
    expect(readEmojiPreferences({ skinTone: '5' }).skinTone).toBe(5);
  });

  it('clamps skinTone out-of-range to 0..5', () => {
    expect(readEmojiPreferences({ skinTone: '7' }).skinTone).toBe(5);
    expect(readEmojiPreferences({ skinTone: '-1' }).skinTone).toBe(0);
    expect(readEmojiPreferences({ skinTone: 'banana' }).skinTone).toBe(0);
  });

  it('accepts numeric skinTone as a courtesy', () => {
    expect(readEmojiPreferences({ skinTone: 2 }).skinTone).toBe(2);
  });
});

describe('applyPreferenceTransition', () => {
  let ctx: ReturnType<typeof buildCtx>;
  beforeEach(() => { ctx = buildCtx(); });

  it('on first apply (prev=null), registers/unregisters everything based on next', async () => {
    await applyPreferenceTransition(ctx, null, DEFAULTS);
    expect(ctx.tools.registerTool).toHaveBeenCalledWith(ctx.aiToolDefinition, ctx.aiToolHandler);
    expect(ctx.snippets.registerShortcodes).toHaveBeenCalledWith(ctx.shortcodeMap);
    expect(ctx.snippets.setInlineFallbackEnabled).toHaveBeenCalledWith(true);
  });

  it('on first apply with all flags off, unregisters tool/snippets and sets fallback false', async () => {
    const off: EmojiPreferences = {
      aiToolEnabled: false,
      shortcodesEnabled: false,
      aiFallbackEnabled: false,
      showKaomoji: true,
      skinTone: 0,
    };
    await applyPreferenceTransition(ctx, null, off);
    expect(ctx.tools.unregisterTool).toHaveBeenCalledWith('emoji_find');
    expect(ctx.snippets.unregisterShortcodes).toHaveBeenCalled();
    expect(ctx.snippets.setInlineFallbackEnabled).toHaveBeenCalledWith(false);
    expect(ctx.tools.registerTool).not.toHaveBeenCalled();
    expect(ctx.snippets.registerShortcodes).not.toHaveBeenCalled();
  });

  it('no-op when prev equals next (idempotent)', async () => {
    await applyPreferenceTransition(ctx, DEFAULTS, DEFAULTS);
    expect(ctx.tools.registerTool).not.toHaveBeenCalled();
    expect(ctx.tools.unregisterTool).not.toHaveBeenCalled();
    expect(ctx.snippets.registerShortcodes).not.toHaveBeenCalled();
    expect(ctx.snippets.unregisterShortcodes).not.toHaveBeenCalled();
    expect(ctx.snippets.setInlineFallbackEnabled).not.toHaveBeenCalled();
  });

  it('toggling aiToolEnabled off after on calls unregisterTool only', async () => {
    await applyPreferenceTransition(ctx, DEFAULTS, { ...DEFAULTS, aiToolEnabled: false });
    expect(ctx.tools.unregisterTool).toHaveBeenCalledWith('emoji_find');
    expect(ctx.tools.registerTool).not.toHaveBeenCalled();
  });

  it('toggling shortcodesEnabled off after on calls unregisterShortcodes only', async () => {
    await applyPreferenceTransition(ctx, DEFAULTS, { ...DEFAULTS, shortcodesEnabled: false });
    expect(ctx.snippets.unregisterShortcodes).toHaveBeenCalled();
    expect(ctx.snippets.registerShortcodes).not.toHaveBeenCalled();
  });

  it('toggling aiFallbackEnabled propagates the new value', async () => {
    await applyPreferenceTransition(ctx, DEFAULTS, { ...DEFAULTS, aiFallbackEnabled: false });
    expect(ctx.snippets.setInlineFallbackEnabled).toHaveBeenCalledWith(false);
  });

  it('skinTone / showKaomoji changes trigger zero side effects', async () => {
    await applyPreferenceTransition(
      ctx,
      DEFAULTS,
      { ...DEFAULTS, skinTone: 3, showKaomoji: false },
    );
    expect(ctx.tools.registerTool).not.toHaveBeenCalled();
    expect(ctx.tools.unregisterTool).not.toHaveBeenCalled();
    expect(ctx.snippets.registerShortcodes).not.toHaveBeenCalled();
    expect(ctx.snippets.unregisterShortcodes).not.toHaveBeenCalled();
    expect(ctx.snippets.setInlineFallbackEnabled).not.toHaveBeenCalled();
  });
});

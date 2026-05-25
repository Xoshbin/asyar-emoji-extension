<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExtensionContext, ExtensionStateProxy } from 'asyar-sdk/view';
  import { STATE_KEYS } from '../stateKeys';
  import { applySkinTone } from '../lib/skinTone';
  import type { SetSettingPayload } from '../lib/settings';

  interface Props { context: ExtensionContext; }
  let { context }: Props = $props();

  const stateProxy = $derived(context.getService<ExtensionStateProxy>('state'));

  let aiToolEnabled = $state(true);
  let shortcodesEnabled = $state(true);
  let aiFallbackEnabled = $state(true);
  let skinTone = $state<0 | 1 | 2 | 3 | 4 | 5>(0);
  let showKaomoji = $state(true);
  let learnedShortcodes = $state<Array<[string, string]>>([]);
  let loadingLearned = $state(false);

  const SKIN_TONE_LABELS = ['Default', 'Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'];

  onMount(() => {
    let active = true;
    const cleanup: Array<() => void | Promise<void>> = [];
    const sp = stateProxy;

    (async () => {
      const [
        initAiTool, unsubAiTool,
        initShortcodes, unsubShortcodes,
        initAiFallback, unsubAiFallback,
        initTone, unsubTone,
        initKaomoji, unsubKaomoji,
      ] = await Promise.all([
        sp.get(STATE_KEYS.aiToolEnabled),
        sp.subscribe(STATE_KEYS.aiToolEnabled, (v) => {
          if (!active) return;
          aiToolEnabled = v !== false;
        }),
        sp.get(STATE_KEYS.shortcodesEnabled),
        sp.subscribe(STATE_KEYS.shortcodesEnabled, (v) => {
          if (!active) return;
          shortcodesEnabled = v !== false;
        }),
        sp.get(STATE_KEYS.aiFallbackEnabled),
        sp.subscribe(STATE_KEYS.aiFallbackEnabled, (v) => {
          if (!active) return;
          aiFallbackEnabled = v !== false;
        }),
        sp.get(STATE_KEYS.skinTone),
        sp.subscribe(STATE_KEYS.skinTone, (v) => {
          if (!active) return;
          const t = typeof v === 'number' ? v : 0;
          skinTone = (Math.min(5, Math.max(0, t))) as 0 | 1 | 2 | 3 | 4 | 5;
        }),
        sp.get(STATE_KEYS.showKaomoji),
        sp.subscribe(STATE_KEYS.showKaomoji, (v) => {
          if (!active) return;
          showKaomoji = v !== false;
        }),
      ]);

      if (!active) {
        void unsubAiTool(); void unsubShortcodes(); void unsubAiFallback();
        void unsubTone(); void unsubKaomoji();
        return;
      }

      aiToolEnabled = initAiTool !== false;
      shortcodesEnabled = initShortcodes !== false;
      aiFallbackEnabled = initAiFallback !== false;
      const rawTone = typeof initTone === 'number' ? initTone : 0;
      skinTone = (Math.min(5, Math.max(0, rawTone))) as 0 | 1 | 2 | 3 | 4 | 5;
      showKaomoji = initKaomoji !== false;

      cleanup.push(unsubAiTool, unsubShortcodes, unsubAiFallback, unsubTone, unsubKaomoji);
    })();

    void refreshLearned();

    return () => {
      active = false;
      for (const fn of cleanup) {
        try { void fn(); } catch { /* */ }
      }
    };
  });

  async function refreshLearned() {
    loadingLearned = true;
    try {
      learnedShortcodes = await context.request<Array<[string, string]>>(
        'emoji.listLearnedShortcodes',
        undefined,
      ) ?? [];
    } catch {
      learnedShortcodes = [];
    } finally {
      loadingLearned = false;
    }
  }

  async function setSetting(p: SetSettingPayload) {
    await context.request<void>('emoji.setSetting', p);
  }

  function toggleAiTool(value: boolean) {
    aiToolEnabled = value;
    void setSetting({ key: 'aiToolEnabled', value });
  }

  function toggleShortcodes(value: boolean) {
    shortcodesEnabled = value;
    void setSetting({ key: 'shortcodesEnabled', value });
  }

  function toggleAiFallback(value: boolean) {
    aiFallbackEnabled = value;
    void setSetting({ key: 'aiFallbackEnabled', value });
  }

  function toggleShowKaomoji(value: boolean) {
    showKaomoji = value;
    void setSetting({ key: 'showKaomoji', value });
  }

  function selectSkinTone(tone: 0 | 1 | 2 | 3 | 4 | 5) {
    skinTone = tone;
    void setSetting({ key: 'skinTone', value: tone });
  }

  async function clearRecents() {
    await context.request<void>('emoji.clearRecents', undefined);
  }

  async function promoteLearned(shortcode: string) {
    await context.request<void>('emoji.promoteLearned', { shortcode });
    await refreshLearned();
  }

  async function forgetLearned(shortcode: string) {
    await context.request<void>('emoji.forgetLearned', { shortcode });
    await refreshLearned();
  }

  async function clearAllLearned() {
    await context.request<void>('emoji.clearLearned', undefined);
    await refreshLearned();
  }
</script>

<div class="settings-view custom-scrollbar">
  <section class="settings-section">
    <div class="settings-section-header">
      <h2 class="settings-section-title">General</h2>
    </div>
    <div class="settings-section-content">

      <div class="settings-row">
        <div class="settings-row-text">
          <div class="settings-row-label">Enable AI tool</div>
          <div class="settings-row-description">
            Lets the Asyar chat agent search the emoji catalog via the <code>emoji_find</code> tool.
          </div>
        </div>
        <div class="settings-row-control">
          <label class="toggle-label">
            <input
              type="checkbox"
              class="toggle-input"
              checked={aiToolEnabled}
              onchange={(e) => toggleAiTool((e.target as HTMLInputElement).checked)}
            />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-row-text">
          <div class="settings-row-label">Show kaomoji</div>
          <div class="settings-row-description">
            Include the <code>¯\_(ツ)_/¯</code>-style kaomoji section in the picker.
          </div>
        </div>
        <div class="settings-row-control">
          <label class="toggle-label">
            <input
              type="checkbox"
              class="toggle-input"
              checked={showKaomoji}
              onchange={(e) => toggleShowKaomoji((e.target as HTMLInputElement).checked)}
            />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-row-text">
          <div class="settings-row-label">Default skin tone</div>
          <div class="settings-row-description">
            Applied automatically to skin-tone-capable emojis (👍, 👋, 🙏, …).
          </div>
        </div>
        <div class="settings-row-control">
          <div class="skin-tone-segmented" role="radiogroup" aria-label="Default skin tone">
            {#each SKIN_TONE_LABELS as label, i (i)}
              {@const tone = i as 0 | 1 | 2 | 3 | 4 | 5}
              <button
                type="button"
                class="tone-swatch"
                class:tone-active={skinTone === tone}
                role="radio"
                aria-checked={skinTone === tone}
                aria-label={label}
                title={label}
                onclick={() => selectSkinTone(tone)}
              >
                {applySkinTone('👍', tone)}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="settings-row last-row">
        <div class="settings-row-text">
          <div class="settings-row-label">Clear recents</div>
          <div class="settings-row-description">
            Wipe your recently used emojis and frequency counts.
          </div>
        </div>
        <div class="settings-row-control">
          <button class="btn-danger" type="button" onclick={clearRecents}>
            Clear
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section-header">
      <h2 class="settings-section-title">System-wide shortcuts</h2>
      <p class="settings-section-description">
        Type <code>:party:</code> in any app and Asyar replaces it with 🎉 in place. No window opens.
      </p>
    </div>
    <div class="settings-section-content">

      <div class="settings-row">
        <div class="settings-row-text">
          <div class="settings-row-label">Expand <code>:shortcodes:</code> system-wide</div>
          <div class="settings-row-description">
            Master switch for the inline replacement. Turn off to silence shortcode expansion everywhere.
          </div>
        </div>
        <div class="settings-row-control">
          <label class="toggle-label">
            <input
              type="checkbox"
              class="toggle-input"
              checked={shortcodesEnabled}
              onchange={(e) => toggleShortcodes((e.target as HTMLInputElement).checked)}
            />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="settings-row last-row">
        <div class="settings-row-text">
          <div class="settings-row-label">AI fallback for unknown <code>:shortcodes:</code></div>
          <div class="settings-row-description">
            When a <code>:xxx:</code> pattern doesn't match a known emoji, ask AI to guess one and paste
            its best match. Result is cached for 24 hours so the same pattern won't re-trigger AI.
          </div>
        </div>
        <div class="settings-row-control">
          <label class="toggle-label">
            <input
              type="checkbox"
              class="toggle-input"
              checked={aiFallbackEnabled}
              onchange={(e) => toggleAiFallback((e.target as HTMLInputElement).checked)}
            />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section-header">
      <h2 class="settings-section-title">AI-resolved shortcodes</h2>
      <p class="settings-section-description">
        Patterns the AI fallback has resolved in the last 24h. Promote one to make it a permanent user
        snippet (survives the cache, shows up in your regular Snippets list). Forget one to let AI try again next time.
      </p>
    </div>
    <div class="settings-section-content">
      {#if loadingLearned}
        <div class="empty">Loading…</div>
      {:else if learnedShortcodes.length === 0}
        <div class="empty">
          <div class="empty-title">No AI-resolved shortcodes yet</div>
          <div class="empty-hint">
            Type something like <code>:burnout:</code> in any app while AI fallback is on.
            Once AI finds a match, it'll appear here so you can promote or forget it.
          </div>
        </div>
      {:else}
        <ul class="learned-list">
          {#each learnedShortcodes as [shortcode, emoji] (shortcode)}
            <li class="learned-row">
              <span class="learned-shortcode"><code>{shortcode}</code></span>
              <span class="learned-arrow">→</span>
              <span class="learned-emoji">{emoji}</span>
              <span class="learned-actions">
                <button
                  type="button"
                  class="btn-secondary"
                  title="Save as a permanent user snippet"
                  onclick={() => promoteLearned(shortcode)}
                >Promote</button>
                <button
                  type="button"
                  class="btn-ghost"
                  title="Drop this entry so AI can try a different match next time"
                  onclick={() => forgetLearned(shortcode)}
                >Forget</button>
              </span>
            </li>
          {/each}
        </ul>
        <div class="learned-footer">
          <button type="button" class="btn-danger" onclick={clearAllLearned}>
            Clear all
          </button>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  :global(html, body) { margin: 0; padding: 0; height: 100%; width: 100%; }
  :global(#app) { height: 100%; width: 100%; }

  .settings-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    font-family: var(--font-ui);
    color: var(--text-primary);
    background: var(--bg-primary);
    padding: var(--space-5);
    box-sizing: border-box;
  }

  .settings-section + .settings-section { margin-top: var(--space-4); }

  /* Section card — matches launcher's SettingsSection. */
  .settings-section {
    border: 1px solid var(--separator);
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    box-shadow: var(--shadow-xs);
  }
  .settings-section-header {
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--separator);
  }
  .settings-section-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .settings-section-description {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: var(--space-2) 0 0;
    line-height: 1.5;
  }
  .settings-section-content { padding: 0 var(--space-6); }

  /* Row — matches launcher's SettingsRow. */
  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    padding: var(--space-5) 0;
    border-bottom: 1px solid var(--separator);
  }
  .settings-row.last-row { border-bottom: none; }
  .settings-row-text { flex: 1; min-width: 0; }
  .settings-row-label {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--text-primary);
  }
  .settings-row-description {
    margin-top: var(--space-1);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .settings-row-control { flex-shrink: 0; }

  /* Toggle. */
  .toggle-label {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    position: relative;
  }
  .toggle-input {
    position: absolute;
    width: 1px; height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  .toggle-track {
    display: inline-block;
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: var(--bg-tertiary, var(--separator));
    position: relative;
    transition: background var(--transition-fast);
  }
  .toggle-track::after {
    content: '';
    position: absolute;
    top: 2px; left: 2px;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--text-primary);
    transition: transform var(--transition-fast);
  }
  .toggle-input:checked + .toggle-track {
    background: var(--accent-primary);
  }
  .toggle-input:checked + .toggle-track::after {
    transform: translateX(16px);
    background: white;
  }
  .toggle-label:focus-within .toggle-track {
    box-shadow: var(--shadow-focus);
  }

  /* Skin-tone segmented. */
  .skin-tone-segmented {
    display: inline-flex;
    gap: var(--space-1);
    background: var(--bg-tertiary, var(--bg-primary));
    border: 1px solid var(--separator);
    border-radius: var(--radius-md);
    padding: var(--space-1);
  }
  .tone-swatch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    font-size: var(--font-size-lg, 16px);
    line-height: 1;
    padding: 0;
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }
  .tone-swatch:hover { background: var(--bg-hover); }
  .tone-swatch.tone-active {
    background: var(--bg-selected, var(--bg-hover));
    border-color: var(--accent-primary);
  }

  /* Buttons. */
  .btn-danger, .btn-secondary, .btn-ghost {
    font: inherit;
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--separator);
    background: var(--bg-tertiary, var(--bg-primary));
    color: var(--text-primary);
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }
  .btn-danger {
    border-color: var(--accent-danger, var(--separator));
    color: var(--accent-danger, var(--text-primary));
  }
  .btn-danger:hover {
    background: var(--accent-danger, var(--bg-hover));
    color: white;
  }
  .btn-secondary:hover, .btn-ghost:hover { background: var(--bg-hover); }
  .btn-ghost { border-color: transparent; background: transparent; color: var(--text-secondary); }

  /* Learned shortcodes list. */
  .empty {
    padding: var(--space-6) 0;
    text-align: center;
    color: var(--text-tertiary);
  }
  .empty-title {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
    font-weight: 500;
  }
  .empty-hint {
    font-size: var(--font-size-xs);
    line-height: 1.5;
    max-width: 36em;
    margin: 0 auto;
  }
  .learned-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .learned-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--separator);
  }
  .learned-row:last-child { border-bottom: none; }
  .learned-shortcode { flex: 0 0 auto; }
  .learned-arrow { color: var(--text-tertiary); }
  .learned-emoji { font-size: var(--font-size-lg, 18px); }
  .learned-actions {
    margin-left: auto;
    display: inline-flex;
    gap: var(--space-2);
  }
  .learned-footer {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-4) 0;
  }

  code {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.92em;
    background: var(--bg-tertiary, var(--bg-primary));
    border: 1px solid var(--separator);
    padding: 0 0.35em;
    border-radius: var(--radius-sm);
  }
</style>

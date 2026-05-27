<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExtensionContext } from 'asyar-sdk/view';

  interface Props { context: ExtensionContext; }
  let { context }: Props = $props();

  let learnedShortcodes = $state<Array<[string, string]>>([]);
  let loading = $state(false);

  async function refresh() {
    loading = true;
    try {
      learnedShortcodes = await context.request<Array<[string, string]>>(
        'emoji.listLearnedShortcodes',
        undefined,
      ) ?? [];
    } catch {
      learnedShortcodes = [];
    } finally {
      loading = false;
    }
  }

  async function promote(shortcode: string) {
    await context.request<void>('emoji.promoteLearned', { shortcode });
    await refresh();
  }

  async function forget(shortcode: string) {
    await context.request<void>('emoji.forgetLearned', { shortcode });
    await refresh();
  }

  async function clearAll() {
    await context.request<void>('emoji.clearLearned', undefined);
    await refresh();
  }

  onMount(() => {
    void refresh();
  });
</script>

<div class="learned-view custom-scrollbar">
  <section class="settings-section">
    <div class="settings-section-header">
      <h2 class="settings-section-title">AI-resolved shortcodes</h2>
      <p class="settings-section-description">
        Patterns the AI fallback has resolved in the last 24h. Promote one to make it a permanent user
        snippet (survives the cache, shows up in your regular Snippets list). Forget one to let AI try again next time.
      </p>
    </div>
    <div class="settings-section-content">
      {#if loading}
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
                  onclick={() => promote(shortcode)}
                >Promote</button>
                <button
                  type="button"
                  class="btn-ghost"
                  title="Drop this entry so AI can try a different match next time"
                  onclick={() => forget(shortcode)}
                >Forget</button>
              </span>
            </li>
          {/each}
        </ul>
        <div class="learned-footer">
          <button type="button" class="btn-danger" onclick={clearAll}>
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

  .learned-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    font-family: var(--font-ui);
    color: var(--text-primary);
    background: var(--bg-primary);
    padding: var(--space-5);
    box-sizing: border-box;
  }

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

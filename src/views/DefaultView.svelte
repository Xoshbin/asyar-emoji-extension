<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    ExtensionContext,
    ExtensionStateProxy,
    IActionService,
    ExtensionAction,
    IExtensionManager,
  } from 'asyar-sdk/view';
  import { ActionContext, searchBarAccessory } from 'asyar-sdk/view';
  import { EMOJIS } from '../data/emojis';
  import { SYMBOLS } from '../data/symbols';
  import { KAOMOJI } from '../data/kaomoji';
  import type { EmojiRecord, SymbolRecord, KaomojiRecord, EmojiCategory } from '../lib/types';
  import { applySkinTone } from '../lib/skinTone';
  import { parseCompose } from '../lib/compose';
  import { formatCodepointsUPlus } from '../lib/unicode';
  import { moveVerticalSelection } from '../lib/gridNavigation';
  import { STATE_KEYS } from '../stateKeys';
  import { readEmojiPreferences } from '../lib/preferencesEffects';

  const EXTENSION_ID = 'org.asyar.emoji';

  interface Props { context: ExtensionContext; }
  let { context }: Props = $props();

  const stateProxy = $derived(context.getService<ExtensionStateProxy>('state'));
  const extensionManager = $derived(context.getService<IExtensionManager>('extensions'));

  // State
  let query = $state('');
  let searchResults = $state<{ emojis: EmojiRecord[]; symbols: SymbolRecord[]; kaomoji: KaomojiRecord[] }>({
    emojis: [], symbols: [], kaomoji: [],
  });
  let selected = $state(0);
  let recents = $state<string[]>([]);
  let favorites = $state<string[]>([]);
  let frequency = $state<Record<string, number>>({});
  let skinTone = $state<0 | 1 | 2 | 3 | 4 | 5>(0);
  let showKaomoji = $state(true);
  let categoryFilter = $state('all');
  let gridContainer: HTMLDivElement | undefined = $state();
  let columnsPerRow = $state(1);

  function measureColumns() {
    if (!gridContainer) return;
    // Read columns from any rendered grid's computed style — works even when
    // the first section (Favorites / Recent) has fewer cells than a full row.
    // `grid-template-columns: repeat(auto-fill, minmax(...))` resolves to a
    // space-separated list of track sizes; counting them gives true columns.
    const grid = gridContainer.querySelector<HTMLElement>('.emoji-grid');
    if (!grid) return;
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim();
    if (!tracks) return;
    columnsPerRow = Math.max(1, tracks.split(/\s+/).length);
  }

  $effect(() => {
    void sections;
    requestAnimationFrame(measureColumns);
  });

  // --- Category sections for empty-query browse view ---
  const CATEGORY_SECTIONS: Array<{ key: EmojiCategory; label: string }> = [
    { key: 'smileys-people', label: 'Smileys & people' },
    { key: 'animals-nature', label: 'Animals & nature' },
    { key: 'food-drink', label: 'Food & drink' },
    { key: 'activity', label: 'Activity' },
    { key: 'travel-places', label: 'Travel & places' },
    { key: 'objects', label: 'Objects' },
    { key: 'symbols', label: 'Symbols' },
    { key: 'flags', label: 'Flags' },
  ];

  // --- Derived sections ---
  type GridItem =
    | { kind: 'emoji'; record: EmojiRecord }
    | { kind: 'symbol'; record: SymbolRecord }
    | { kind: 'kaomoji'; record: KaomojiRecord };

  interface Section {
    label: string;
    items: GridItem[];
  }

  const sections = $derived<Section[]>(buildSections());

  function buildSections(): Section[] {
    const q = query.trim();
    const sr = searchResults;

    if (q.length > 0) {
      // Search mode — sectioned results from worker
      const result: Section[] = [];
      if (sr.emojis.length > 0) {
        result.push({
          label: 'Emojis',
          items: sr.emojis.map(r => ({ kind: 'emoji' as const, record: r })),
        });
      }
      if (sr.symbols.length > 0) {
        result.push({
          label: 'Symbols',
          items: sr.symbols.map(r => ({ kind: 'symbol' as const, record: r })),
        });
      }
      if (showKaomoji && sr.kaomoji.length > 0) {
        result.push({
          label: 'Kaomoji',
          items: sr.kaomoji.map(r => ({ kind: 'kaomoji' as const, record: r })),
        });
      }
      return result;
    }

    // Browse mode — structured sections
    const result: Section[] = [];
    const filter = categoryFilter;

    if ((filter === 'all' || filter === 'favorites') && favorites.length > 0) {
      const items: GridItem[] = favorites
        .map(char => {
          const e = (EMOJIS as EmojiRecord[]).find(r => r.char === char);
          return e ? { kind: 'emoji' as const, record: e } : null;
        })
        .filter((x): x is GridItem => x !== null);
      if (items.length > 0) result.push({ label: 'Favorites', items });
    }

    if ((filter === 'all' || filter === 'frequently-used') && Object.keys(frequency).length > 0) {
      const sorted = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16)
        .map(([char]) => {
          const e = (EMOJIS as EmojiRecord[]).find(r => r.char === char);
          return e ? { kind: 'emoji' as const, record: e } : null;
        })
        .filter((x): x is GridItem => x !== null);
      if (sorted.length > 0) result.push({ label: 'Frequently used', items: sorted });
    }

    if ((filter === 'all' || filter === 'frequently-used') && recents.length > 0) {
      const items: GridItem[] = recents
        .slice(0, 16)
        .map(char => {
          const e = (EMOJIS as EmojiRecord[]).find(r => r.char === char);
          return e ? { kind: 'emoji' as const, record: e } : null;
        })
        .filter((x): x is GridItem => x !== null);
      if (items.length > 0) result.push({ label: 'Recently used', items });
    }

    for (const sec of CATEGORY_SECTIONS) {
      if (filter !== 'all' && filter !== sec.key) continue;
      if (sec.key === 'symbols') {
        const items: GridItem[] = (SYMBOLS as SymbolRecord[]).map(r => ({ kind: 'symbol' as const, record: r }));
        result.push({ label: 'Symbols', items });
      } else {
        const items: GridItem[] = (EMOJIS as EmojiRecord[])
          .filter(r => r.category === sec.key)
          .map(r => ({ kind: 'emoji' as const, record: r }));
        if (items.length > 0) result.push({ label: sec.label, items });
      }
    }

    if (showKaomoji && (filter === 'all' || filter === 'kaomoji')) {
      const items: GridItem[] = (KAOMOJI as KaomojiRecord[]).map(r => ({ kind: 'kaomoji' as const, record: r }));
      result.push({ label: 'Kaomoji', items });
    }

    return result;
  }

  // Flat navigation array — what arrow keys step through
  const flatItems = $derived<GridItem[]>(sections.flatMap(s => s.items));

  // Currently selected item
  const selectedItem = $derived<GridItem | null>(flatItems[selected] ?? null);

  // Compose preview — only for multi-token queries with known top-1 hits
  function computeComposedPreview(q: string): string | null {
    if (q.length === 0) return null;
    return parseCompose(q, (token) => {
      const e = (EMOJIS as EmojiRecord[]).find(
        r => r.name === token || r.shortcode === `:${token}:`,
      );
      if (e) return { char: e.skinToneBase ? applySkinTone(e.char, skinTone) : e.char };
      const k = (KAOMOJI as KaomojiRecord[]).find(r => r.name === token);
      if (k) return { text: k.text };
      return null;
    });
  }

  const composedPreview = $derived<string | null>(computeComposedPreview(query.trim()));

  // Char of selected item (for actions)
  function selectedChar(): string | null {
    const item = selectedItem;
    if (!item) return null;
    if (item.kind === 'emoji') {
      return item.record.skinToneBase ? applySkinTone(item.record.char, skinTone) : item.record.char;
    }
    if (item.kind === 'symbol') return item.record.char;
    if (item.kind === 'kaomoji') return item.record.text;
    return null;
  }

  function selectedRecord(): EmojiRecord | SymbolRecord | null {
    const item = selectedItem;
    if (!item) return null;
    if (item.kind === 'emoji' || item.kind === 'symbol') return item.record;
    return null;
  }

  function selectedShortcode(): string | null {
    const item = selectedItem;
    if (!item) return null;
    if (item.kind === 'emoji') return item.record.shortcode;
    return null;
  }

  function selectedCodepointString(): string | null {
    const cp = selectedCodepoints();
    return cp ? formatCodepointsUPlus(cp) : null;
  }

  function selectedCodepoints(): number[] | null {
    const rec = selectedRecord();
    if (!rec) return null;
    return rec.codepoints;
  }

  function selectedHtmlEntity(): string | null {
    const rec = selectedRecord();
    if (!rec) return null;
    return rec.htmlEntity;
  }

  function selectedIsFavorite(): boolean {
    const char = selectedChar();
    if (!char) return false;
    const item = selectedItem;
    if (!item || item.kind !== 'emoji') return false;
    return favorites.includes(item.record.char);
  }

  // Render a grid item char (with skin tone applied for emojis)
  function itemChar(item: GridItem): string {
    if (item.kind === 'emoji') {
      return item.record.skinToneBase ? applySkinTone(item.record.char, skinTone) : item.record.char;
    }
    if (item.kind === 'symbol') return item.record.char;
    return item.record.text;
  }

  function itemName(item: GridItem): string {
    if (item.kind === 'kaomoji') return item.record.name;
    return item.record.name;
  }

  // Compute flat index from section + item index
  function flatIndex(sectionIdx: number, itemIdx: number): number {
    let idx = 0;
    for (let s = 0; s < sectionIdx; s++) idx += sections[s].items.length;
    return idx + itemIdx;
  }

  // Scroll selected cell into view
  function ensureVisible() {
    requestAnimationFrame(() => {
      const el = gridContainer?.querySelector(`[data-flat-index="${selected}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
  }

  // --- Action implementations ---
  // Clipboard ops live in the view (SDK keeps clipboard view-only). The worker
  // gets a separate `emoji.recordUsage` call to update recents + frequency.
  const clipboard = $derived(context.getService<{
    pasteItem: (entry: { type: 'text'; content: string }) => Promise<void>;
    writeToClipboard: (entry: { type: 'text'; content: string }) => Promise<void>;
  }>('clipboard'));

  function textEntry(content: string) {
    return { type: 'text' as const, content };
  }

  async function doInsert() {
    const char = composedPreview ?? selectedChar();
    if (!char) return;
    await clipboard.pasteItem(textEntry(char));
    // For single-emoji inserts, record usage so it surfaces in Recents.
    if (composedPreview === null) {
      void context.request('emoji.recordUsage', { char });
    }
  }

  async function doCopy() {
    const char = selectedChar();
    if (!char) return;
    await clipboard.writeToClipboard(textEntry(char));
  }

  async function doCopyShortcode() {
    const sc = selectedShortcode();
    if (!sc) return;
    await clipboard.writeToClipboard(textEntry(sc));
  }

  async function doCopyCodepoints() {
    const cp = selectedCodepoints();
    if (!cp) return;
    await clipboard.writeToClipboard(textEntry(formatCodepointsUPlus(cp)));
  }

  async function doCopyHtmlEntity() {
    const he = selectedHtmlEntity();
    if (!he) return;
    await clipboard.writeToClipboard(textEntry(he));
  }

  async function doTogglePin() {
    const item = selectedItem;
    if (!item || item.kind !== 'emoji') return;
    await context.request('emoji.togglePin', { char: item.record.char });
  }

  // -- Message handler (launcher → view)
  function handleMessage(event: MessageEvent) {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'asyar:view:search') {
      query = data.payload?.query ?? '';
      selected = 0;
    }

    if (data.type === 'asyar:view:keydown') {
      const key = data.payload?.key;
      const meta = data.payload?.metaKey || data.payload?.ctrlKey;
      const shift = data.payload?.shiftKey;
      const alt = data.payload?.altKey;

      if (key === 'ArrowRight') {
        selected = Math.min(flatItems.length - 1, selected + 1);
        ensureVisible();
      } else if (key === 'ArrowLeft') {
        selected = Math.max(0, selected - 1);
        ensureVisible();
      } else if (key === 'ArrowDown') {
        selected = moveVerticalSelection(
          sections.map(section => section.items.length),
          selected,
          columnsPerRow,
          'down',
        );
        ensureVisible();
      } else if (key === 'ArrowUp') {
        selected = moveVerticalSelection(
          sections.map(section => section.items.length),
          selected,
          columnsPerRow,
          'up',
        );
        ensureVisible();
      } else if (key === 'Enter') {
        void doInsert();
      } else if (meta && shift && alt && key === 'c') {
        void doCopyHtmlEntity();
      } else if (meta && alt && key === 'c') {
        void doCopyCodepoints();
      } else if (meta && shift && key === 'c') {
        void doCopyShortcode();
      } else if (meta && key === 'c') {
        void doCopy();
      } else if (meta && key === 'p') {
        void doTogglePin();
      }
    }
  }

  // -- Search effect: call worker when query changes
  $effect(() => {
    const q = query.trim();
    if (q.length === 0) {
      searchResults = { emojis: [], symbols: [], kaomoji: [] };
      return;
    }
    void context.request<{ emojis: EmojiRecord[]; symbols: SymbolRecord[]; kaomoji: KaomojiRecord[] }>(
      'emoji.search', { query: q }
    ).then(r => {
      searchResults = r ?? { emojis: [], symbols: [], kaomoji: [] };
      selected = 0;
    }).catch(() => {
      searchResults = { emojis: [], symbols: [], kaomoji: [] };
    });
  });

  // -- Bottom-bar subtitle: show the selected emoji's name beside "Emoji"
  $effect(() => {
    const mgr = extensionManager;
    if (!mgr) return;
    const name = selectedItem ? itemName(selectedItem) : null;
    void mgr.setActiveViewSubtitle(name);
  });

  // -- Lifecycle
  onMount(() => {
    let active = true;
    const cleanup: Array<() => void | Promise<void>> = [];

    window.addEventListener('message', handleMessage);
    cleanup.push(() => window.removeEventListener('message', handleMessage));

    requestAnimationFrame(() => {
      if (gridContainer && typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => measureColumns());
        ro.observe(gridContainer);
        measureColumns();
        cleanup.push(() => { ro.disconnect(); });
      }
    });

    const sp = stateProxy;

    (async () => {
      const [
        initRecents, unsubRecents,
        initFavs, unsubFavs,
        initFreq, unsubFreq,
      ] = await Promise.all([
        sp.get(STATE_KEYS.recents),
        sp.subscribe(STATE_KEYS.recents, (v) => {
          if (!active) return;
          recents = Array.isArray(v) ? (v as string[]) : [];
        }),
        sp.get(STATE_KEYS.favorites),
        sp.subscribe(STATE_KEYS.favorites, (v) => {
          if (!active) return;
          favorites = Array.isArray(v) ? (v as string[]) : [];
        }),
        sp.get(STATE_KEYS.frequency),
        sp.subscribe(STATE_KEYS.frequency, (v) => {
          if (!active) return;
          frequency = (v && typeof v === 'object' && !Array.isArray(v))
            ? (v as Record<string, number>)
            : {};
        }),
      ]);

      if (!active) {
        void unsubRecents(); void unsubFavs(); void unsubFreq();
        return;
      }

      recents = Array.isArray(initRecents) ? (initRecents as string[]) : [];
      favorites = Array.isArray(initFavs) ? (initFavs as string[]) : [];
      frequency = (initFreq && typeof initFreq === 'object' && !Array.isArray(initFreq))
        ? (initFreq as Record<string, number>)
        : {};

      cleanup.push(unsubRecents, unsubFavs, unsubFreq);
    })();

    const applyPrefs = () => {
      const next = readEmojiPreferences(
        context.preferences.values as Record<string, unknown>,
      );
      skinTone = next.skinTone;
      showKaomoji = next.showKaomoji;
    };
    applyPrefs();
    const unsubPrefs = context.onPreferencesChanged(() => {
      if (!active) return;
      applyPrefs();
    });
    cleanup.push(unsubPrefs);

    const offAccessory = searchBarAccessory.onChange((value: string) => {
      categoryFilter = value || 'all';
      selected = 0;
    });
    cleanup.push(offAccessory);

    const actions = context.getService<IActionService>('actions');
    const viewActions: ExtensionAction[] = [
      {
        id: `${EXTENSION_ID}:insert`,
        title: 'Insert at cursor',
        description: 'Insert the selected emoji or symbol at the cursor position.',
        icon: '⏎',
        category: 'Primary',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⏎',
        execute: doInsert,
      },
      {
        id: `${EXTENSION_ID}:copy`,
        title: 'Copy emoji',
        description: 'Copy the selected emoji or symbol to the clipboard.',
        icon: '📋',
        category: 'Share',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⌘C',
        execute: doCopy,
      },
      {
        id: `${EXTENSION_ID}:copy-shortcode`,
        title: 'Copy shortcode',
        description: 'Copy the :shortcode: for the selected emoji.',
        icon: '🔤',
        category: 'Share',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⌘⇧C',
        execute: doCopyShortcode,
      },
      {
        id: `${EXTENSION_ID}:copy-codepoints`,
        title: 'Copy U+ codepoints',
        description: 'Copy the Unicode codepoint(s) for the selected character.',
        icon: '🔣',
        category: 'Share',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⌘⌥C',
        execute: doCopyCodepoints,
      },
      {
        id: `${EXTENSION_ID}:copy-html-entity`,
        title: 'Copy HTML entity',
        description: 'Copy the HTML entity for the selected character.',
        icon: '🏷️',
        category: 'Share',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⌘⌥⇧C',
        execute: doCopyHtmlEntity,
      },
      {
        id: `${EXTENSION_ID}:toggle-pin`,
        title: 'Pin / unpin',
        description: 'Pin or unpin the selected emoji to your Favorites.',
        icon: '📌',
        category: 'Edit',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⌘P',
        execute: doTogglePin,
      },
    ];

    for (const a of viewActions) actions.registerAction(a);

    return () => {
      active = false;
      for (const fn of cleanup) {
        try { void fn(); } catch { /* */ }
      }
    };
  });
</script>

<div class="emoji-view">
  <!-- Compose preview row -->
  {#if composedPreview !== null}
    <div class="compose-preview">
      <span class="compose-chars">{composedPreview}</span>
      <span class="compose-hint">⏎ Insert as sequence</span>
    </div>
  {/if}

  <!-- Sections -->
  <div class="sections-scroll custom-scrollbar" bind:this={gridContainer}>
    {#if sections.length === 0}
      <div class="empty-state">
        <span>No emoji matching "{query}"</span>
      </div>
    {:else}
      {#each sections as section, sectionIdx (section.label)}
        <div class="section">
          <div class="section-header">{section.label}</div>
          <div class="emoji-grid">
            {#each section.items as item, itemIdx (itemIdx)}
              {@const fi = flatIndex(sectionIdx, itemIdx)}
              {@const isSelected = selected === fi}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_interactive_supports_focus -->
              <div
                class="grid-cell"
                class:grid-cell-selected={isSelected}
                data-flat-index={fi}
                role="gridcell"
                aria-selected={isSelected}
                tabindex="-1"
                title={itemName(item)}
                onclick={() => { selected = fi; void doInsert(); }}
                onmouseenter={() => { selected = fi; }}
              >
                <span
                  class="cell-char"
                  class:cell-char--kaomoji={item.kind === 'kaomoji'}
                >
                  {itemChar(item)}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>

</div>

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  :global(#app) {
    height: 100%;
    width: 100%;
  }

  .emoji-view {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    font-family: var(--font-ui);
    color: var(--text-primary);
    background: var(--bg-primary);
    overflow: hidden;
  }

  /* Compose preview */
  .compose-preview {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--separator);
    flex-shrink: 0;
  }

  .compose-chars {
    font-size: var(--font-size-xl);
    line-height: 1;
    letter-spacing: var(--space-2);
  }

  .compose-hint {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin-left: auto;
  }

  /* Scrollable section area */
  .sections-scroll {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) 0 var(--space-4);
  }

  /* Section */
  .section {
    margin-bottom: var(--space-4);
  }

  .section-header {
    position: sticky;
    top: 0;
    z-index: var(--z-base);
    padding: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-2) 0;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--text-tertiary);
    background: var(--bg-primary);
    backdrop-filter: blur(16px);
  }

  /* Emoji grid — Raycast feel: rounded card tiles with background & generous gaps */
  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.25rem, 1fr));
    gap: var(--space-3);
    padding: 0 var(--space-4);
  }

  /* Grid cell: rounded card tile with background */
  .grid-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-xl);
    cursor: default;
    background: var(--bg-secondary);
    border: 1.5px solid var(--border-color);
    box-shadow: var(--shadow-xs);
    transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
  }

  .grid-cell:hover {
    background: var(--bg-hover);
    border-color: color-mix(in srgb, var(--accent-primary) 30%, var(--border-color));
  }

  .grid-cell.grid-cell-selected {
    background: var(--bg-selected);
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 1px var(--accent-primary), var(--shadow-sm);
  }

  .cell-char {
    font-size: 2.125rem;
    line-height: 1;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
  }

  .cell-char--kaomoji {
    font-size: var(--font-size-base);
    line-height: 1.25;
    overflow-wrap: anywhere;
    filter: none;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-3);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    padding: var(--space-10) var(--space-5);
    text-align: center;
  }
</style>

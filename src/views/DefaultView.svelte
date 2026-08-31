<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    ExtensionContext,
    ExtensionStateProxy,
    IActionService,
    ExtensionAction,
  } from 'asyar-sdk/view';
  import { ActionContext } from 'asyar-sdk/view';
  import { EMOJIS } from '../data/emojis';
  import { SYMBOLS } from '../data/symbols';
  import { KAOMOJI } from '../data/kaomoji';
  import type { EmojiRecord, SymbolRecord, KaomojiRecord, EmojiCategory } from '../lib/types';
  import { applySkinTone, FITZPATRICK_MODIFIERS } from '../lib/skinTone';
  import { parseCompose } from '../lib/compose';
  import { moveVerticalSelection } from '../lib/gridNavigation';
  import { STATE_KEYS } from '../stateKeys';
  import { readEmojiPreferences } from '../lib/preferencesEffects';

  const EXTENSION_ID = 'org.asyar.emoji';

  interface Props { context: ExtensionContext; }
  let { context }: Props = $props();

  const stateProxy = $derived(context.getService<ExtensionStateProxy>('state'));

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
  let showSkinToneStrip = $state(false);
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
    { key: 'smileys-people', label: 'Smileys & People' },
    { key: 'animals-nature', label: 'Animals & Nature' },
    { key: 'food-drink', label: 'Food & Drink' },
    { key: 'activity', label: 'Activity' },
    { key: 'travel-places', label: 'Travel & Places' },
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

    if (favorites.length > 0) {
      const items: GridItem[] = favorites
        .map(char => {
          const e = (EMOJIS as EmojiRecord[]).find(r => r.char === char);
          return e ? { kind: 'emoji' as const, record: e } : null;
        })
        .filter((x): x is GridItem => x !== null);
      if (items.length > 0) result.push({ label: 'Favorites', items });
    }

    if (Object.keys(frequency).length > 0) {
      const sorted = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16)
        .map(([char]) => {
          const e = (EMOJIS as EmojiRecord[]).find(r => r.char === char);
          return e ? { kind: 'emoji' as const, record: e } : null;
        })
        .filter((x): x is GridItem => x !== null);
      if (sorted.length > 0) result.push({ label: 'Frequently Used', items: sorted });
    }

    if (recents.length > 0) {
      const items: GridItem[] = recents
        .slice(0, 16)
        .map(char => {
          const e = (EMOJIS as EmojiRecord[]).find(r => r.char === char);
          return e ? { kind: 'emoji' as const, record: e } : null;
        })
        .filter((x): x is GridItem => x !== null);
      if (items.length > 0) result.push({ label: 'Recent', items });
    }

    for (const sec of CATEGORY_SECTIONS) {
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

    if (showKaomoji) {
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

  function selectedIsSkinToneBase(): boolean {
    const item = selectedItem;
    if (!item || item.kind !== 'emoji') return false;
    return !!item.record.skinToneBase;
  }

  function selectedIsFavorite(): boolean {
    const char = selectedChar();
    if (!char) return false;
    const item = selectedItem;
    if (!item || item.kind !== 'emoji') return false;
    return favorites.includes(item.record.char);
  }

  // -- Skin tone swatches
  const SKIN_TONE_LABELS = ['Default', 'Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'];

  function renderWithTone(char: string, tone: 0 | 1 | 2 | 3 | 4 | 5): string {
    return applySkinTone(char, tone);
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
    const formatted = cp.map((c) => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
    await clipboard.writeToClipboard(textEntry(formatted));
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

  function doOpenSkinToneStrip() {
    if (!selectedIsSkinToneBase()) return;
    showSkinToneStrip = !showSkinToneStrip;
  }

  async function doSetSkinTone(tone: 0 | 1 | 2 | 3 | 4 | 5) {
    skinTone = tone;
    showSkinToneStrip = false;
    await context.preferences.set('extension', 'skinTone', String(tone));
  }

  // -- Message handler (launcher → view)
  function handleMessage(event: MessageEvent) {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'asyar:view:search') {
      query = data.payload?.query ?? '';
      selected = 0;
      showSkinToneStrip = false;
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
      } else if (meta && key === 't') {
        doOpenSkinToneStrip();
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

    const actions = context.getService<IActionService>('actions');
    const viewActions: ExtensionAction[] = [
      {
        id: `${EXTENSION_ID}:insert`,
        title: 'Insert at Cursor',
        description: 'Insert the selected emoji or symbol at the cursor position.',
        icon: '⏎',
        category: 'Primary',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '↵',
        execute: doInsert,
      },
      {
        id: `${EXTENSION_ID}:copy`,
        title: 'Copy Emoji',
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
        title: 'Copy Shortcode',
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
        title: 'Copy U+ Codepoints',
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
        title: 'Copy HTML Entity',
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
        title: 'Pin / Unpin',
        description: 'Pin or unpin the selected emoji to your Favorites.',
        icon: '📌',
        category: 'Edit',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⌘P',
        execute: doTogglePin,
      },
      {
        id: `${EXTENSION_ID}:skin-tone`,
        title: 'Set Default Skin Tone',
        description: 'Open the skin-tone picker for the selected emoji.',
        icon: '🖐️',
        category: 'Edit',
        extensionId: EXTENSION_ID,
        context: ActionContext.EXTENSION_VIEW,
        shortcut: '⌘T',
        execute: () => { doOpenSkinToneStrip(); },
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

  <!-- Skin tone strip -->
  {#if showSkinToneStrip}
    <div class="skin-tone-strip" role="toolbar" aria-label="Skin tone">
      {#each FITZPATRICK_MODIFIERS as _mod, i}
        {@const tone = i as 0 | 1 | 2 | 3 | 4 | 5}
        {@const previewChar = selectedItem?.kind === 'emoji' ? renderWithTone(selectedItem.record.char, tone) : '👋'}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <div
          class="tone-swatch"
          class:tone-active={skinTone === tone}
          role="button"
          title={SKIN_TONE_LABELS[i]}
          onclick={() => doSetSkinTone(tone)}
        >
          {previewChar}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Sections -->
  <div class="sections-scroll custom-scrollbar" bind:this={gridContainer}>
    {#if sections.length === 0}
      <div class="empty-state">
        <span class="empty-icon">🔍</span>
        <span>No results for "{query}"</span>
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
                <span class="cell-char">{itemChar(item)}</span>
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

  /* Skin tone strip */
  .skin-tone-strip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--separator);
    flex-shrink: 0;
  }

  .tone-swatch {
    font-size: var(--font-size-xl);
    width: var(--space-9);
    height: var(--space-9);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    cursor: default;
    transition: background var(--transition-fast);
    border: 2px solid transparent;
  }

  .tone-swatch:hover {
    background: var(--bg-hover);
  }

  .tone-swatch.tone-active {
    border-color: var(--accent-primary);
    background: var(--bg-selected);
  }

  /* Scrollable section area */
  .sections-scroll {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) 0 var(--space-4);
  }

  /* Section */
  .section {
    margin-bottom: var(--space-3);
  }

  .section-header {
    padding: var(--space-3) var(--space-5) var(--space-2);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 1;
  }

  /* Emoji grid */
  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
    gap: var(--space-1);
    padding: 0 var(--space-4);
  }

  /* Grid cell */
  .grid-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    cursor: default;
    transition: background var(--transition-fast);
    border: 2px solid transparent;
  }

  .grid-cell:hover {
    background: var(--bg-hover);
  }

  .grid-cell.grid-cell-selected {
    background: var(--bg-selected);
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-focus);
  }

  .cell-char {
    font-size: var(--font-size-xl);
    line-height: 1;
    user-select: none;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-3);
    color: var(--text-tertiary);
    font-size: var(--font-size-sm);
    padding: var(--space-10) var(--space-5);
    text-align: center;
  }

  .empty-icon {
    font-size: var(--font-size-display);
    opacity: 0.5;
  }
</style>

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../manifest.json';

const ROOT = join(__dirname, '..');

const PERMISSION_FOR_API: Record<string, string> = {
  registerTool: 'tools:register',
  unregisterTool: 'tools:register',
  writeToClipboard: 'clipboard:write',
  pasteItem: 'clipboard:write',
  registerShortcodes: 'snippets:contribute',
  unregisterShortcodes: 'snippets:contribute',
};

describe('manifest permissions contract', () => {
  // Scan both extension iframes — clipboard ops live in the view (SDK keeps
  // clipboard view-only), while tools + snippets register from the worker.
  const workerSrc = readFileSync(join(ROOT, 'src/worker.ts'), 'utf8');
  const viewSrc = readFileSync(join(ROOT, 'src/views/DefaultView.svelte'), 'utf8');
  const extensionSrc = workerSrc + '\n' + viewSrc;
  const declared = new Set<string>(manifest.permissions);

  it('every API call in extension source has its permission declared in manifest', () => {
    for (const [api, perm] of Object.entries(PERMISSION_FOR_API)) {
      const re = new RegExp(`\\.${api}\\s*\\(`);
      if (re.test(extensionSrc)) {
        expect(declared, `extension calls ${api} but manifest does not declare "${perm}"`).toContain(perm);
      }
    }
  });

  it('every declared permission corresponds to at least one extension API call', () => {
    for (const perm of declared) {
      const apisForPerm = Object.entries(PERMISSION_FOR_API)
        .filter(([, p]) => p === perm)
        .map(([api]) => api);
      const usedAny = apisForPerm.some(api => new RegExp(`\\.${api}\\s*\\(`).test(extensionSrc));
      expect(usedAny, `manifest declares "${perm}" but extension uses none of ${apisForPerm.join(', ')}`).toBe(true);
    }
  });

  it('emoji_find tool is registered (manifest tools[] aligns with worker)', () => {
    const toolIds = (manifest.tools ?? []).map((t: { id: string }) => t.id);
    expect(toolIds).toContain('emoji_find');
    expect(workerSrc).toMatch(/emoji_find|aiToolDefinition/);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHORTCODE_PATTERN } from 'asyar-sdk/contracts/snippets';

describe('shortcode pattern parity', () => {
  it('SDK SHORTCODE_PATTERN regex string matches the Rust regex literal in snippets.rs', () => {
    const rust = readFileSync(
      join(__dirname, '../../../asyar-launcher/src-tauri/src/snippets.rs'),
      'utf8',
    );
    const SDK_SOURCE = SHORTCODE_PATTERN.source;
    expect(SDK_SOURCE).toBe('^:[a-z0-9_+-]{1,32}:$');
    expect(rust).toContain(`r"${SDK_SOURCE}"`);
  });
});

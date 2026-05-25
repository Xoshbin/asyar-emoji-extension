import { describe, it, expect } from 'vitest';
import { applySkinTone, FITZPATRICK_MODIFIERS } from './skinTone';

describe('skinTone', () => {
  it('tone 0 returns the base char unchanged', () => {
    expect(applySkinTone('👍', 0)).toBe('👍');
  });

  it('tone 1 inserts the light modifier after first codepoint', () => {
    const out = applySkinTone('👍', 1);
    expect(out).toBe('👍🏻');
  });

  it('tone 5 inserts the dark modifier', () => {
    const out = applySkinTone('👍', 5);
    expect(out).toBe('👍🏿');
  });

  it('FITZPATRICK_MODIFIERS has 6 entries (0 = null, 1-5 = modifiers)', () => {
    expect(FITZPATRICK_MODIFIERS).toHaveLength(6);
    expect(FITZPATRICK_MODIFIERS[0]).toBeNull();
    expect(FITZPATRICK_MODIFIERS[3]).toBe('\u{1F3FD}');
  });
});

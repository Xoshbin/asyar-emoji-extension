import { describe, it, expect } from 'vitest';
import { parseCompose } from './compose';

describe('parseCompose', () => {
  const HITS: Record<string, { char: string }> = {
    fire: { char: '🔥' },
    star: { char: '⭐' },
    heart: { char: '❤️' },
  };
  const lookup = (t: string) => HITS[t] ?? null;

  it('returns null for single-token query (not compose mode)', () => {
    expect(parseCompose('fire', lookup)).toBeNull();
  });

  it('returns composed sequence when all tokens have confident matches', () => {
    expect(parseCompose('fire star heart', lookup)).toBe('🔥⭐❤️');
  });

  it('returns null when any token has no match', () => {
    expect(parseCompose('fire xxxxx heart', lookup)).toBeNull();
  });

  it('returns null when query has special chars (non-alphanumeric)', () => {
    expect(parseCompose('fire star,heart', lookup)).toBeNull();
  });

  it('handles multiple spaces between tokens gracefully', () => {
    expect(parseCompose('fire  star  heart', lookup)).toBe('🔥⭐❤️');
  });

  it('returns null on empty query', () => {
    expect(parseCompose('', lookup)).toBeNull();
  });
});

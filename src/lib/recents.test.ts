import { describe, it, expect } from 'vitest';
import { pushRecent, RECENTS_MAX } from './recents';

describe('recents', () => {
  it('prepends a new entry', () => {
    expect(pushRecent([], '🎉')).toEqual(['🎉']);
    expect(pushRecent(['❤️'], '🎉')).toEqual(['🎉', '❤️']);
  });

  it('moves existing entry to front (LRU dedup)', () => {
    expect(pushRecent(['❤️', '🎉', '🔥'], '🎉')).toEqual(['🎉', '❤️', '🔥']);
  });

  it('caps at RECENTS_MAX entries', () => {
    const long = Array.from({ length: RECENTS_MAX }, (_, i) => `c${i}`);
    const out = pushRecent(long, 'new');
    expect(out.length).toBe(RECENTS_MAX);
    expect(out[0]).toBe('new');
    expect(out).not.toContain(`c${RECENTS_MAX - 1}`);
  });
});

import { describe, it, expect } from 'vitest';
import { buildEmojiFindHandler, type EmojiFindResult } from './emojiFind';
import type { EmojiRecord } from '../types';

const RECORDS: EmojiRecord[] = [
  {
    char: '❤️', name: 'red heart', shortcode: ':red_heart:',
    category: 'smileys-people' as never, keywords: ['love', 'valentine'],
    codepoints: [0x2764], htmlEntity: '&#10084;',
  },
  {
    char: '🎉', name: 'party popper', shortcode: ':tada:',
    category: 'activity' as never, keywords: ['party', 'celebration'],
    codepoints: [0x1F389], htmlEntity: '&#127881;',
  },
  {
    char: '🔥', name: 'fire', shortcode: ':fire:',
    category: 'animals-nature' as never, keywords: ['flame', 'burn', 'hot'],
    codepoints: [0x1F525], htmlEntity: '&#128293;',
  },
];

describe('emoji_find handler', () => {
  it('returns same shape as ranker (char, name, shortcode)', async () => {
    const handler = buildEmojiFindHandler(RECORDS, () => new Map());
    const r = await handler({ description: 'love', limit: 3 });
    expect(Array.isArray(r)).toBe(true);
    expect(r[0]).toEqual(expect.objectContaining({
      char: expect.any(String),
      name: expect.any(String),
      shortcode: expect.any(String),
    }));
  });

  it('strips internal fields (keywords, codepoints, etc.) — minimal payload', async () => {
    const handler = buildEmojiFindHandler(RECORDS, () => new Map());
    const r = await handler({ description: 'love' }) as EmojiFindResult[];
    expect(r[0]).not.toHaveProperty('keywords');
    expect(r[0]).not.toHaveProperty('codepoints');
    expect(r[0]).not.toHaveProperty('htmlEntity');
    expect(Object.keys(r[0]).sort()).toEqual(['char', 'name', 'shortcode']);
  });

  it('defaults limit to 8', async () => {
    const many: EmojiRecord[] = Array.from({ length: 30 }, (_, i) => ({
      char: `c${i}`, name: 'aaa', shortcode: `:c${i}:`,
      category: 'objects' as never, keywords: [],
      codepoints: [0x61], htmlEntity: '&#97;',
    }));
    const handler = buildEmojiFindHandler(many, () => new Map());
    const r = await handler({ description: 'aaa' }) as EmojiFindResult[];
    expect(r.length).toBe(8);
  });

  it('caps limit at 20 even if caller asks for more', async () => {
    const many: EmojiRecord[] = Array.from({ length: 30 }, (_, i) => ({
      char: `c${i}`, name: 'aaa', shortcode: `:c${i}:`,
      category: 'objects' as never, keywords: [],
      codepoints: [0x61], htmlEntity: '&#97;',
    }));
    const handler = buildEmojiFindHandler(many, () => new Map());
    const r = await handler({ description: 'aaa', limit: 999 }) as EmojiFindResult[];
    expect(r.length).toBe(20);
  });

  it('respects explicit limit when within range', async () => {
    const handler = buildEmojiFindHandler(RECORDS, () => new Map());
    const r = await handler({ description: 'fire', limit: 1 }) as EmojiFindResult[];
    expect(r.length).toBeLessThanOrEqual(1);
  });

  it('returns empty array on no-match', async () => {
    const handler = buildEmojiFindHandler(RECORDS, () => new Map());
    const r = await handler({ description: 'zzzzz' }) as EmojiFindResult[];
    expect(r).toEqual([]);
  });

  it('honors frequency tiebreak via getFrequency callback', async () => {
    const handler = buildEmojiFindHandler(RECORDS, () => new Map([['🎉', 100]]));
    const r = await handler({ description: 'p', limit: 2 }) as EmojiFindResult[];
    expect(r[0]?.char).toBe('🎉');
  });
});

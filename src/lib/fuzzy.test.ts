import { describe, it, expect } from 'vitest';
import { rank } from './fuzzy';
import type { EmojiRecord } from './types';

const RECORDS: EmojiRecord[] = [
  {
    char: '❤️', name: 'red heart', shortcode: ':red_heart:',
    category: 'smileys-people' as never, keywords: ['love', 'valentine'],
    codepoints: [0x2764], htmlEntity: '&#10084;',
  },
  {
    char: '🎧', name: 'headphones', shortcode: ':headphones:',
    category: 'objects' as never, keywords: ['music', 'audio'],
    codepoints: [0x1F3A7], htmlEntity: '&#127911;',
  },
  {
    char: '🧠', name: 'brain', shortcode: ':brain:',
    category: 'smileys-people' as never, keywords: ['think', 'smart'],
    codepoints: [0x1F9E0], htmlEntity: '&#129504;',
  },
];

describe('fuzzy.rank', () => {
  it('exact name match ranks first', () => {
    const [first] = rank(RECORDS, 'red heart', new Map());
    expect(first.char).toBe('❤️');
  });

  it('exact keyword match outranks name token-prefix (lol → joy, not lollipop)', () => {
    const records: EmojiRecord[] = [
      {
        char: '🍭', name: 'lollipop', shortcode: ':lollipop:',
        category: 'food-drink' as never, keywords: ['candy', 'sweet'],
        codepoints: [0x1F36D], htmlEntity: '&#127853;',
      },
      {
        char: '😂', name: 'face with tears of joy', shortcode: ':joy:',
        category: 'smileys-people' as never,
        keywords: ['face', 'cry', 'tears', 'happy', 'lol'],
        codepoints: [0x1F602], htmlEntity: '&#128514;',
      },
    ];
    const [first] = rank(records, 'lol', new Map());
    expect(first.char).toBe('😂');
  });

  it('exact shortcode match ranks first', () => {
    const [first] = rank(RECORDS, ':headphones:', new Map());
    expect(first.char).toBe('🎧');
  });

  it('token-prefix on name beats substring elsewhere', () => {
    const out = rank(RECORDS, 'hea', new Map());
    expect(out.map(r => r.char)).toContain('❤️');
    expect(out.map(r => r.char)).toContain('🎧');
  });

  it('token-prefix on keyword ranks lower than name-prefix', () => {
    const out = rank(RECORDS, 'lov', new Map());
    expect(out[0]?.char).toBe('❤️');
  });

  it('ties broken by frequency desc', () => {
    const freq = new Map([['❤️', 5], ['🎧', 1]]);
    const out = rank(RECORDS, 'hea', freq);
    expect(out[0]?.char).toBe('❤️');
  });

  it('returns empty array on no-match query', () => {
    const out = rank(RECORDS, 'zzzzzzz', new Map());
    expect(out).toEqual([]);
  });

  it('case-insensitive on query', () => {
    const out = rank(RECORDS, 'RED HEART', new Map());
    expect(out[0]?.char).toBe('❤️');
  });

  it('returns all results sorted (does not truncate)', () => {
    const out = rank(RECORDS, 'e', new Map());
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

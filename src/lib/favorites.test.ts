import { describe, it, expect } from 'vitest';
import { toggleFavorite, isFavorite } from './favorites';

describe('favorites', () => {
  it('adds when absent', () => {
    expect(toggleFavorite([], '🎉')).toEqual(['🎉']);
  });
  it('removes when present', () => {
    expect(toggleFavorite(['🎉'], '🎉')).toEqual([]);
  });
  it('preserves order of others when removing', () => {
    expect(toggleFavorite(['❤️', '🎉', '🔥'], '🎉')).toEqual(['❤️', '🔥']);
  });
  it('isFavorite reports membership', () => {
    expect(isFavorite(['🎉'], '🎉')).toBe(true);
    expect(isFavorite(['🎉'], '❤️')).toBe(false);
  });
});

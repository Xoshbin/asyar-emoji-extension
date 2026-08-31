import { describe, expect, it } from 'vitest';
import { moveVerticalSelection } from './gridNavigation';

describe('moveVerticalSelection', () => {
  it('keeps the selection when there are no sections', () => {
    expect(moveVerticalSelection([], 0, 4, 'down')).toBe(0);
  });

  it('recovers when a section change makes the selection stale', () => {
    expect(moveVerticalSelection([2, 2], 4, 4, 'down')).toBe(3);
    expect(moveVerticalSelection([2, 2], 4, 4, 'up')).toBe(1);
  });

  it('moves from a single favorite to the first frequently used item below it', () => {
    expect(moveVerticalSelection([1, 16], 0, 16, 'down')).toBe(1);
  });

  it('moves back up from the first item to the single item above it', () => {
    expect(moveVerticalSelection([1, 16], 1, 16, 'up')).toBe(0);
  });

  it('preserves the column across section boundaries in both directions', () => {
    expect(moveVerticalSelection([8, 8], 5, 8, 'down')).toBe(13);
    expect(moveVerticalSelection([8, 8], 13, 8, 'up')).toBe(5);
  });

  it('preserves the column between rows in the same section', () => {
    expect(moveVerticalSelection([10], 1, 4, 'down')).toBe(5);
    expect(moveVerticalSelection([10], 5, 4, 'up')).toBe(1);
  });

  it('clamps to the last item when the target row is shorter', () => {
    expect(moveVerticalSelection([6], 3, 4, 'down')).toBe(5);
    expect(moveVerticalSelection([4, 2], 3, 4, 'down')).toBe(5);
    expect(moveVerticalSelection([10, 4], 13, 4, 'up')).toBe(9);
  });

  it('keeps the selection at the outer vertical boundaries', () => {
    expect(moveVerticalSelection([6], 0, 4, 'up')).toBe(0);
    expect(moveVerticalSelection([6], 4, 4, 'down')).toBe(4);
  });
});

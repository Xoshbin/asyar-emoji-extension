import { describe, it, expect } from 'vitest';
import { formatCodepointsUPlus, formatHtmlEntity, formatShortcode } from './unicode';

describe('unicode', () => {
  it('U+ format with single codepoint', () => {
    expect(formatCodepointsUPlus([0x2764])).toBe('U+2764');
  });

  it('U+ format with multiple codepoints space-separated', () => {
    expect(formatCodepointsUPlus([0x2764, 0xFE0F])).toBe('U+2764 U+FE0F');
  });

  it('U+ format with supplementary plane codepoints (5-digit hex)', () => {
    expect(formatCodepointsUPlus([0x1F3A7])).toBe('U+1F3A7');
  });

  it('HTML entity single codepoint', () => {
    expect(formatHtmlEntity([0x2764])).toBe('&#10084;');
  });

  it('HTML entity multi-codepoint (ZWJ-style sequence concat)', () => {
    expect(formatHtmlEntity([0x2764, 0xFE0F])).toBe('&#10084;&#65039;');
  });

  it('shortcode formats name with lowercase + underscores', () => {
    expect(formatShortcode('red heart')).toBe(':red_heart:');
  });

  it('shortcode collapses non-alphanumeric to underscore', () => {
    expect(formatShortcode('person golfing: medium-light skin tone')).toBe(':person_golfing_medium_light_skin_tone:');
  });
});

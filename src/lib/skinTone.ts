export const FITZPATRICK_MODIFIERS: (string | null)[] = [
  null,           // 0 = default
  '\u{1F3FB}',    // 1 = light
  '\u{1F3FC}',    // 2 = medium-light
  '\u{1F3FD}',    // 3 = medium
  '\u{1F3FE}',    // 4 = medium-dark
  '\u{1F3FF}',    // 5 = dark
];

export function applySkinTone(baseChar: string, tone: 0 | 1 | 2 | 3 | 4 | 5): string {
  const modifier = FITZPATRICK_MODIFIERS[tone];
  if (!modifier) return baseChar;
  const first = String.fromCodePoint(baseChar.codePointAt(0)!);
  const rest = baseChar.slice(first.length);
  return first + modifier + rest;
}

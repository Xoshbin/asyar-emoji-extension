export function formatCodepointsUPlus(codepoints: number[]): string {
  return codepoints.map(c => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
}

export function formatHtmlEntity(codepoints: number[]): string {
  return codepoints.map(c => `&#${c};`).join('');
}

export function formatShortcode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `:${slug}:`;
}

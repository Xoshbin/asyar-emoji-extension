export function toggleFavorite(prev: string[], char: string): string[] {
  if (prev.includes(char)) return prev.filter(c => c !== char);
  return [...prev, char];
}

export function isFavorite(prev: string[], char: string): boolean {
  return prev.includes(char);
}

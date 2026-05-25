export const RECENTS_MAX = 32;

export function pushRecent(prev: string[], char: string): string[] {
  const filtered = prev.filter(c => c !== char);
  const next = [char, ...filtered];
  return next.slice(0, RECENTS_MAX);
}

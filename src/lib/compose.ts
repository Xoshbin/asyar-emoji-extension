const COMPOSE_RE = /^[\w]+(\s+[\w]+)+$/;

export function parseCompose(
  query: string,
  lookupToken: (token: string) => { char?: string; text?: string } | null,
): string | null {
  if (!COMPOSE_RE.test(query.trim())) return null;
  const tokenList = query.trim().split(/\s+/);
  const chars: string[] = [];
  for (const t of tokenList) {
    const hit = lookupToken(t);
    if (!hit) return null;
    chars.push(hit.char ?? hit.text ?? '');
  }
  return chars.join('');
}

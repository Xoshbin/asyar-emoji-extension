export interface RankableRecord {
  name: string;
  keywords: string[];
  shortcode?: string;
}

const SCORE_EXACT_NAME = 1000;
const SCORE_EXACT_SHORTCODE = 1000;
// An exact keyword match (query token equals a keyword token) outranks a
// name-prefix match — `lol` should surface 😂 (keyword) above 🍭 (name prefix).
const SCORE_EXACT_KEYWORD = 800;
const SCORE_TOKEN_PREFIX_NAME = 100;
const SCORE_TOKEN_PREFIX_KEYWORD = 50;
const SCORE_SUBSTRING = 10;

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[\s_-]+/).filter(Boolean);
}

export function rank<T extends { name: string; keywords: string[]; shortcode?: string; char?: string; text?: string }>(
  records: T[],
  query: string,
  frequency: Map<string, number>,
): T[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const qTokens = tokens(q);

  const scored: Array<{ record: T; score: number }> = [];
  for (const r of records) {
    let score = 0;
    const name = r.name.toLowerCase();
    const nameTokens = tokens(r.name);
    const kwTokens = r.keywords.flatMap(tokens);

    if (name === q) score = Math.max(score, SCORE_EXACT_NAME);
    if (r.shortcode && r.shortcode.toLowerCase() === q) score = Math.max(score, SCORE_EXACT_SHORTCODE);

    for (const t of qTokens) {
      if (kwTokens.some(k => k === t)) score = Math.max(score, SCORE_EXACT_KEYWORD);
      else if (nameTokens.some(n => n.startsWith(t))) score = Math.max(score, SCORE_TOKEN_PREFIX_NAME);
      else if (kwTokens.some(k => k.startsWith(t))) score = Math.max(score, SCORE_TOKEN_PREFIX_KEYWORD);
      else if (name.includes(t) || r.keywords.some(k => k.toLowerCase().includes(t))) {
        score = Math.max(score, SCORE_SUBSTRING);
      }
    }

    if (score > 0) scored.push({ record: r, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const charA = a.record.char ?? a.record.text ?? '';
    const charB = b.record.char ?? b.record.text ?? '';
    const freqA = frequency.get(charA) ?? 0;
    const freqB = frequency.get(charB) ?? 0;
    if (freqB !== freqA) return freqB - freqA;
    return a.record.name.localeCompare(b.record.name);
  });

  return scored.map(s => s.record);
}

/**
 * Score how well `query` matches `text`; null means no match. Higher is better.
 * Substring matches beat scattered subsequence matches; earlier and word-start hits score higher.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()
  if (!q) return 0
  const idx = t.indexOf(q)
  if (idx !== -1) return 1000 - idx + (idx === 0 || t[idx - 1] === ' ' ? 100 : 0)

  let score = 0
  let ti = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found === -1) return null
    score += found === ti ? 5 : found === 0 || t[found - 1] === ' ' ? 3 : 1
    ti = found + 1
  }
  return score
}

export function fuzzyFilter<T>(query: string, items: T[], text: (item: T) => string, limit = 8): T[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, text(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item)
}

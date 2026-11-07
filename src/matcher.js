import { CATEGORIES } from './queries.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function termRegex(term) {
  const isAcronym = /^[A-Z]{2,6}$/.test(term);
  // Treat "-" and " " as interchangeable inside phrases ("broker dealer" ~ "broker-dealer").
  const body = escape(term).replace(/[ -]/g, '[\\s-]+');
  return new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, isAcronym ? 'g' : 'gi');
}

const COMPILED = CATEGORIES.map((c) => ({
  ...c,
  regexes: c.terms.map((t) => ({ term: t, re: termRegex(t) })),
}));

const CHICAGO_RE = /\bchicago\b/i;

/** True if any of the location strings points at Chicago. */
export function isChicago(locations) {
  return locations.some((l) => l && CHICAGO_RE.test(l));
}

/** Strip HTML tags/entities into plain text. */
export function htmlToText(html = '') {
  return String(html)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score a job against the search categories.
 * Title hits are worth 5, description hits 1 each (capped per term).
 */
export function matchJob({ title = '', description = '' }) {
  const categories = [];
  const terms = new Set();
  let score = 0;
  let titleHit = false;

  for (const cat of COMPILED) {
    let hit = false;
    for (const { term, re } of cat.regexes) {
      const inTitle = (title.match(re) || []).length;
      const inDesc = Math.min((description.match(re) || []).length, 5);
      if (inTitle || inDesc) {
        hit = true;
        terms.add(term);
        score += inTitle * 5 + inDesc;
        if (inTitle) titleHit = true;
      }
    }
    if (hit) categories.push(cat.id);
  }
  // Bonus for breadth: a role touching several topics is more likely on-target.
  score += Math.max(0, categories.length - 1) * 2;
  return { score, categories, terms: [...terms], titleHit };
}

/** Short snippet of the description around the first matched term. */
export function snippet(description, terms, radius = 140) {
  if (!description) return '';
  let idx = -1;
  for (const t of terms) {
    const m = termRegex(t).exec(description);
    if (m && (idx === -1 || m.index < idx)) idx = m.index;
  }
  if (idx === -1) return description.slice(0, radius * 2) + (description.length > radius * 2 ? '…' : '');
  const start = Math.max(0, idx - radius);
  const end = Math.min(description.length, idx + radius);
  return (start > 0 ? '…' : '') + description.slice(start, end) + (end < description.length ? '…' : '');
}

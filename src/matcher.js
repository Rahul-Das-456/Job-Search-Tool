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
  let topicScore = 0; // description score excluding regulator acronyms
  let topicCats = 0;

  for (const cat of COMPILED) {
    let hit = false;
    const boilerplate = cat.id === 'regulators';
    for (const { term, re } of cat.regexes) {
      const inTitle = (title.match(re) || []).length;
      const inDesc = Math.min((description.match(re) || []).length, 5);
      if (inTitle || inDesc) {
        hit = true;
        terms.add(term);
        score += inTitle * 5 + inDesc;
        if (inTitle) titleHit = true;
        if (!boilerplate) topicScore += inDesc;
      }
    }
    if (hit) {
      categories.push(cat.id);
      if (!boilerplate) topicCats++;
    }
  }
  // Bonus for breadth: a role touching several topics is more likely on-target.
  score += Math.max(0, categories.length - 1) * 2;
  // "Strong" = clearly about these topics. Regulator names alone (SEC, FINRA…)
  // are common in legal boilerplate, so they never qualify a job on their own.
  const strong = titleHit || topicCats >= 2 || topicScore >= 3;
  return { score, categories, terms: [...terms], titleHit, strong };
}

/** Filter + score normalized jobs: Chicago only, at least one topic hit. */
export function selectJobs(jobs, { minScore = 1 } = {}) {
  const out = [];
  for (const j of jobs) {
    if (!isChicago(j.locations)) continue;
    const m = matchJob(j);
    if (m.score < minScore) continue;
    const { description, ...rest } = j;
    // Show the Chicago location first when it is only a secondary location.
    const location = isChicago([j.location])
      ? j.location
      : [j.locations.find((l) => isChicago([l])), j.location].filter(Boolean).join(' · also ');
    out.push({ ...rest, location, ...m, snippet: snippet(description, m.terms) });
  }
  return out;
}

/** Drop the same posting listed on two boards (same company + title). Keeps the best-scored one. */
export function dedupe(jobs) {
  const best = new Map();
  for (const j of jobs) {
    const k = `${j.company}|${j.title}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const cur = best.get(k);
    if (!cur || j.score > cur.score) best.set(k, j);
  }
  return [...best.values()];
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

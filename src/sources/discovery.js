// Optional: run the original Google `site:` queries through a search API and
// harvest the Greenhouse / Ashby board tokens that appear in the result URLs.
// Those boards are then scanned in full through their public APIs.
//
// Configure ONE of:
//   SERPAPI_KEY                          (serpapi.com, Google engine)
//   BRAVE_SEARCH_API_KEY                 (api.search.brave.com)
//   GOOGLE_CSE_KEY + GOOGLE_CSE_CX       (Google Programmable Search)

import { ALL_QUERIES } from '../queries.js';
import { fetchJson, mapLimit } from '../http.js';

const IGNORE = new Set(['embed', 'v1', 'jobs', 'api', 'posting-api', 'job-board']);

/** Pull {source, token} out of a Greenhouse or Ashby job URL. */
export function boardFromUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const parts = u.pathname.split('/').filter(Boolean);
  const host = u.hostname.toLowerCase();

  if (host === 'job-boards.greenhouse.io' || host === 'boards.greenhouse.io' || host.endsWith('.greenhouse.io')) {
    // embed URLs: boards.greenhouse.io/embed/job_app?for=TOKEN&token=ID
    const forParam = u.searchParams.get('for');
    if (forParam) return { source: 'greenhouse', token: forParam.toLowerCase() };
    if (parts[0] && !IGNORE.has(parts[0])) return { source: 'greenhouse', token: parts[0].toLowerCase() };
    return null;
  }
  if (host === 'jobs.ashbyhq.com') {
    if (parts[0] && !IGNORE.has(parts[0])) return { source: 'ashby', token: decodeURIComponent(parts[0]) };
  }
  return null;
}

export function discoveryProvider() {
  if (process.env.SERPAPI_KEY) return 'serpapi';
  if (process.env.BRAVE_SEARCH_API_KEY) return 'brave';
  if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) return 'google-cse';
  return null;
}

async function search(provider, q) {
  if (provider === 'serpapi') {
    const url = `https://serpapi.com/search.json?engine=google&num=100&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}`;
    const d = await fetchJson(url);
    return (d.organic_results || []).map((r) => r.link);
  }
  if (provider === 'brave') {
    const url = `https://api.search.brave.com/res/v1/web/search?count=20&q=${encodeURIComponent(q)}`;
    const d = await fetchJson(url, { headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY } });
    return (d.web?.results || []).map((r) => r.url);
  }
  if (provider === 'google-cse') {
    const links = [];
    for (const start of [1, 11, 21]) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CSE_KEY}&cx=${process.env.GOOGLE_CSE_CX}&start=${start}&q=${encodeURIComponent(q)}`;
      const d = await fetchJson(url);
      links.push(...(d.items || []).map((r) => r.link));
      if (!d.queries?.nextPage) break;
    }
    return links;
  }
  return [];
}

/** Returns { provider, boards: [{source, token, company, discovered:true}], errors } */
export async function discoverBoards(queries = ALL_QUERIES) {
  const provider = discoveryProvider();
  if (!provider) return { provider: null, boards: [], errors: [] };

  const found = new Map();
  const errors = [];
  await mapLimit(queries, 3, async (q) => {
    try {
      for (const link of await search(provider, q)) {
        const b = boardFromUrl(link);
        if (b) found.set(`${b.source}:${b.token}`, { ...b, company: b.token, discovered: true });
      }
    } catch (e) {
      errors.push({ query: q, error: e.message });
    }
  });
  return { provider, boards: [...found.values()], errors };
}

// Static site build: scan every board, then write the web UI + jobs.json
// into dist/ so it can be hosted anywhere (GitHub Pages via the workflow in
// .github/workflows/site.yml). Run: `node scripts/build.js`
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../src/scanner.js';
import { CATEGORIES, GREENHOUSE_QUERIES, ASHBY_QUERIES } from '../src/queries.js';
import { discoveryProvider } from '../src/sources/discovery.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS || 3);
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

const xml = (s = '') => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

function rss(jobs) {
  const items = [...jobs]
    .sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)))
    .slice(0, 100)
    .map((j) => `  <item>
    <title>${xml(`${j.title} — ${j.company}`)}</title>
    <link>${xml(j.url)}</link>
    <guid isPermaLink="false">${xml(j.id)}</guid>
    <pubDate>${new Date(j.firstSeen || Date.now()).toUTCString()}</pubDate>
    <description>${xml(`${j.location} · ${j.terms.join(', ')} — ${j.snippet}`)}</description>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Chicago Compliance &amp; Surveillance Jobs</title>
  <link>${xml(SITE_URL || 'https://github.com')}</link>
  <description>Chicago trade surveillance and compliance roles from Greenhouse and Ashby boards</description>
${items}
</channel></rss>
`;
}

async function main() {
  const discover = Boolean(discoveryProvider()) && process.env.DISCOVER !== '0';
  const result = await scan({ discover });

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.cp(path.join(ROOT, 'public'), DIST, { recursive: true });
  await fs.writeFile(path.join(DIST, 'jobs.json'), JSON.stringify({ ...result, static: true, refreshHours: REFRESH_HOURS }));
  await fs.writeFile(path.join(DIST, 'config.json'), JSON.stringify({
    categories: CATEGORIES.map(({ id, label, terms }) => ({ id, label, terms })),
    queries: { greenhouse: GREENHOUSE_QUERIES, ashby: ASHBY_QUERIES },
    discoveryProvider: discoveryProvider(),
    static: true,
    refreshHours: REFRESH_HOURS,
  }));
  await fs.writeFile(path.join(DIST, 'feed.xml'), rss(result.jobs));
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');

  // Report: console + GitHub job summary.
  const ok = result.boards.filter((b) => b.ok);
  const bad = result.boards.filter((b) => !b.ok);
  const lines = [
    `## Scan: ${result.jobs.length} matching Chicago jobs`,
    `${ok.length}/${result.boards.length} boards OK · ${result.durationMs} ms · discovery: ${result.discovery?.provider || 'off'}${result.discovery?.found ? ` (${result.discovery.found} boards found)` : ''}`,
    '',
    '| Board | Source | Status | Total | Chicago | Matched |',
    '|---|---|---|---|---|---|',
    ...result.boards.map((b) => `| ${b.company} (\`${b.token}\`) | ${b.source} | ${b.ok ? 'OK' : `FAIL: ${b.error}`} | ${b.total ?? ''} | ${b.chicago ?? ''} | ${b.matched ?? ''} |`),
    '',
    '### Jobs',
    ...result.jobs.map((j) => `- [${j.score}] **${j.company}**: ${j.title} — ${j.location}`),
  ].join('\n');
  console.log(lines);
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines + '\n');
  if (bad.length) console.log(`\nFailing boards: ${bad.map((b) => `${b.source}:${b.token}`).join(', ')}`);
  if (!ok.length && !result.mock) { console.error('Every board failed — refusing to publish an empty site.'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });

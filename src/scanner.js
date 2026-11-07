import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGreenhouse, normalizeGreenhouse } from './sources/greenhouse.js';
import { fetchAshby, normalizeAshby } from './sources/ashby.js';
import { discoverBoards, discoveryProvider } from './sources/discovery.js';
import { isChicago, matchJob, snippet } from './matcher.js';
import { mapLimit } from './http.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_FILE = path.join(ROOT, 'config', 'boards.json');
const DATA_DIR = path.join(ROOT, 'data');
const CUSTOM_FILE = path.join(DATA_DIR, 'custom-boards.json');
const DISCOVERED_FILE = path.join(DATA_DIR, 'discovered-boards.json');
const FIRST_SEEN_FILE = path.join(DATA_DIR, 'first-seen.json');
const FIXTURES = path.join(ROOT, 'test', 'fixtures');

const MOCK = process.env.MOCK === '1';

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

const key = (b) => `${b.source}:${b.token.toLowerCase()}`;

/** All boards: seed config + user-added + search-discovered, de-duplicated. */
export async function loadBoards() {
  if (MOCK) {
    return [
      { source: 'greenhouse', token: 'mocktrading', company: 'Mock Trading Co', origin: 'seed' },
      { source: 'ashby', token: 'mockexchange', company: 'Mock Exchange', origin: 'seed' },
      { source: 'greenhouse', token: 'doesnotexist', company: 'Missing Board', origin: 'seed' },
    ];
  }
  const seed = await readJson(SEED_FILE, { greenhouse: [], ashby: [] });
  const custom = await readJson(CUSTOM_FILE, []);
  const discovered = await readJson(DISCOVERED_FILE, []);
  const all = new Map();
  const add = (b, origin) => { if (b?.token) all.set(key(b), { ...all.get(key(b)), ...b, origin: all.get(key(b))?.origin || origin }); };
  for (const b of seed.greenhouse || []) add({ ...b, source: 'greenhouse' }, 'seed');
  for (const b of seed.ashby || []) add({ ...b, source: 'ashby' }, 'seed');
  for (const b of custom) add(b, 'custom');
  for (const b of discovered) add(b, 'discovered');
  return [...all.values()];
}

export async function addCustomBoard({ source, token, company }) {
  if (!['greenhouse', 'ashby'].includes(source)) throw new Error('source must be greenhouse or ashby');
  token = String(token || '').trim();
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(token)) throw new Error('invalid board token');
  const custom = await readJson(CUSTOM_FILE, []);
  const b = { source, token, company: String(company || token).slice(0, 100) };
  const next = custom.filter((c) => key(c) !== key(b)).concat(b);
  await writeJson(CUSTOM_FILE, next);
  return b;
}

export async function removeCustomBoard({ source, token }) {
  const custom = await readJson(CUSTOM_FILE, []);
  await writeJson(CUSTOM_FILE, custom.filter((c) => key(c) !== key({ source, token })));
}

async function fetchBoard(board) {
  if (MOCK) {
    const raw = await readJson(path.join(FIXTURES, `${board.source}-${board.token}.json`), null);
    if (!raw) { const e = new Error('Board not found (404) — check the board token'); e.status = 404; throw e; }
    return board.source === 'greenhouse'
      ? normalizeGreenhouse(board.token, board.company, raw)
      : normalizeAshby(board.token, board.company, raw);
  }
  return board.source === 'greenhouse' ? fetchGreenhouse(board) : fetchAshby(board);
}

/** Filter + score raw jobs: Chicago only, at least one topic hit. */
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

const state = {
  running: null,
  result: { jobs: [], boards: [], scannedAt: null, discovery: null },
};

export function getResult() { return state.result; }
export function isScanning() { return Boolean(state.running); }

/** Scan every board. Concurrent calls share the same in-flight scan. */
export function scan({ discover = false } = {}) {
  if (state.running) return state.running;
  state.running = (async () => {
    const started = Date.now();
    let discovery = state.result.discovery;
    if (discover && discoveryProvider() && !MOCK) {
      const d = await discoverBoards();
      const existing = await readJson(DISCOVERED_FILE, []);
      const merged = new Map(existing.map((b) => [key(b), b]));
      for (const b of d.boards) if (!merged.has(key(b))) merged.set(key(b), b);
      await writeJson(DISCOVERED_FILE, [...merged.values()]);
      discovery = { provider: d.provider, found: d.boards.length, errors: d.errors, at: new Date().toISOString() };
    }

    const boards = await loadBoards();
    const firstSeen = await readJson(FIRST_SEEN_FILE, {});
    const now = new Date().toISOString();
    const statuses = [];
    const jobs = [];

    await mapLimit(boards, 8, async (b) => {
      const t0 = Date.now();
      try {
        const raw = await fetchBoard(b);
        const chicago = raw.filter((j) => isChicago(j.locations)).length;
        const picked = selectJobs(raw);
        for (const j of picked) {
          firstSeen[j.id] ||= now;
          j.firstSeen = firstSeen[j.id];
          j.origin = b.origin;
        }
        jobs.push(...picked);
        statuses.push({ ...b, ok: true, total: raw.length, chicago, matched: picked.length, ms: Date.now() - t0 });
      } catch (e) {
        statuses.push({ ...b, ok: false, error: e.name === 'TimeoutError' ? 'Timed out' : e.message, status: e.status || null, ms: Date.now() - t0 });
      }
    });

    await writeJson(FIRST_SEEN_FILE, firstSeen).catch(() => {});
    jobs.sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    statuses.sort((a, b) => Number(a.ok) - Number(b.ok) || (b.matched || 0) - (a.matched || 0) || a.company.localeCompare(b.company));

    state.result = {
      jobs,
      boards: statuses,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      discovery: discovery || { provider: discoveryProvider(), found: 0, errors: [], at: null },
      mock: MOCK,
    };
    return state.result;
  })().finally(() => { state.running = null; });
  return state.running;
}

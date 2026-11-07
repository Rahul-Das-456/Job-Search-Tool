import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, getResult, isScanning, loadBoards, addCustomBoard, removeCustomBoard } from './src/scanner.js';
import { CATEGORIES, GREENHOUSE_QUERIES, ASHBY_QUERIES } from './src/queries.js';
import { discoveryProvider } from './src/sources/discovery.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const REFRESH_MINUTES = Number(process.env.REFRESH_MINUTES || 60);
const DISCOVER_HOURS = Number(process.env.DISCOVER_HOURS || 24);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const BROWSER_MODULES = ['matcher.js', 'queries.js', 'http.js', 'sources/greenhouse.js', 'sources/ashby.js'];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 1e5) throw new Error('body too large'); }
  return data ? JSON.parse(data) : {};
}

let lastDiscovery = 0;
async function backgroundScan(force = false) {
  const discover = force || Date.now() - lastDiscovery > DISCOVER_HOURS * 3600e3;
  if (discover) lastDiscovery = Date.now();
  try {
    const r = await scan({ discover });
    console.log(`[scan] ${r.jobs.length} matching Chicago jobs across ${r.boards.length} boards in ${r.durationMs}ms`);
  } catch (e) {
    console.error('[scan] failed:', e);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/config' && req.method === 'GET') {
      return send(res, 200, {
        categories: CATEGORIES.map(({ id, label, terms }) => ({ id, label, terms })),
        queries: { greenhouse: GREENHOUSE_QUERIES, ashby: ASHBY_QUERIES },
        discoveryProvider: discoveryProvider(),
        refreshMinutes: REFRESH_MINUTES,
      });
    }
    if (url.pathname === '/api/jobs' && req.method === 'GET') {
      const r = getResult();
      if (!r.scannedAt) await scan();
      return send(res, 200, { ...getResult(), scanning: isScanning() });
    }
    if (url.pathname === '/api/scan' && req.method === 'POST') {
      const discover = url.searchParams.get('discover') === '1';
      if (discover) lastDiscovery = Date.now();
      const r = await scan({ discover });
      return send(res, 200, { ...r, scanning: false });
    }
    if (url.pathname === '/api/boards') {
      if (req.method === 'GET') return send(res, 200, await loadBoards());
      if (req.method === 'POST') return send(res, 201, await addCustomBoard(await readBody(req)));
      if (req.method === 'DELETE') { await removeCustomBoard(await readBody(req)); return send(res, 204, ''); }
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });

    // Static files (plus the browser-safe modules under /src/)
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const fromSrc = rel.startsWith('src/') && BROWSER_MODULES.includes(rel.slice(4));
    const base = fromSrc ? ROOT : PUBLIC;
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base + path.sep)) return send(res, 403, 'forbidden', 'text/plain');
    const buf = await fs.readFile(file).catch(() => null);
    if (!buf) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Chicago compliance job search → http://${HOST}:${PORT}`);
  console.log(`Auto-refresh every ${REFRESH_MINUTES} min · discovery: ${discoveryProvider() || 'off (set SERPAPI_KEY, BRAVE_SEARCH_API_KEY or GOOGLE_CSE_KEY+GOOGLE_CSE_CX)'}`);
  backgroundScan();
  setInterval(backgroundScan, REFRESH_MINUTES * 60e3).unref();
});

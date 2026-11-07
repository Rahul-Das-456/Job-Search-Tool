const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const state = {
  config: null,
  data: null,
  seen: new Set(store.get('seenIds', [])),
  activeCats: new Set(store.get('activeCats', [])),
  filters: { q: '', source: '', sort: 'score', titleOnly: false, newOnly: false, company: '', days: '', ...store.get('filters', {}) },
  static: false,
};

const catLabel = (id) => state.config?.categories.find((c) => c.id === id)?.label || id;

function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function highlight(text, terms) {
  let html = esc(text);
  for (const t of [...terms].sort((a, b) => b.length - a.length)) {
    const body = esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[\\s-]+');
    const flags = /^[A-Z]{2,6}$/.test(t) ? 'g' : 'gi';
    html = html.replace(new RegExp(`(?<![A-Za-z0-9>])(${body})(?![A-Za-z0-9])`, flags), '<mark>$1</mark>');
  }
  return html;
}

function filtered() {
  const { q, source, sort, titleOnly, newOnly, company, days } = state.filters;
  const cutoff = days ? Date.now() - Number(days) * 86400e3 : 0;
  const needle = q.trim().toLowerCase();
  let jobs = state.data?.jobs || [];
  jobs = jobs.filter((j) => {
    if (source && j.source !== source) return false;
    if (company && j.company !== company) return false;
    if (cutoff && new Date(j.publishedAt || j.updatedAt || j.firstSeen).getTime() < cutoff) return false;
    if (titleOnly && !j.titleHit) return false;
    if (newOnly && state.seen.has(j.id)) return false;
    if (state.activeCats.size && !j.categories.some((c) => state.activeCats.has(c))) return false;
    if (needle) {
      const hay = `${j.title} ${j.company} ${j.department} ${j.location} ${j.snippet} ${j.terms.join(' ')}`.toLowerCase();
      if (!needle.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const by = {
    score: (a, b) => b.score - a.score,
    newest: (a, b) => String(b.updatedAt || b.firstSeen).localeCompare(String(a.updatedAt || a.firstSeen)),
    company: (a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title),
  }[sort];
  return [...jobs].sort(by);
}

function renderStats() {
  const d = state.data;
  const jobs = d?.jobs || [];
  const fresh = jobs.filter((j) => !state.seen.has(j.id)).length;
  const ok = (d?.boards || []).filter((b) => b.ok).length;
  const companies = new Set(jobs.map((j) => j.company)).size;
  $('#stats').innerHTML = [
    [jobs.length, 'matching Chicago roles'],
    [fresh, 'new since you last looked'],
    [companies, 'companies hiring'],
    [`${ok}/${d?.boards?.length || 0}`, 'boards scanned OK'],
  ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  const every = state.static ? ` · updates every ${state.config.refreshHours || 3} h` : '';
  $('#scanned').textContent = d?.scannedAt ? `last scan ${timeAgo(d.scannedAt)}${d.mock ? ' (mock data)' : ''}${every}` : 'not scanned yet';
  renderCompanies();
}

function renderCompanies() {
  const sel = $('#company');
  const names = [...new Set((state.data?.jobs || []).map((j) => j.company))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">All companies</option>` + names.map((n) => `<option${n === state.filters.company ? ' selected' : ''}>${esc(n)}</option>`).join('');
}

function renderChips() {
  const counts = {};
  for (const j of state.data?.jobs || []) for (const c of j.categories) counts[c] = (counts[c] || 0) + 1;
  $('#chips').innerHTML = state.config.categories.map((c) =>
    `<button class="chip" data-cat="${c.id}" aria-pressed="${state.activeCats.has(c.id)}" title="${esc(c.terms.join(', '))}">${esc(c.label)}<span class="n">${counts[c.id] || 0}</span></button>`
  ).join('');
}

function renderResults() {
  const jobs = filtered();
  if (!jobs.length) {
    $('#results').innerHTML = `<p class="empty">${state.data?.jobs?.length ? 'No roles match these filters.' : 'No matching Chicago roles found on the scanned boards. Add more boards or enable discovery.'}</p>`;
    return;
  }
  $('#results').innerHTML = jobs.map((j) => {
    const isNew = !state.seen.has(j.id);
    return `<article class="job${isNew ? ' is-new' : ''}">
      <h2><a href="${esc(j.url)}" target="_blank" rel="noopener" data-id="${esc(j.id)}">${highlight(j.title, j.terms)}</a>
        ${isNew ? '<span class="badge new">New</span>' : ''}
        <span class="badge">${j.source === 'greenhouse' ? 'Greenhouse' : 'Ashby'}</span>
        <span class="badge score" title="Match score">${j.score}</span></h2>
      <div class="meta">
        <span class="company">${esc(j.company)}</span>
        <span>${esc(j.location)}</span>
        ${j.department ? `<span>${esc(j.department)}</span>` : ''}
        ${j.compensation ? `<span>${esc(j.compensation)}</span>` : ''}
        ${j.updatedAt ? `<span>Updated ${fmtDate(j.updatedAt)}</span>` : ''}
        <span>First seen ${timeAgo(j.firstSeen)}</span>
      </div>
      <div class="tags">${j.categories.map((c) => `<span class="tag">${esc(catLabel(c))}</span>`).join('')}</div>
      <p class="snippet">${highlight(j.snippet, j.terms)}</p>
    </article>`;
  }).join('');
}

function renderBoards() {
  const boards = state.data?.boards || [];
  const bad = boards.filter((b) => !b.ok).length;
  $('#boardSummary').textContent = `(${boards.length}${bad ? `, ${bad} failing` : ''})`;
  $('#boards').innerHTML = boards.map((b) => `<div class="board">
      <div><b>${esc(b.company)}</b> <span class="muted">${b.source} · ${esc(b.token)}${b.origin !== 'seed' ? ` · ${b.origin}` : ''}</span>
        <small class="${b.ok ? 'ok' : 'err'}">${b.ok ? `${b.matched} match · ${b.chicago} Chicago · ${b.total} total` : esc(b.error)}</small></div>
      ${b.origin === 'custom' && !state.static ? `<button title="Remove" data-remove="${b.source}|${esc(b.token)}">✕</button>` : ''}
    </div>`).join('') || '<p class="hint">No boards yet.</p>';
}

function renderQueries() {
  const { greenhouse, ashby } = state.config.queries;
  const g = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  $('#queries').innerHTML = [...greenhouse, ...ashby].map((q) => `<li><a href="${g(q)}" target="_blank" rel="noopener">${esc(q)}</a></li>`).join('');
  $('#discoveryHint').innerHTML = state.config.discoveryProvider
    ? `Discovery is <b>on</b> (${esc(state.config.discoveryProvider)}): these queries run automatically to find new company boards.`
    : state.static
      ? 'Discovery is <b>off</b>. Add a <code>SERPAPI_KEY</code> (or <code>BRAVE_SEARCH_API_KEY</code>) repository secret to run these queries automatically and pick up new company boards. Click any query to run it in Google.'
      : 'Discovery is <b>off</b>. Set <code>SERPAPI_KEY</code>, <code>BRAVE_SEARCH_API_KEY</code> or <code>GOOGLE_CSE_KEY</code>+<code>GOOGLE_CSE_CX</code> to run these queries automatically and pick up new boards. Click any query to run it in Google manually.';
  $('#discoverBtn').hidden = state.static || !state.config.discoveryProvider;
}

function render() { renderStats(); renderChips(); renderResults(); renderBoards(); }

async function load(url = state.static ? 'jobs.json' : 'api/jobs', opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  state.data = await res.json();
  render();
}

async function runScan(discover = false) {
  const btns = [$('#scanBtn'), $('#discoverBtn')];
  btns.forEach((b) => (b.disabled = true));
  $('#scanBtn').textContent = 'Scanning…';
  try { await load(`api/scan${discover ? '?discover=1' : ''}`, { method: 'POST' }); }
  catch (e) { alert(`Scan failed: ${e.message}`); }
  finally { btns.forEach((b) => (b.disabled = false)); $('#scanBtn').textContent = 'Scan now'; }
}

function exportCsv() {
  const cols = ['company', 'title', 'location', 'source', 'score', 'categories', 'terms', 'updatedAt', 'firstSeen', 'url'];
  const cell = (v) => `"${String(Array.isArray(v) ? v.map(catLabel).join('; ') : v ?? '').replace(/"/g, '""')}"`;
  const rows = filtered().map((j) => cols.map((c) => cell(c === 'terms' ? j.terms.join('; ') : j[c])).join(','));
  const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `chicago-compliance-jobs-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

function parseBoardInput(source, token) {
  try {
    const u = new URL(token);
    const parts = u.pathname.split('/').filter(Boolean);
    if (u.hostname === 'jobs.ashbyhq.com') return { source: 'ashby', token: parts[0] };
    if (u.hostname.endsWith('greenhouse.io')) return { source: 'greenhouse', token: u.searchParams.get('for') || parts[0] };
  } catch { /* not a URL */ }
  return { source, token: token.trim() };
}

function bind() {
  const f = state.filters;
  $('#q').value = f.q; $('#source').value = f.source; $('#sort').value = f.sort;
  $('#titleOnly').checked = f.titleOnly; $('#newOnly').checked = f.newOnly;
  const save = () => { store.set('filters', state.filters); renderResults(); };
  $('#q').addEventListener('input', (e) => { f.q = e.target.value; save(); });
  $('#source').addEventListener('change', (e) => { f.source = e.target.value; save(); });
  $('#sort').addEventListener('change', (e) => { f.sort = e.target.value; save(); });
  $('#titleOnly').addEventListener('change', (e) => { f.titleOnly = e.target.checked; save(); });
  $('#newOnly').addEventListener('change', (e) => { f.newOnly = e.target.checked; save(); });
  $('#days').value = f.days;
  $('#days').addEventListener('change', (e) => { f.days = e.target.value; save(); });
  $('#company').addEventListener('change', (e) => { f.company = e.target.value; save(); });

  $('#chips').addEventListener('click', (e) => {
    const id = e.target.closest('.chip')?.dataset.cat;
    if (!id) return;
    state.activeCats.has(id) ? state.activeCats.delete(id) : state.activeCats.add(id);
    store.set('activeCats', [...state.activeCats]);
    renderChips(); renderResults();
  });

  $('#results').addEventListener('click', (e) => {
    const id = e.target.closest('a[data-id]')?.dataset.id;
    if (id) { state.seen.add(id); store.set('seenIds', [...state.seen]); }
  });
  $('#markSeen').addEventListener('click', () => {
    for (const j of state.data?.jobs || []) state.seen.add(j.id);
    store.set('seenIds', [...state.seen]);
    render();
  });
  $('#exportCsv').addEventListener('click', exportCsv);
  $('#scanBtn').addEventListener('click', () => runScan(false));
  $('#discoverBtn').addEventListener('click', () => runScan(true));

  $('#addBoard').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { ...parseBoardInput(fd.get('source'), fd.get('token')), company: fd.get('company') || undefined };
    const res = await fetch('api/boards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return alert((await res.json()).error);
    e.target.reset();
    runScan(false);
  });
  $('#boards').addEventListener('click', async (e) => {
    const v = e.target.closest('[data-remove]')?.dataset.remove;
    if (!v) return;
    const [source, token] = v.split('|');
    await fetch('api/boards', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, token }) });
    runScan(false);
  });
}

async function init() {
  // Server mode (npm start) has an API; the hosted static site ships config.json + jobs.json.
  const api = await fetch('api/config').catch(() => null);
  if (api?.ok && api.headers.get('content-type')?.includes('json')) {
    state.config = await api.json();
  } else {
    state.static = true;
    state.config = await (await fetch('config.json', { cache: 'no-cache' })).json();
    for (const el of document.querySelectorAll('.server-only')) el.hidden = true;
    for (const el of document.querySelectorAll('.static-only')) el.hidden = false;
  }
  renderQueries();
  bind();
  await load().catch((e) => { $('#results').innerHTML = `<p class="empty">Failed to load: ${esc(e.message)}</p>`; });
  // Pick up the server's background refreshes.
  setInterval(() => load().catch(() => {}), 5 * 60e3);
  setInterval(renderStats, 60e3);
}
init();

export class HttpError extends Error {
  constructor(status, url) {
    super(status === 404 ? 'Board not found (404) — check the board token' : `HTTP ${status}`);
    this.status = status;
    this.url = url;
  }
}

export async function fetchJson(url, { timeoutMs = 20000, headers = {} } = {}) {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'chicago-compliance-job-search/1.0', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new HttpError(res.status, url);
  return res.json();
}

/** Run async fn over items with at most `limit` in flight. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

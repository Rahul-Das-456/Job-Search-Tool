import { htmlToText } from '../matcher.js';
import { fetchJson } from '../http.js';

// Public Greenhouse Job Board API — no key required.
// https://developers.greenhouse.io/job-board.html
export const greenhouseUrl = (token) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;

export function normalizeGreenhouse(token, company, payload) {
  return (payload?.jobs || []).map((j) => {
    const locations = [
      j.location?.name,
      ...(j.offices || []).flatMap((o) => [o.name, o.location]),
    ].filter(Boolean);
    return {
      id: `gh:${token}:${j.id}`,
      source: 'greenhouse',
      board: token,
      company: company || j.company_name || token,
      title: j.title || '',
      location: j.location?.name || locations[0] || '',
      locations,
      department: (j.departments || []).map((d) => d.name).filter(Boolean).join(', '),
      url: j.absolute_url,
      updatedAt: j.updated_at || null,
      publishedAt: j.first_published || null,
      description: htmlToText(j.content),
    };
  });
}

export async function fetchGreenhouse({ token, company }) {
  const data = await fetchJson(greenhouseUrl(token));
  return normalizeGreenhouse(token, company, data);
}

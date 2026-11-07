import { htmlToText } from '../matcher.js';
import { fetchJson } from '../http.js';

// Public Ashby Posting API — no key required.
// https://developers.ashbyhq.com/docs/public-job-posting-api
export const ashbyUrl = (token) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`;

const addr = (a) => {
  const p = a?.postalAddress;
  return p ? [p.addressLocality, p.addressRegion, p.addressCountry].filter(Boolean).join(', ') : '';
};

export function normalizeAshby(token, company, payload) {
  return (payload?.jobs || [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const locations = [
        j.location,
        addr(j.address),
        ...(j.secondaryLocations || []).flatMap((s) => [s.location, addr(s.address)]),
      ].filter(Boolean);
      return {
        id: `ashby:${token}:${j.id}`,
        source: 'ashby',
        board: token,
        company: company || token,
        title: j.title || '',
        location: j.location || locations[0] || '',
        locations,
        department: [j.department, j.team].filter(Boolean).join(' · '),
        url: j.jobUrl || j.applyUrl,
        updatedAt: j.publishedAt || null,
        publishedAt: j.publishedAt || null,
        compensation: j.compensation?.compensationTierSummary || j.compensation?.scrapeableCompensationSalarySummary || '',
        description: j.descriptionPlain ? j.descriptionPlain.replace(/\s+/g, ' ').trim() : htmlToText(j.descriptionHtml),
      };
    });
}

export async function fetchAshby({ token, company }) {
  const data = await fetchJson(ashbyUrl(token));
  return normalizeAshby(token, company, data);
}

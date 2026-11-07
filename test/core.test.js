import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { matchJob, isChicago, htmlToText } from '../src/matcher.js';
import { normalizeGreenhouse } from '../src/sources/greenhouse.js';
import { normalizeAshby } from '../src/sources/ashby.js';
import { boardFromUrl } from '../src/sources/discovery.js';
import { selectJobs } from '../src/scanner.js';
import { ASHBY_QUERIES, GREENHOUSE_QUERIES } from '../src/queries.js';

const fixture = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));

test('acronyms match whole words, case-sensitively', () => {
  assert.deepEqual(matchJob({ title: 'Engineer', description: 'within a second; security; sec' }).terms, []);
  assert.ok(matchJob({ title: '', description: 'SEC-registered firm' }).terms.includes('SEC'));
  assert.ok(matchJob({ title: '', description: 'CFTC/NFA rules' }).terms.includes('NFA'));
});

test('phrases tolerate hyphens and case', () => {
  const m = matchJob({ title: 'Broker-Dealer Compliance', description: '' });
  assert.ok(m.categories.includes('bd-exchange'));
  assert.ok(m.titleHit);
});

test('Chicago detection', () => {
  assert.ok(isChicago(['New York, NY; Chicago, IL']));
  assert.ok(!isChicago(['London', 'Remote']));
});

test('htmlToText decodes Greenhouse escaped HTML', () => {
  assert.equal(htmlToText('&lt;p&gt;A &amp; B&lt;/p&gt;'), 'A & B');
});

test('greenhouse pipeline keeps only Chicago + keyword matches', () => {
  const jobs = selectJobs(normalizeGreenhouse('mocktrading', 'Mock', fixture('greenhouse-mocktrading.json')));
  const titles = jobs.map((j) => j.title).sort();
  assert.deepEqual(titles, ['Compliance Officer, Broker-Dealer', 'Trade Support Specialist', 'Trade Surveillance Analyst']);
  assert.ok(jobs.every((j) => j.url.startsWith('https://')));
});

test('ashby pipeline uses secondary locations and drops unlisted jobs', () => {
  const jobs = selectJobs(normalizeAshby('mockexchange', 'Mock', fixture('ashby-mockexchange.json')));
  assert.deepEqual(jobs.map((j) => j.title).sort(), ['Compliance Technology Engineer', 'Surveillance Analyst, Market Integrity']);
  assert.equal(jobs.find((j) => j.title.startsWith('Surveillance')).compensation, '$110K – $150K');
});

test('board tokens are extracted from search result URLs', () => {
  assert.deepEqual(boardFromUrl('https://job-boards.greenhouse.io/drw/jobs/123'), { source: 'greenhouse', token: 'drw' });
  assert.deepEqual(boardFromUrl('https://boards.greenhouse.io/embed/job_app?for=Akuna&token=9'), { source: 'greenhouse', token: 'akuna' });
  assert.deepEqual(boardFromUrl('https://jobs.ashbyhq.com/kalshi/abc-123'), { source: 'ashby', token: 'kalshi' });
  assert.equal(boardFromUrl('https://example.com/jobs/1'), null);
});

test('every Greenhouse query has an Ashby counterpart', () => {
  assert.equal(GREENHOUSE_QUERIES.length, 15);
  assert.ok(ASHBY_QUERIES.every((q) => q.startsWith('site:jobs.ashbyhq.com ') && q.includes('"Chicago"')));
});

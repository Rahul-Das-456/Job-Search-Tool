# Chicago Compliance & Surveillance Job Search

A small web app that searches **Greenhouse** and **Ashby** job boards for **Chicago-only** roles in trade surveillance, trading compliance, RegTech, financial crime, regulatory reporting and related areas. It replaces running the Google `site:job-boards.greenhouse.io … "Chicago"` queries by hand.

## How it works

1. **Board scan (no keys needed).** Every company board in `config/boards.json` (plus any you add in the UI) is fetched in full from the public APIs:
   - Greenhouse: `boards-api.greenhouse.io/v1/boards/<token>/jobs?content=true`
   - Ashby: `api.ashbyhq.com/posting-api/job-board/<token>`
2. **Chicago filter.** Only jobs with Chicago in the primary location, a secondary location or an office are kept. A job listed as "New York; Chicago" counts.
3. **Keyword match.** Titles and descriptions are scored against the 12 topic groups from the original queries (`src/queries.js`). Title hits count more than description hits. Acronyms (SEC, CFTC, NFA, FINRA) only match as whole uppercase words, so "SEC" does not match "second" or "security".
4. **Discovery (optional).** If a search API key is set, the 15 original `site:` queries, plus the same queries against `site:jobs.ashbyhq.com`, run automatically once a day. Any new company boards in the results are added to the scan. Without a key, each query in the UI's "Search queries" panel links to Google so you can run it by hand.
5. **Auto-refresh.** The server rescans every 60 minutes, and the page picks up the new results. Jobs you haven't opened are marked **New**.

## Hosted website (GitHub Pages)

`.github/workflows/site.yml` scans every board every 3 hours. It then publishes the site to `https://<user>.github.io/<repo>/` with `jobs.json` and an RSS feed (`feed.xml`). On the site:

- **Refresh live** fetches the newest postings straight from Greenhouse and Ashby in your browser. Both APIs allow cross-origin requests, so no server is needed. The page also does this automatically if the scheduled data is more than 6 hours old.
- All filters, New/seen tracking and CSV export work as they do locally.

One-time setup:
1. Merge this branch into `main`. The schedule only runs from the default branch.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. GitHub Pages on a **private** repo needs a paid GitHub plan. On a free account, make the repo public (Settings → General → Danger Zone).
4. Optional: add a `SERPAPI_KEY` (or `BRAVE_SEARCH_API_KEY`) repository secret so the `site:` queries run automatically and find new company boards.
5. Run it now: **Actions → Build & publish job site → Run workflow**.

Every run's job summary lists each board's status and the matched jobs.

## Run it locally

Requires Node 18+ and has no dependencies.

```bash
npm start            # http://127.0.0.1:3000
npm run mock         # demo with fixture data, no network
npm test
```

### Settings (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Where the server listens |
| `REFRESH_MINUTES` | `60` | How often all boards are rescanned |
| `DISCOVER_HOURS` | `24` | How often the discovery queries run |
| `SERPAPI_KEY` | – | Turns on discovery through SerpAPI (Google results) |
| `BRAVE_SEARCH_API_KEY` | – | Turns on discovery through the Brave Search API |
| `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` | – | Turns on discovery through Google Programmable Search |

## Adding companies

- **UI:** use "Add a company board" in the sidebar. Enter a token, or paste any job URL such as `https://job-boards.greenhouse.io/drw/jobs/123`.
- **Config:** edit `config/boards.json`. The token is the slug in `job-boards.greenhouse.io/<token>` or `jobs.ashbyhq.com/<token>`. Check candidate tokens with `node scripts/probe.js peak6 drweng …`.

The **Board status** panel shows, for each board, how many jobs it has in total, in Chicago and matching your topics. All 30 seed boards were verified on 2026-11-07. Several Chicago firms (PEAK6, Belvedere, Old Mission, XR, Wolverine, Group One, Cboe, CME) don't use Greenhouse or Ashby, so they can't be scanned here.

**Relevance:** "Strong matches" (the default) needs a keyword in the title, two different topic groups, or repeated topic phrases. Regulator names alone (SEC, FINRA…) show up in legal boilerplate, so they never qualify a job on their own. Switch to "All mentions" to see everything.

## Features

- Topic chips for the 12 groups, with counts
- Free-text filter, source filter (Greenhouse or Ashby), and a "keyword in title" toggle
- Sorting by best match, newest or company
- New/seen tracking, stored in your browser
- Matched terms highlighted in the title and in a description snippet
- CSV export of the current filtered view

## Layout

```
server.js                 HTTP server, API, background refresh
src/queries.js            topic groups + the original site: queries
src/matcher.js            Chicago check, keyword scoring, snippets
src/scanner.js            board list, scanning, first-seen tracking
src/sources/greenhouse.js Greenhouse API client
src/sources/ashby.js      Ashby API client
src/sources/discovery.js  search-API discovery of new boards
scripts/build.js          static site build (used by the workflow)
scripts/probe.js          check whether board tokens exist
public/                   web UI (plain HTML/CSS/JS)
config/boards.json        seed boards
data/                     runtime state (git-ignored)
```

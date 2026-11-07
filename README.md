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

## Run it

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
- **Config:** edit `config/boards.json`. The token is the slug in `job-boards.greenhouse.io/<token>` or `jobs.ashbyhq.com/<token>`.

The **Board status** panel shows, for each board, how many jobs it has in total, in Chicago and matching your topics. Boards with a wrong token show "404". The seed list is a starting point of Chicago trading firms, exchanges and fintechs. Some of those tokens may be wrong or the companies may have moved to another ATS, so prune them as needed.

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
public/                   web UI (plain HTML/CSS/JS)
config/boards.json        seed boards
data/                     runtime state (git-ignored)
```

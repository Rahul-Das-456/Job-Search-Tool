// Check whether board tokens exist on Greenhouse and/or Ashby.
// Usage: node scripts/probe.js drweng peak6 kalshi ...
import { fetchGreenhouse } from '../src/sources/greenhouse.js';
import { fetchAshby } from '../src/sources/ashby.js';
import { isChicago } from '../src/matcher.js';

const tokens = process.argv.slice(2);
if (!tokens.length) { console.log('Usage: node scripts/probe.js <token> [...]'); process.exit(1); }
for (const t of tokens) {
  for (const [src, fn] of [['greenhouse', fetchGreenhouse], ['ashby', fetchAshby]]) {
    try {
      const jobs = await fn({ token: t, company: t });
      console.log(`${src.padEnd(10)} ${t.padEnd(26)} ${jobs.length} jobs, ${jobs.filter((j) => isChicago(j.locations)).length} in Chicago`);
    } catch (e) {
      console.log(`${src.padEnd(10)} ${t.padEnd(26)} ${e.status === 404 ? 'not found' : e.message}`);
    }
  }
}

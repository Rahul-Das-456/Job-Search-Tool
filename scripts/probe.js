// Dev helper: check which candidate board tokens exist. Usage: node scripts/probe.js
import { fetchGreenhouse } from '../src/sources/greenhouse.js';
import { fetchAshby } from '../src/sources/ashby.js';
import { isChicago } from '../src/matcher.js';
import { mapLimit } from '../src/http.js';

const names = `drw drweng drwholdings peak6 peak6investments peak6group belvedere belvederetradingllc belvederetrading
chicagotrading chicagotradingco ctc oldmission oldmissioncapitalllc xrtradingllc xr wolverine wolverinetradingllc
grouponetradinglp groupone optiver optiverus optiverchicago janestreet citadel citadelsecurities cboe cboeglobalmarkets
tradingtechnologies volanttrading mavensecurities eagleseven simplextrading gelbergroup allstontrading headlandstech
headlandstechnologies mako makotrading radixtrading quantlab valkyrietrading aquaticcapitalmanagement aquatic
hehmeyer dashfinancial avant enova marex stonex trexquantinvestment marqeta1 apexfintech apex alpaca alpacamarkets
anchoragedigital anchorage hiddenroad nasdaq interactivebrokers ibkr webull public publiccom kalshi polymarket
tradeweb virtu jumptrading akunacapital imc geneva genevatrading ninjatrader tradestation tastytrade wealthfront
morningstar northerntrust ccl ptg pdtpartners sigsusquehanna susquehanna twosigma deshaw hrt wehrtyou ascendx
belvederetradingllp crypto cryptocom bitgo fireblocks chainalysis trmlabs trm-labs ellipticco elliptic coinbase
gemini kraken krakendigitalassetexchange paxos ripple circle bakkt bakktholdings cumberland drwcumberland
falconx galaxydigital galaxy clearstreet hudsonrivertrading fiveringsllc towerresearchcapital flowtraders`.split(/\s+/).filter(Boolean);

const rows = [];
await mapLimit([...new Set(names)], 10, async (t) => {
  for (const [src, fn] of [['greenhouse', fetchGreenhouse], ['ashby', fetchAshby]]) {
    try {
      const jobs = await fn({ token: t, company: t });
      rows.push(`${src.padEnd(10)} ${t.padEnd(28)} total=${jobs.length} chicago=${jobs.filter((j) => isChicago(j.locations)).length} ${jobs[0]?.url || ''}`);
    } catch { /* not found */ }
  }
});
console.log('FOUND:\n' + rows.sort().join('\n'));

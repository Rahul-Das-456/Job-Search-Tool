// The search topics, taken from the original Google `site:` queries.
// Every category is a list of phrases; a job matches a category when any
// phrase appears in its title or description.
//
// Acronyms in ALL CAPS (SEC, CFTC, ...) are matched case-sensitively as whole
// words so "SEC" does not match "second" or "security".

export const CATEGORIES = [
  { id: 'surveillance', label: 'Trade / Market Surveillance',
    terms: ['trade surveillance', 'market surveillance', 'trading surveillance', 'trading compliance'] },
  { id: 'bd-exchange', label: 'Broker-Dealer / Exchange / Futures Compliance',
    terms: ['broker dealer', 'exchange compliance', 'futures compliance'] },
  { id: 'regulators', label: 'Regulators (CFTC / SEC / NFA / FINRA)',
    terms: ['CFTC', 'SEC', 'NFA', 'FINRA'] },
  { id: 'market-abuse', label: 'Market Abuse',
    terms: ['market abuse', 'spoofing', 'layering', 'wash trading'] },
  { id: 'comp-tech', label: 'Compliance Technology / RegTech',
    terms: ['compliance technology', 'surveillance systems', 'surveillance technology', 'compliance automation', 'RegTech'] },
  { id: 'trading-ops', label: 'Trading / Brokerage Operations',
    terms: ['trading operations', 'brokerage operations', 'trade support'] },
  { id: 'electronic-trading', label: 'Electronic Trading / Market Integrity',
    terms: ['electronic trading', 'trade monitoring', 'market integrity'] },
  { id: 'analytics', label: 'Compliance / Surveillance Analytics',
    terms: ['compliance analytics', 'surveillance analytics', 'regulatory data'] },
  { id: 'derivatives', label: 'Derivatives / Options / Futures Compliance',
    terms: ['derivatives compliance', 'options compliance', 'futures surveillance'] },
  { id: 'fincrime', label: 'Financial Crime / Investigations',
    terms: ['financial crime', 'transaction monitoring', 'trading investigations'] },
  { id: 'roles', label: 'Compliance / Surveillance Roles',
    terms: ['compliance officer', 'compliance associate', 'surveillance analyst'] },
  { id: 'reg-reporting', label: 'Regulatory Reporting / Controls / Testing',
    terms: ['regulatory reporting', 'regulatory controls', 'compliance testing'] },
];

// The original queries, verbatim. Used for optional search-engine discovery of
// new company boards (see src/sources/discovery.js).
export const GREENHOUSE_QUERIES = [
  'site:job-boards.greenhouse.io ("trade surveillance" OR "market surveillance" OR "trading surveillance") "Chicago"',
  'site:job-boards.greenhouse.io ("broker dealer" OR "exchange compliance" OR "futures compliance") "Chicago"',
  'site:job-boards.greenhouse.io ("CFTC" OR "SEC" OR "NFA" OR "FINRA") "Chicago"',
  'site:job-boards.greenhouse.io ("market abuse" OR "spoofing" OR "layering" OR "wash trading") "Chicago"',
  'site:job-boards.greenhouse.io ("compliance technology" OR "surveillance systems" OR "compliance automation") "Chicago"',
  'site:job-boards.greenhouse.io ("trading operations" OR "brokerage operations" OR "trade support") "Chicago"',
  'site:job-boards.greenhouse.io ("electronic trading" OR "trade monitoring" OR "market integrity") "Chicago"',
  'site:job-boards.greenhouse.io ("compliance analytics" OR "surveillance analytics" OR "regulatory data") "Chicago"',
  'site:job-boards.greenhouse.io ("derivatives compliance" OR "options compliance" OR "futures surveillance") "Chicago"',
  'site:job-boards.greenhouse.io ("financial crime" OR "transaction monitoring" OR "trading investigations") "Chicago"',
  'site:job-boards.greenhouse.io ("compliance officer" OR "compliance associate" OR "surveillance analyst") "Chicago"',
  'site:job-boards.greenhouse.io ("regulatory reporting" OR "regulatory controls" OR "compliance testing") "Chicago"',
  'site:boards.greenhouse.io ("trade surveillance" OR "market surveillance" OR "trading compliance") "Chicago"',
  'site:boards.greenhouse.io ("CFTC" OR "SEC" OR "FINRA" OR "NFA") "Chicago"',
  'site:boards.greenhouse.io ("compliance technology" OR "surveillance technology" OR "RegTech") "Chicago"',
];

// Same topics against Ashby-hosted boards.
export const ASHBY_QUERIES = [
  ...new Set(GREENHOUSE_QUERIES.map((q) => q.replace(/^site:\S+/, 'site:jobs.ashbyhq.com'))),
];

export const ALL_QUERIES = [...GREENHOUSE_QUERIES, ...ASHBY_QUERIES];

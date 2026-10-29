// Validates the Riftbound data files and loads them into the Cloudflare D1 database "riftbound".
// - src/data/riftbound-calendar.json -> rb_calendar: replaces every visibility='public' row. Private rows
//   (organizer deadlines) are written straight to D1 by the Riftbound watch and are never touched here.
// - src/data/riftbound-news.json -> rb_news: replaced in full (table created if missing).
// - src/data/riftbound-rules.json, riftbound-player.json and riftbound-collection.json are site-only; validated, not loaded.
//
//   node scripts/riftbound-d1.mjs --check   validate only (no network)
//   node scripts/riftbound-d1.mjs           validate, then load D1 (needs CLOUDFLARE_API_TOKEN)
import { readFileSync } from 'node:fs';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'e440b44ac703f43ab686e2268162e7e0';
const DATABASE_ID = '33d5c10e-a888-4bf1-84c5-9544f31b2a06'; // D1 "riftbound"
const FILE = new URL('../src/data/riftbound-calendar.json', import.meta.url);
const NEWS_FILE = new URL('../src/data/riftbound-news.json', import.meta.url);
const RULES_FILE = new URL('../src/data/riftbound-rules.json', import.meta.url);

const KINDS = ['drawing', 'drawing_results', 'prerift', 'skirmish', 'nexus_night', 'release', 'preview', 'product',
  'promo', 'rules', 'premier', 'festival', 'convention'];
const STATUSES = ['confirmed', 'reported', 'estimated', 'tba'];
const COLS = ['id', 'kind', 'title', 'start_date', 'end_date', 'start_time_pt', 'status', 'location', 'summary',
  'details', 'price', 'url', 'source_url'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const rows = JSON.parse(readFileSync(FILE, 'utf8'));
const errors = [];
const seen = new Set();
if (!Array.isArray(rows)) errors.push('file must be a JSON array');
for (const [i, r] of (Array.isArray(rows) ? rows : []).entries()) {
  const at = `row ${i} (${r?.id ?? 'no id'})`;
  for (const k of Object.keys(r)) if (!COLS.includes(k)) errors.push(`${at}: unknown field "${k}"`);
  if (!r.id || !/^[a-z0-9-]+$/.test(r.id)) errors.push(`${at}: id must be lowercase letters, digits and dashes`);
  if (seen.has(r.id)) errors.push(`${at}: duplicate id`);
  seen.add(r.id);
  if (!KINDS.includes(r.kind)) errors.push(`${at}: kind must be one of ${KINDS.join(', ')} (organizer deadlines are private and live only in D1)`);
  if (!r.title) errors.push(`${at}: title is required`);
  if (!DATE.test(r.start_date ?? '')) errors.push(`${at}: start_date must be YYYY-MM-DD`);
  if (r.end_date != null && (!DATE.test(r.end_date) || r.end_date < r.start_date)) errors.push(`${at}: end_date must be YYYY-MM-DD on or after start_date`);
  if (r.start_time_pt != null && !/^\d{2}:\d{2}$/.test(r.start_time_pt)) errors.push(`${at}: start_time_pt must be HH:MM (Pacific)`);
  if (r.status != null && !STATUSES.includes(r.status)) errors.push(`${at}: status must be one of ${STATUSES.join(', ')}`);
  if (!r.source_url || !/^https:\/\//.test(r.source_url)) errors.push(`${at}: source_url (https) is required`);
}

// News: every item links to the article or video itself, never a site home page or channel.
const NEWS_CATS = ['announcement', 'organized_play', 'rules', 'judge', 'product', 'event_report'];
const NEWS_COLS = ['id', 'category', 'title', 'published', 'effective_date', 'source', 'summary', 'judge_note', 'url'];
const specific = (u) => {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:') return false;
    const path = x.pathname.replace(/\/+$/, '');
    if (x.hostname === 'youtu.be') return path.length > 1;
    if (/youtube\.com$/.test(x.hostname)) return path === '/watch' && x.searchParams.has('v');
    return path.split('/').filter(Boolean).length >= 2 || /\.pdf$/i.test(path);
  } catch { return false; }
};
const news = JSON.parse(readFileSync(NEWS_FILE, 'utf8'));
const newsSeen = new Set();
if (!Array.isArray(news)) errors.push('riftbound-news.json must be a JSON array');
let prev = '9999-12-31';
for (const [i, n] of (Array.isArray(news) ? news : []).entries()) {
  const at = `news ${i} (${n?.id ?? 'no id'})`;
  for (const k of Object.keys(n)) if (!NEWS_COLS.includes(k)) errors.push(`${at}: unknown field "${k}"`);
  if (!n.id || !/^[a-z0-9-]+$/.test(n.id)) errors.push(`${at}: id must be lowercase letters, digits and dashes`);
  if (newsSeen.has(n.id)) errors.push(`${at}: duplicate id`);
  newsSeen.add(n.id);
  if (!NEWS_CATS.includes(n.category)) errors.push(`${at}: category must be one of ${NEWS_CATS.join(', ')}`);
  if (!n.title) errors.push(`${at}: title is required`);
  if (!n.summary) errors.push(`${at}: summary is required`);
  if (!n.source) errors.push(`${at}: source is required`);
  if (!DATE.test(n.published ?? '')) errors.push(`${at}: published must be YYYY-MM-DD`);
  else if (n.published > prev) errors.push(`${at}: rows must be sorted newest first`);
  else prev = n.published;
  if (n.effective_date != null && !DATE.test(n.effective_date)) errors.push(`${at}: effective_date must be YYYY-MM-DD`);
  if (!specific(n.url ?? '')) errors.push(`${at}: url must be the https link to the article or video itself, not a home page or channel`);
}

// Rules reference (judge corner): light shape check.
const rules = JSON.parse(readFileSync(RULES_FILE, 'utf8'));
if (!Array.isArray(rules.documents) || !rules.documents.length) errors.push('riftbound-rules.json: documents[] is required');
for (const d of rules.documents ?? []) {
  if (!d.name || !DATE.test(d.updated ?? '') || !/^https:\/\//.test(d.url ?? '')) errors.push(`riftbound-rules.json: document "${d.name ?? '?'}" needs name, updated (YYYY-MM-DD) and an https url`);
}
if (!DATE.test(rules.banned?.updated ?? '') || !Array.isArray(rules.banned?.constructed?.cards)) errors.push('riftbound-rules.json: banned.updated and banned.constructed.cards are required');

// Player (events we're going to, decks, results) and collection (set completion, top cards; no totals).
const PLAYER_FILE = new URL('../src/data/riftbound-player.json', import.meta.url);
const COLLECTION_FILE = new URL('../src/data/riftbound-collection.json', import.meta.url);
const player = JSON.parse(readFileSync(PLAYER_FILE, 'utf8'));
const only = (obj, keys, at) => { for (const k of Object.keys(obj)) if (!keys.includes(k)) errors.push(`${at}: unknown field "${k}"`); };
const https = (u) => /^https:\/\//.test(u ?? '');
only(player, ['attending', 'decks', 'results'], 'riftbound-player.json');
for (const [i, e] of (player.attending ?? []).entries()) {
  const at = `attending ${i} (${e.id ?? 'no id'})`;
  only(e, ['id', 'title', 'start_date', 'end_date', 'location', 'url'], at);
  if (!e.id || !e.title || !e.location) errors.push(`${at}: id, title and location are required`);
  if (!DATE.test(e.start_date ?? '') || (e.end_date != null && (!DATE.test(e.end_date) || e.end_date < e.start_date))) errors.push(`${at}: dates must be YYYY-MM-DD, end on or after start`);
  if (!https(e.url)) errors.push(`${at}: url (https) is required`);
}
for (const [i, d] of (player.decks ?? []).entries()) {
  const at = `deck ${i} (${d.legend ?? 'no legend'})`;
  only(d, ['legend', 'name', 'url', 'note', 'updated'], at);
  if (!d.legend) errors.push(`${at}: legend is required`);
  if (!specific(d.url ?? '')) errors.push(`${at}: url must link to the decklist itself`);
  if (d.updated != null && !DATE.test(d.updated)) errors.push(`${at}: updated must be YYYY-MM-DD`);
}
for (const [i, r] of (player.results ?? []).entries()) {
  const at = `result ${i} (${r.date ?? 'no date'})`;
  only(r, ['date', 'event', 'format', 'legend', 'record', 'placement', 'players'], at);
  if (!DATE.test(r.date ?? '') || !r.event || !r.legend) errors.push(`${at}: date, event and legend are required`);
  if (!/^\d+-\d+(-\d+)?$/.test(r.record ?? '')) errors.push(`${at}: record must look like 3-1 or 2-1-1`);
  if (r.players != null && !Number.isInteger(r.players)) errors.push(`${at}: players must be a whole number`);
}
const collection = JSON.parse(readFileSync(COLLECTION_FILE, 'utf8'));
only(collection, ['as_of', 'sets', 'top_cards'], 'riftbound-collection.json');
if ((collection.sets?.length || collection.top_cards?.length) && !DATE.test(collection.as_of ?? '')) errors.push('riftbound-collection.json: as_of (YYYY-MM-DD) is required when there is data');
for (const x of collection.sets ?? []) {
  only(x, ['set', 'owned', 'total'], `set ${x.set}`);
  if (!x.set || !Number.isInteger(x.owned) || !Number.isInteger(x.total) || x.owned > x.total) errors.push(`set ${x.set ?? '?'}: needs set, owned and total (owned <= total)`);
}
for (const c of collection.top_cards ?? []) {
  only(c, ['name', 'set', 'number', 'rarity', 'variance', 'price'], `card ${c.name}`);
  if (!c.name || !c.set || typeof c.price !== 'number') errors.push(`card ${c.name ?? '?'}: needs name, set and a numeric price`);
}

if (errors.length) {
  console.error(`Riftbound data has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`riftbound-calendar.json OK: ${rows.length} rows; riftbound-news.json OK: ${news.length} items; riftbound-rules.json OK`);
if (process.argv.includes('--check')) process.exit(0);

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error('CLOUDFLARE_API_TOKEN is not set');
  process.exit(1);
}

const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const statements = [
  "DELETE FROM rb_calendar WHERE visibility = 'public'",
  ...rows.map((r) => `INSERT INTO rb_calendar (${COLS.join(', ')}, visibility, updated_at) VALUES (${COLS.map((c) => q(c === 'status' ? r.status ?? 'confirmed' : r[c])).join(', ')}, 'public', datetime('now'))`),
  `CREATE TABLE IF NOT EXISTS rb_news (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, published TEXT NOT NULL,
    effective_date TEXT, source TEXT, summary TEXT, judge_note TEXT, url TEXT NOT NULL, updated_at TEXT)`,
  'DELETE FROM rb_news',
  ...news.map((n) => `INSERT INTO rb_news (${NEWS_COLS.join(', ')}, updated_at) VALUES (${NEWS_COLS.map((c) => q(n[c])).join(', ')}, datetime('now'))`),
];

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: statements.join(';\n') }),
});
const body = await res.json();
if (!res.ok || !body.success) {
  console.error('D1 load failed:', JSON.stringify(body.errors ?? body, null, 2));
  process.exit(1);
}

const check = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: "SELECT (SELECT COUNT(*) FROM rb_calendar WHERE visibility = 'public') AS n, (SELECT COUNT(*) FROM rb_news) AS news" }),
});
const counts = (await check.json()).result?.[0]?.results?.[0] ?? {};
if (counts.n !== rows.length || counts.news !== news.length) {
  console.error(`D1 count check failed: ${counts.n} public calendar rows (file ${rows.length}), ${counts.news} news rows (file ${news.length})`);
  process.exit(1);
}
console.log(`D1 riftbound loaded: ${counts.n} public calendar rows, ${counts.news} news rows`);

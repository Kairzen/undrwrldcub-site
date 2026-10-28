// Validates the Riftbound data files and loads them into the Cloudflare D1 database "riftbound".
// - src/data/riftbound-calendar.json -> rb_calendar: replaces every visibility='public' row. Private rows
//   (organizer deadlines) are written straight to D1 by the Riftbound watch and are never touched here.
// - src/data/riftbound-news.json -> rb_news: replaced in full (table created if missing).
// - src/data/riftbound-rules.json is site-only (judge corner); validated, not loaded.
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

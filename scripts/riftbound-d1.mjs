// Validates src/data/riftbound-calendar.json and loads it into the Cloudflare D1 database "riftbound".
// The JSON is the edit point for public rows; this script replaces every visibility='public' row in
// rb_calendar with the file's contents. Private rows (organizer deadlines) are written straight to D1
// by the Riftbound watch and are never touched here.
//
//   node scripts/riftbound-d1.mjs --check   validate only (no network)
//   node scripts/riftbound-d1.mjs           validate, then load D1 (needs CLOUDFLARE_API_TOKEN)
import { readFileSync } from 'node:fs';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'e440b44ac703f43ab686e2268162e7e0';
const DATABASE_ID = '33d5c10e-a888-4bf1-84c5-9544f31b2a06'; // D1 "riftbound"
const FILE = new URL('../src/data/riftbound-calendar.json', import.meta.url);

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
if (errors.length) {
  console.error(`riftbound-calendar.json has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`riftbound-calendar.json OK: ${rows.length} rows`);
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
  body: JSON.stringify({ sql: "SELECT COUNT(*) AS n FROM rb_calendar WHERE visibility = 'public'" }),
});
const n = (await check.json()).result?.[0]?.results?.[0]?.n;
if (n !== rows.length) {
  console.error(`D1 count check failed: ${n} public rows in D1, ${rows.length} in the file`);
  process.exit(1);
}
console.log(`D1 riftbound loaded: ${n} public rows`);

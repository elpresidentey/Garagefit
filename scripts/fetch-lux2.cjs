// Targeted round for the 6 rejected lux records. Dry run — review before applying.
// Usage: node scripts/fetch-lux2.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const JOBS = [
  { id: 'lexus-is-300-2024', year: 2024, make: 'Lexus', model: 'IS', q: ['2024 Lexus IS 300 sedan', 'Lexus IS XE30 2024', '2023 Lexus IS 300 front'] },
  { id: 'lexus-nx-350-2024', year: 2024, make: 'Lexus', model: 'NX', q: ['2024 Lexus NX 350', 'Lexus NX TAZA25 2024', '2023 Lexus NX 350 front'] },
  { id: 'lexus-rx-350-2024', year: 2024, make: 'Lexus', model: 'RX', q: ['2024 Lexus RX 350', 'Lexus RX ALA10 2024', '2023 Lexus RX 350 front'] },
  { id: 'lexus-ux-250h-2024', year: 2024, make: 'Lexus', model: 'UX', q: ['2024 Lexus UX 250h hybrid', 'Lexus UX ZA10 hybrid front', '2023 Lexus UX 250h'] },
  { id: 'mercedes-a-220-2024', year: 2024, make: 'Mercedes-Benz', model: 'A-Class', q: ['2024 Mercedes-Benz A-Class sedan', 'Mercedes A 220 V177 2024', '2023 A-Class sedan front'] },
  { id: 'mercedes-s-500-2024', year: 2024, make: 'Mercedes-Benz', model: 'S-Class', q: ['2024 Mercedes-Benz S-Class', 'Mercedes S 500 W223 2024', '2023 S-Class front'] },
];
const BAN = ['isf', 'is-f', 'nx200', 'nx300h', 'rx300', 'rx200t', 'rx450h', 'ux300e', 'glc', 'gla ', 'w221', 'v221', 'w222', 's63', 's65', 'amg gt', 'interior', 'detail', 'wreck', 'crash', 'taxi', 'police'];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
async function api(params, retries = 3) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  for (let a = 0; ; a++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && a < retries) {
      const wait = (res.status === 429 ? 15000 : 4000) * (a + 1);
      console.log(`  HTTP ${res.status} — backing off ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    throw new Error('HTTP ' + res.status);
  }
}
function score(title, info, v) {
  const t = norm(title);
  let s = 0;
  if (t.includes(norm(v.make).replace('benzzz', 'benz'))) s += 2;
  if (t.includes('mercedes')) s += 2;
  if (t.includes('lexus')) s += 3;
  const m = norm(v.model);
  if (t.includes(m)) s += 5; else s -= 5;
  if (/front/.test(t)) s += 2;
  if (/rear/i.test(t)) s -= 1;
  for (const b of ['interior', 'detail', 'engine', 'wheel', 'headlight', 'taillight', 'grille', 'bumper', 'mirror']) if (t.includes(b)) s -= 4;
  const years = title.match(/\b(19|20)\d{2}\b/g) || [];
  for (const y of years.map(Number)) {
    if (y === v.year) s += 1; else if (y < v.year - 1) s -= 6; else s -= 2;
  }
  if (/\.svg$/i.test(title)) s -= 8;
  if (info.width >= 1200) s += 1; else if (info.width < 600) s -= 2;
  if (!/\.(jpe?g)$/i.test(title)) s -= 1;
  return s;
}
(async () => {
  const out = [];
  for (const v of JOBS) {
    const cands = [];
    try {
      for (const q of v.q) {
        const j = await api({ action: 'query', generator: 'search', gsrsearch: q + ' automobile', gsrnamespace: '6', gsrlimit: '14', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName' });
        const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
        for (const p of pages) {
          const info = { title: p.title || '', url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || '', width: p.imageinfo?.[0]?.width || 0, artist: String(p.imageinfo?.[0]?.extmetadata?.Artist?.value || '').replace(/<[^>]*>/g, '').trim().slice(0, 80), license: String(p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value || '').replace(/<[^>]*>/g, '').trim().slice(0, 80) };
          if (!info.url || BAN.some((b) => norm(info.title).includes(b))) continue;
          cands.push({ ...info, score: score(info.title, info, v), query: q });
        }
        await sleep(900);
      }
    } catch (e) { console.log('ERR', v.id, e.message); }
    cands.sort((a, b) => b.score - a.score);
    console.log(`\n== ${v.id} (${cands.length} candidates)`);
    cands.slice(0, 4).forEach((c) => console.log(`   [${c.score}] ${c.title} (${c.query})`));
    out.push({ id: v.id, top: cands.slice(0, 4) });
    await sleep(600);
  }
  fs.writeFileSync(path.join(ROOT, 'image-lux2.json'), JSON.stringify(out, null, 2));
  console.log('\nWrote image-lux2.json (review, no auto-apply)');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

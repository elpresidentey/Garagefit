// Round 3 for the 12 remaining photo-less records: twin-name (X-Trail, Levin,
// Wildlander), trim-specific (Trail Boss, ZR2, XLT, Lariat) and no-year queries.
// Dry run only — results reviewed before applying.
// Usage: node scripts/fetch-round3.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JOBS = [
  { id: 'ford-f-150-2017-supercrew-27', year: 2017, make: 'Ford', model: 'F-150', q: ['2017 Ford F-150 XLT SuperCrew', '2017 Ford F-150 Lariat', 'Ford F-150 thirteenth generation pickup', '2016 Ford F-150 SuperCrew'] },
  { id: 'honda-civic-2017-lx-20', year: 2017, make: 'Honda', model: 'Civic', q: ['2017 Honda Civic EX sedan', 'Honda Civic tenth generation sedan', '2016 Honda Civic sedan'] },
  { id: 'chevrolet-silverado-1500-2018-crew-53l', year: 2018, make: 'Chevrolet', model: 'Silverado 1500', q: ['2017 Chevrolet Silverado LTZ Crew Cab', '2018 Silverado High Country', '2016 Silverado LT Crew Cab facelift'] },
  { id: 'nissan-rogue-2018-sv-awd', year: 2018, make: 'Nissan', model: 'Rogue', q: ['2018 Nissan X-Trail', 'Dongfeng Nissan X-Trail 2018', 'Nissan Rogue T32 facelift', '2017 Nissan Rogue SV'] },
  { id: 'nissan-rogue-2019-sv-awd', year: 2019, make: 'Nissan', model: 'Rogue', q: ['2019 Nissan X-Trail', 'Nissan Rogue T32 facelift SUV', '2019 Rogue SV front'] },
  { id: 'chevrolet-silverado-2021-53', year: 2021, make: 'Chevrolet', model: 'Silverado', q: ['2021 Silverado Trail Boss', '2021 Silverado RST Crew Cab', '2021 Silverado LT pickup'] },
  { id: 'toyota-corolla-2021-le', year: 2021, make: 'Toyota', model: 'Corolla', q: ['GAC Toyota Levin sedan 2021', 'Toyota Corolla E210 sedan', '2020 Toyota Corolla sedan front'] },
  { id: 'chevrolet-silverado-2022-53', year: 2022, make: 'Chevrolet', model: 'Silverado', q: ['2022 Silverado ZR2', '2022 Silverado LT Crew Cab', '2022 Silverado RST'] },
  { id: 'toyota-corolla-2022-le', year: 2022, make: 'Toyota', model: 'Corolla', q: ['GAC Toyota Levin sedan 2022', 'Toyota Levin E210 front', '2021 Toyota Corolla sedan'] },
  { id: 'toyota-rav4-2022-xle', year: 2022, make: 'Toyota', model: 'RAV4', q: ['GAC Toyota Wildlander 2022', 'Toyota RAV4 XA50 hybrid front', '2021 Toyota RAV4 XLE'] },
  { id: 'chevrolet-silverado-2023-53', year: 2023, make: 'Chevrolet', model: 'Silverado', q: ['2023 Silverado LT Crew Cab', '2023 Silverado RST', '2023 Silverado High Country'] },
  { id: 'ford-f-150-2023-27', year: 2023, make: 'Ford', model: 'F-150', q: ['2023 Ford F-150 XLT', '2023 Ford F-150 Lariat SuperCrew', 'Ford F-150 fourteenth generation'] },
];

const BAN = ['nascar', 'cooperstandard', 'raptor', 'shelby', 'lightning', 'roguesport', 'corollacross', 'xa40', 'xa30', 'krom', 'artcar', 'corollaim', '1999chevrolet', '2011chevrolet', 'silveradointerior', '2500hd', '3500hd', '2500', '3500', 'e150', 'civicvi', 'vi sedan'];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const banned = (title) => BAN.some((b) => norm(title).includes(b));
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);

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
async function search(q) {
  const j = await api({ action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '14', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName' });
  if (!j.query || !j.query.pages) return [];
  return Object.values(j.query.pages).map((p) => ({
    title: p.title || '', url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || '',
    width: p.imageinfo?.[0]?.width || 0,
    artist: stripHtml(p.imageinfo?.[0]?.extmetadata?.Artist?.value),
    license: stripHtml(p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value),
  }));
}
function score(title, info, v) {
  const t = norm(title);
  let s = 0;
  if (t.includes(norm(v.make))) s += 3;
  const parts = v.model.toLowerCase().split(/[\s-]+/).map((p) => p.replace(/[^a-z0-9]/g, '')).filter((p) => p.length > 1 && p !== '1500');
  const hit = parts.filter((p) => t.includes(p)).length;
  if (parts.length && hit === parts.length) s += 5; else s -= 5;
  // twin names count as model hits
  if (/rogue/.test(v.model.toLowerCase()) && t.includes('xtrail')) s += 5;
  if (/corolla/.test(v.model.toLowerCase()) && t.includes('levin')) s += 5;
  if (/rav4/.test(v.model.toLowerCase()) && t.includes('wildlander')) s += 5;
  if (/front/.test(t)) s += 2;
  for (const b of ['interior', 'dashboard', 'cockpit', 'engine', 'badge', 'logo', 'emblem', 'crash', 'police', 'taxi', 'wreck', 'salvage', 'headlight', 'taillight', 'wheel', 'charger', 'port', 'plug', 'close', 'detail', 'macro', 'trunk', 'frunk', 'mirror', 'handle', 'grille', 'bumper']) {
    if (t.includes(b)) s -= 4;
  }
  const years = title.match(/\b(19|20)\d{2}\b/g) || [];
  for (const y of years.map(Number)) {
    if (y === v.year) s += 1; else if (y < v.year - 1) s -= 6; else s -= 2;
  }
  if (/\.svg$/i.test(title)) s -= 8;
  if (/\.tiff?$/i.test(title)) s -= 4;
  if (/rear/i.test(title)) s -= 1;
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
        const found = await search(q + ' automobile');
        for (const c of found) {
          if (!c.url || banned(c.title)) continue;
          cands.push({ ...c, score: score(c.title, c, v), query: q });
        }
        await sleep(900);
      }
    } catch (e) { console.log('ERR', v.id, e.message); }
    cands.sort((a, b) => b.score - a.score);
    const top = cands.slice(0, 3).map((c) => `[${c.score}] ${c.title} (${c.query})`);
    console.log(`\n== ${v.id} (${cands.length} candidates)`);
    top.forEach((t) => console.log('   ' + t));
    out.push({ id: v.id, top3: top });
    await sleep(600);
  }
  fs.writeFileSync(path.join(ROOT, 'image-round3.json'), JSON.stringify(out, null, 2));
  console.log('\nWrote image-round3.json (review, no auto-apply)');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

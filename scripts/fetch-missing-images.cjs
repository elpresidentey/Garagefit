// Targeted re-fetch for the 16 photo-less records, with generation-code queries
// and the previously-rejected wrong vehicles blacklisted.
// Usage: node scripts/fetch-missing-images.cjs [--apply]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data.ts');
const APPLY = process.argv.includes('--apply');
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JOBS = [
  { id: 'toyota-camry-2015-le-25', year: 2015, make: 'Toyota', model: 'Camry', q: ['2015 Toyota Camry sedan', 'Toyota Camry XV50 2015', '2015 Camry LE car'] },
  { id: 'ford-f-150-2017-supercrew-27', year: 2017, make: 'Ford', model: 'F-150', q: ['2017 Ford F-150 SuperCrew', 'Ford F-150 P552 2017', '2017 F-150 XLT pickup'] },
  { id: 'honda-civic-2017-lx-20', year: 2017, make: 'Honda', model: 'Civic', q: ['2017 Honda Civic sedan', 'Honda Civic FC 2017', '2017 Civic LX sedan'] },
  { id: 'toyota-corolla-2017-le-18', year: 2017, make: 'Toyota', model: 'Corolla', q: ['2017 Toyota Corolla sedan', 'Toyota Corolla E170 2017', '2017 Corolla LE sedan'] },
  { id: 'chevrolet-silverado-1500-2018-crew-53l', year: 2018, make: 'Chevrolet', model: 'Silverado 1500', q: ['2018 Chevrolet Silverado Crew Cab', 'Chevrolet Silverado K2XX 2018', '2018 Silverado LT pickup'] },
  { id: 'nissan-rogue-2018-sv-awd', year: 2018, make: 'Nissan', model: 'Rogue', q: ['2018 Nissan Rogue', 'Nissan Rogue T32 2018', '2018 Rogue SV SUV'] },
  { id: 'nissan-rogue-2019-sv-awd', year: 2019, make: 'Nissan', model: 'Rogue', q: ['2019 Nissan Rogue', 'Nissan Rogue T32 2019', '2019 Rogue SV SUV'] },
  { id: 'toyota-corolla-2020-le', year: 2020, make: 'Toyota', model: 'Corolla', q: ['2020 Toyota Corolla sedan', 'Toyota Corolla E210 2020', '2020 Corolla LE sedan'] },
  { id: 'chevrolet-silverado-2021-53', year: 2021, make: 'Chevrolet', model: 'Silverado', q: ['2021 Chevrolet Silverado Crew Cab', 'Chevrolet Silverado T1 2021', '2021 Silverado RST pickup'] },
  { id: 'toyota-corolla-2021-le', year: 2021, make: 'Toyota', model: 'Corolla', q: ['2021 Toyota Corolla sedan', 'Toyota Corolla E210 2021', '2021 Corolla LE sedan'] },
  { id: 'chevrolet-silverado-2022-53', year: 2022, make: 'Chevrolet', model: 'Silverado', q: ['2022 Chevrolet Silverado Crew Cab', 'Chevrolet Silverado T1 2022 refresh', '2022 Silverado LT pickup'] },
  { id: 'toyota-corolla-2022-le', year: 2022, make: 'Toyota', model: 'Corolla', q: ['2022 Toyota Corolla sedan', 'Toyota Corolla E210 2022', '2022 Corolla LE sedan'] },
  { id: 'toyota-rav4-2022-xle', year: 2022, make: 'Toyota', model: 'RAV4', q: ['2022 Toyota RAV4', 'Toyota RAV4 XA50 2022', '2022 RAV4 XLE SUV'] },
  { id: 'chevrolet-silverado-2023-53', year: 2023, make: 'Chevrolet', model: 'Silverado', q: ['2023 Chevrolet Silverado Crew Cab', 'Chevrolet Silverado T1 2023', '2023 Silverado LT pickup'] },
  { id: 'ford-f-150-2023-27', year: 2023, make: 'Ford', model: 'F-150', q: ['2023 Ford F-150 SuperCrew', 'Ford F-150 P702 2023', '2023 F-150 XLT gas pickup'] },
  { id: 'toyota-corolla-2023-le', year: 2023, make: 'Toyota', model: 'Corolla', q: ['2023 Toyota Corolla sedan', 'Toyota Corolla E210 2023', '2023 Corolla LE sedan'] },
];

// Normalized-substring blacklist: previously accepted wrong vehicles.
const BAN = ['nascar', 'cooperstandard', 'lightning', 'roguesport', 'corollacross', 'xa40', 'krom', 'artcar', 'corollaim', 'civicse vtec1.0', '1999chevrolet', '2011chevrolet', 'silveradointerior', 'ez-6', 'ez6'];
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
  const j = await api({ action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName' });
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
  const parts = v.model.toLowerCase().split(/[\s-]+/).map((p) => p.replace(/[^a-z0-9]/g, '')).filter((p) => p.length > 1);
  const hit = parts.filter((p) => t.includes(p)).length;
  if (parts.length && hit === parts.length) s += 5; else s -= 5;
  if (/front/.test(t)) s += 2;
  for (const b of ['interior', 'dashboard', 'cockpit', 'engine', 'badge', 'logo', 'emblem', 'crash', 'police', 'taxi', 'wreck', 'salvage', 'headlight', 'taillight', 'wheel', 'charger', 'port', 'plug', 'close', 'detail', 'macro', 'trunk', 'frunk', 'mirror', 'handle', 'grille', 'bumper', 'sport']) {
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
    let best = null;
    try {
      for (const q of v.q) {
        const cands = await search(q + ' automobile');
        for (const c of cands) {
          if (!c.url || banned(c.title)) continue;
          const sc = score(c.title, c, v);
          if (!best || sc > best.score) best = { ...c, score: sc, query: q };
        }
        if (best && best.score >= 9) break;
        await sleep(900);
      }
    } catch (e) { console.log('ERR', v.id, e.message); }
    const ok = best && best.score >= 6;
    out.push({ id: v.id, score: best?.score ?? null, title: best?.title ?? null, url: ok ? best.url : null, artist: ok ? best.artist : null, license: ok ? best.license : null, status: ok ? 'match' : 'MISS' });
    console.log((ok ? 'OK ' : 'MISS') + ` [${best?.score ?? '-'}] ${v.id} <- ${best?.title ?? 'none'}`);
    await sleep(900);
  }
  fs.writeFileSync(path.join(ROOT, 'image-round2.json'), JSON.stringify(out, null, 2));
  console.log(`\n${out.filter((r) => r.status === 'match').length}/${out.length} matched.`);
  if (APPLY) {
    let src = fs.readFileSync(DATA, 'utf8');
    let n = 0;
    for (const r of out) {
      if (r.status !== 'match') continue;
      const credit = `Photo: ${r.artist || 'Wikimedia Commons contributor'} via Wikimedia Commons (${r.license || 'CC'})`.replace(/"/g, "'");
      const anchor = `{id:"${r.id}"`;
      const idx = src.indexOf(anchor);
      if (idx === -1) { console.log('ANCHOR MISS', r.id); continue; }
      const eol = src.indexOf('\n', idx);
      let line = src.slice(idx, eol === -1 ? undefined : eol);
      if (line.includes('imageUrl:')) { console.log('SKIP (has image)', r.id); continue; }
      line = line.replace(/},?\s*$/, (m) => `,imageUrl:"${r.url}",imageCredit:"${credit}"` + m);
      src = src.slice(0, idx) + line + (eol === -1 ? '' : src.slice(eol));
      n++;
    }
    fs.writeFileSync(DATA, src);
    console.log(`Applied ${n} imageUrls`);
  } else console.log('Dry run — re-run with --apply');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

// Round 2: targeted re-queries for misses + wrong-generation picks.
// Usage: node scripts/fetch-round2.cjs [--apply]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data.ts');
const REPORT = path.join(ROOT, 'image-report.json');
const APPLY = process.argv.includes('--apply');
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// id -> [vehicle descriptor, ...custom queries]
const TARGETS = {
  'toyota-rav4-2024-le': [{ year: 2024, make: 'Toyota', model: 'RAV4' }, ['Toyota RAV4 XA50 2024 front', '2024 Toyota RAV4 XLE front right']],
  'honda-hr-v-2024': [{ year: 2024, make: 'Honda', model: 'HR-V' }, ['Honda HR-V 2024 front', '2024 Honda HR-V EX-L']],
  'mercedes-c-2024': [{ year: 2024, make: 'Mercedes-Benz', model: 'C-Class' }, ['Mercedes-Benz C-Class W206 2024', 'Mercedes C 200 W206 front']],
  'mercedes-glc-2024': [{ year: 2024, make: 'Mercedes-Benz', model: 'GLC' }, ['Mercedes-Benz GLC X254 2023 front', '2024 Mercedes GLC 300']],
  'audi-q5-2024': [{ year: 2024, make: 'Audi', model: 'Q5' }, ['Audi Q5 2024 front', 'Audi Q5 FY 2023']],
  'subaru-outback-2024': [{ year: 2024, make: 'Subaru', model: 'Outback' }, ['Subaru Outback 2024 Wilderness front', 'Subaru Legacy Outback 2023']],
  'hyundai-santa-fe-2024': [{ year: 2024, make: 'Hyundai', model: 'Santa Fe' }, ['Hyundai Santa Fe MX5 2024 front', '2024 Hyundai Santa Fe Calligraphy']],
  'ram-1500-2024': [{ year: 2024, make: 'Ram', model: '1500' }, ['Ram 1500 2024 front', '2024 Ram 1500 Laramie']],
  'honda-pilot-2024': [{ year: 2024, make: 'Honda', model: 'Pilot' }, ['Honda Pilot 2024 TrailSport front', '2024 Honda Pilot Elite']],
  'kia-sportage-hybrid-2024': [{ year: 2024, make: 'Kia', model: 'Sportage Hybrid' }, ['Kia Sportage HEV 2024 front', '2024 Kia Sportage Hybrid']],
  'mazda-3-2024': [{ year: 2024, make: 'Mazda', model: '3' }, ['Mazda 3 sedan 2024 front', 'Mazda3 BP 2024']],
  'chevrolet-silverado-2024': [{ year: 2024, make: 'Chevrolet', model: 'Silverado' }, ['Chevrolet Silverado 1500 2024 front', '2024 Chevrolet Silverado RST']],
  'vw-id4-2024': [{ year: 2024, make: 'Volkswagen', model: 'ID.4' }, ['Volkswagen ID.4 2024 front', 'VW ID.4 Pro 2023']],
  'chevrolet-bolt-euv-2024': [{ year: 2024, make: 'Chevrolet', model: 'Bolt EUV' }, ['Chevrolet Bolt EUV 2023 front', '2022 Chevrolet Bolt EUV']],
  'rivian-r1t-2024': [{ year: 2024, make: 'Rivian', model: 'R1T' }, ['Rivian R1T 2024 front three quarter', 'Rivian R1T Petersen Museum']],
  'kia-sportage-phev-2024': [{ year: 2024, make: 'Kia', model: 'Sportage PHEV' }, ['Kia Sportage plug-in hybrid X-Line 2023 front', '2023 Kia Sportage PHEV']],
};

const ONLY = new Set(['rivian-r1t-2024', 'kia-sportage-phev-2024']); // round 3: only these
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);

async function api(params, retries = 3) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  for (let a = 0; ; a++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && a < retries) {
      await sleep((res.status === 429 ? 15000 : 4000) * (a + 1));
      continue;
    }
    throw new Error('HTTP ' + res.status);
  }
}
async function search(q) {
  const j = await api({
    action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '6',
    gsrlimit: '12', prop: 'imageinfo', iiprop: 'url|size|extmetadata',
    iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName',
  });
  if (!j.query || !j.query.pages) return [];
  return Object.values(j.query.pages).map((p) => ({
    title: p.title || '',
    url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || '',
    width: p.imageinfo?.[0]?.width || 0,
    artist: stripHtml(p.imageinfo?.[0]?.extmetadata?.Artist?.value),
    license: stripHtml(p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value),
  }));
}

function score(title, info, v) {
  const t = norm(title);
  let s = 0;
  if (t.includes(norm(v.make))) s += 3;
  else if (/mercedes/.test(t) && /mercedes/.test(norm(v.make))) s += 3;
  let parts = v.model.toLowerCase().split(/[\s-]+/).map((p) => p.replace(/[^a-z0-9]/g, '')).filter((p) => p.length > 1);
  // Alias: HEV~=hybrid, plug-in~=phev; numeric models ("3", "Q5", "ID.4") match compact form.
  const wanted = new Set(parts);
  if (wanted.has('hybrid')) wanted.add('hev');
  if (wanted.has('phev')) { wanted.add('phev'); wanted.add('plugin'); }
  const compact = norm(v.make + v.model);
  if (parts.length === 0) {
    if (t.includes(compact)) s += 5; else s -= 5;
  } else {
    const hit = [...wanted].filter((p) => t.includes(p)).length;
    const need = parts.length;
    const got = parts.filter((p) => t.includes(p) || (p === 'hybrid' && t.includes('hev')) || (p === 'phev' && (t.includes('phev') || t.includes('plugin')))).length;
    if (got === need) s += 5; else s -= 5;
    void hit;
  }
  if (/front/.test(t)) s += 2;
  for (const b of ['interior', 'dashboard', 'cockpit', 'engine', 'badge', 'logo', 'emblem', 'crash', 'police', 'taxi', 'wreck', 'salvage', 'headlight', 'taillight', 'wheel',
    'füll', 'stutzen', 'filler', 'flap', 'tank', 'charg', 'close', 'detail', 'macro', 'trunk', 'frunk', 'mirror', 'handle', 'grille', 'bumper', 'row']) {
    if (t.includes(b)) s -= 4;
  }
  const years = title.match(/\b(19|20)\d{2}\b/g) || [];
  for (const y of years.map(Number)) {
    if (y === v.year) s += 1;
    else if (y < v.year - 1) s -= 6;
    else s -= 2;
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
  for (const [id, [v, queries]] of Object.entries(TARGETS)) {
    if (!ONLY.has(id)) continue;
    let best = null;
    try {
      for (const q of queries) {
        const cands = await search(q);
        for (const c of cands) {
          if (!c.url) continue;
          const sc = score(c.title, c, v);
          if (!best || sc > best.score) best = { ...c, score: sc, query: q };
        }
        if (best && best.score >= 9) break;
        await sleep(900);
      }
    } catch (e) { console.log('ERR', id, e.message); }
    const ok = best && best.score >= 6;
    out.push({ id, score: best?.score ?? null, title: best?.title ?? null, url: ok ? best.url : null, artist: ok ? best.artist : null, license: ok ? best.license : null, status: ok ? 'match' : 'MISS' });
    console.log((ok ? 'OK ' : 'MISS') + ` [${best?.score ?? '-'}] ${id} <- ${best?.title ?? 'none'}`);
    await sleep(900);
  }
  fs.writeFileSync(path.join(ROOT, 'image-round2.json'), JSON.stringify(out, null, 2));
  console.log(`\n${out.filter((r) => r.status === 'match').length}/${out.length} matched.`);

  if (APPLY) {
    let src = fs.readFileSync(DATA, 'utf8');
    const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
    let n = 0;
    for (const r of out) {
      if (r.status !== 'match') continue;
      const credit = `Photo: ${r.artist || 'Wikimedia Commons contributor'} via Wikimedia Commons (${r.license || 'CC'})`.replace(/"/g, "'");
      const re = new RegExp(`(\\{id:"${r.id}".*?)(,imageUrl:"[^"]*",imageCredit:"[^"]*")?(\\},?\\s*$)`, 'm');
      // fallback: line-based replace
      const lines = src.split('\n');
      const li = lines.findIndex((l) => l.includes(`{id:"${r.id}"`));
      if (li === -1) { console.log('ANCHOR MISS', r.id); continue; }
      lines[li] = lines[li].replace(/,imageUrl:"[^"]*",imageCredit:"[^"]*"/, '').replace(/},?\s*$/, (m) => `,imageUrl:"${r.url}",imageCredit:"${credit}"` + m);
      src = lines.join('\n');
      const rep = report.find((x) => x.id === r.id);
      if (rep) Object.assign(rep, { score: r.score, title: r.title, url: r.url, artist: r.artist, license: r.license, status: 'match' });
      n++;
    }
    fs.writeFileSync(DATA, src);
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.log(`Updated ${n} records (+ report). Backup: src/data.ts.bak`);
  } else {
    console.log('Dry run — re-run with --apply');
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

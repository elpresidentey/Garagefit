// Bulk-enrich src/data.ts with Wikimedia Commons photos.
// Usage: node scripts/fetch-images.cjs  [--apply]
// Without --apply: dry run, writes image-report.json only.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data.ts');
const REPORT = path.join(ROOT, 'image-report.json');
const APPLY = process.argv.includes('--apply');
const REQUERY = new Set(['toyota-mirai-2024', 'subaru-outback-2024']); // bad-gen/detail shots from round 1
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseVehicles(src) {
  const ids = [];
  const re = /\{id:"([^"]+)",year:(\d+),make:"([^"]+)",model:"([^"]+)",trim:"([^"]+)",body:"([^"]+)",seats:(\d+),/g;
  let m;
  while ((m = re.exec(src))) ids.push({ id: m[1], year: +m[2], make: m[3], model: m[4] });
  return ids;
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
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
  const parts = v.model.toLowerCase().split(/[\s-]+/).map((p) => p.replace(/[^a-z0-9]/g, '')).filter((p) => p.length > 1);
  const hit = parts.filter((p) => t.includes(p)).length;
  if (parts.length && hit === parts.length) s += 5;
  else s -= 5;
  if (/front/.test(t)) s += 2; // "front right" style titles are usually full exterior shots
  for (const b of ['interior', 'dashboard', 'cockpit', 'engine', 'badge', 'logo', 'emblem', 'crash', 'police', 'taxi', 'wreck', 'salvage', 'headlight', 'taillight', 'wheel',
    'füll', 'stutzen', 'filler', 'flap', 'tank', 'charg', 'port', 'plug', 'close', 'detail', 'macro', 'trunk', 'frunk', 'mirror', 'handle', 'grille', 'bumper']) {
    if (t.includes(b)) s -= 4;
  }
  const years = title.match(/\b(19|20)\d{2}\b/g) || [];
  for (const y of years.map(Number)) {
    if (y === v.year) s += 1;
    else if (y < v.year - 1) s -= 6; // photo of a much older model year
    else s -= 2; // some other year (often just the photo date)
  }
  if (/\.svg$/i.test(title)) s -= 8;
  if (/\.tiff?$/i.test(title)) s -= 4;
  if (/rear/i.test(title)) s -= 1;
  if (info.width >= 1200) s += 1; else if (info.width < 600) s -= 2;
  if (!/\.(jpe?g)$/i.test(title)) s -= 1;
  return s;
}

(async () => {
  const src = fs.readFileSync(DATA, 'utf8');
  const vehicles = parseVehicles(src);
  console.log('vehicles:', vehicles.length);
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* first run */ }
  const prevById = Object.fromEntries(prev.filter((r) => r.status === 'match' && !REQUERY.has(r.id)).map((r) => [r.id, r]));
  console.log('reusing', Object.keys(prevById).length, 'previous matches');
  const results = [];
  for (const v of vehicles) {
    if (prevById[v.id]) {
      // Re-score old pick under the improved rules; keep it only if it still passes.
      const kept = prevById[v.id];
      const rescore = score(kept.title || '', { width: 1200 }, v);
      if (rescore >= 6) {
        results.push(kept);
        console.log(`KEEP [~${rescore}] ${v.id} <- ${kept.title}`);
        continue;
      }
      console.log(`RECHECK (rescore ${rescore}) ${v.id}`);
    }
    let best = null;
    const queries = [`${v.year} ${v.make} ${v.model} automobile`, `${v.make} ${v.model} ${v.year} car`];
    try {
      for (const q of queries) {
        const cands = await search(q);
        for (const c of cands) {
          if (!c.url) continue;
          const sc = score(c.title, c, v);
          if (!best || sc > best.score) best = { ...c, score: sc, query: q };
        }
        if (best && best.score >= 8) break;
        await sleep(900);
      }
    } catch (e) {
      console.log('ERR', v.id, e.message);
    }
    const ok = best && best.score >= 6;
    results.push({ id: v.id, year: v.year, make: v.make, model: v.model, score: best?.score ?? null, title: best?.title ?? null, url: ok ? best.url : null, artist: ok ? best.artist : null, license: ok ? best.license : null, status: ok ? 'match' : 'MISS' });
    console.log((ok ? 'OK ' : 'MISS') + ` [${best?.score ?? '-'}] ${v.id} <- ${best?.title ?? 'none'}`);
    await sleep(900);
  }
  fs.writeFileSync(REPORT, JSON.stringify(results, null, 2));
  const hits = results.filter((r) => r.status === 'match').length;
  console.log(`\n${hits}/${results.length} matched. Report: image-report.json`);

  if (APPLY) {
    let out = src;
    let n = 0;
    for (const r of results) {
      if (r.status !== 'match') continue;
      const credit = `Photo: ${r.artist || 'Wikimedia Commons contributor'} via Wikimedia Commons (${r.license || 'CC'})`.replace(/"/g, "'");
      const anchor = `{id:"${r.id}"`;
      const idx = out.indexOf(anchor);
      if (idx === -1) { console.log('ANCHOR MISS', r.id); continue; }
      const eol = out.indexOf('\n', idx);
      let line = out.slice(idx, eol === -1 ? undefined : eol);
      line = line.replace(/},?\s*$/, (m) => `,imageUrl:"${r.url}",imageCredit:"${credit}"` + m);
      out = out.slice(0, idx) + line + (eol === -1 ? '' : out.slice(eol));
      n++;
    }
    fs.copyFileSync(DATA, DATA + '.bak');
    fs.writeFileSync(DATA, out);
    console.log(`Applied ${n} imageUrls (backup: src/data.ts.bak)`);
  } else {
    console.log('Dry run — re-run with --apply to write src/data.ts');
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

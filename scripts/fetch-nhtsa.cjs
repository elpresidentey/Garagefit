// Enrich src/data.ts with NHTSA 5-star overall safety ratings (free, no key).
// Usage: node scripts/fetch-nhtsa.cjs [--apply]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data.ts');
const REPORT = path.join(ROOT, 'nhtsa-report.json');
const APPLY = process.argv.includes('--apply');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseVehicles(src) {
  const out = [];
  const re = /\{id:"([^"]+)",year:(\d+),make:"([^"]+)",model:"([^"]+)",trim:"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], year: +m[2], make: m[3], model: m[4], trim: m[5] });
  return out;
}
async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
// Candidate NHTSA model slugs for our model name.
function modelVariants(model) {
  const v = [model];
  const noSpace = model.replace(/[\s-]+/g, '');
  if (noSpace !== model) v.push(noSpace);
  // "CR-V" often listed "CR-V"; "Model Y" as "Model Y"; "3 Series" stays.
  v.push(model.replace('-', ' '));
  return [...new Set(v)];
}
function pickVariant(results, trim) {
  if (!results.length) return null;
  const t = trim.toUpperCase();
  const wantsAWD = /AWD|4WD|4X4|QUATTRO|XDRIVE|4MATIC/.test(t);
  const wantsRWD = /RWD|RWD|2WD|FWD/.test(t) && !wantsAWD;
  const scored = results.map((r) => {
    const d = (r.VehicleDescription || '').toUpperCase();
    let s = 0;
    if (wantsAWD && /AWD|4WD|4X4|QUATTRO|XDRIVE|4MATIC/.test(d)) s += 2;
    if (!wantsAWD && /FWD|2WD/.test(d)) s += 1;
    return { r, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.r); // best-first; caller tries each until a numeric rating is found
}

(async () => {
  const src = fs.readFileSync(DATA, 'utf8');
  const vehicles = parseVehicles(src);
  console.log('vehicles:', vehicles.length);
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* first run */ }
  const prevById = Object.fromEntries(prev.filter((r) => r.status === 'rated').map((r) => [r.id, r]));
  const results = [];
  for (const v of vehicles) {
    if (prevById[v.id]) { results.push(prevById[v.id]); console.log(`KEEP ${v.id} <- ${prevById[v.id].stars}`); continue; }
    let entry = { id: v.id, status: 'MISS', stars: null, desc: null, nhtsaId: null };
    try {
      let options = [];
      for (const mv of modelVariants(v.model)) {
        const url = `https://api.nhtsa.gov/SafetyRatings/modelyear/${v.year}/make/${encodeURIComponent(v.make)}/model/${encodeURIComponent(mv)}?format=json`;
        const j = await get(url);
        if (j.Count > 0 && j.Results?.length) { options = j.Results; break; }
        await sleep(250);
      }
      const picks = pickVariant(options, v.trim);
      for (const pick of picks) {
        const det = await get(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${pick.VehicleId}?format=json`);
        const r = det.Results?.[0] || {};
        if (/^\d$/.test(r.OverallRating || '')) {
          entry = {
            id: v.id, status: 'rated', stars: +r.OverallRating,
            desc: pick.VehicleDescription, nhtsaId: pick.VehicleId,
            front: r.OverallFrontStarRating || null, side: r.OverallSideStarRating || null,
          };
          break;
        }
        // keep the best-match description even when unrated
        if (!entry.desc) entry = { id: v.id, status: 'unrated', stars: null, desc: pick.VehicleDescription, nhtsaId: pick.VehicleId };
        await sleep(250);
      }
    } catch (e) { entry = { id: v.id, status: 'ERR:' + e.message, stars: null }; }
    results.push(entry);
    console.log(`${entry.status === 'rated' ? 'OK  ' : 'MISS'} [${entry.stars ?? '-'}] ${v.id} <- ${entry.desc ?? 'none'}`);
    await sleep(500);
  }
  fs.writeFileSync(REPORT, JSON.stringify(results, null, 2));
  console.log(`\n${results.filter((r) => r.status === 'rated').length}/${results.length} rated.`);

  if (APPLY) {
    let out = src;
    let n = 0;
    for (const r of results) {
      if (r.status !== 'rated') continue;
      const anchor = `{id:"${r.id}"`;
      const idx = out.indexOf(anchor);
      if (idx === -1) { console.log('ANCHOR MISS', r.id); continue; }
      const eol = out.indexOf('\n', idx);
      let line = out.slice(idx, eol === -1 ? undefined : eol);
      line = line.replace(/,nhtsaStars:\d+/, '').replace(/},?\s*$/, (m) => `,nhtsaStars:${r.stars}` + m);
      out = out.slice(0, idx) + line + (eol === -1 ? '' : out.slice(eol));
      n++;
    }
    fs.copyFileSync(DATA, DATA + '.bak3');
    fs.writeFileSync(DATA, out);
    console.log(`Applied ${n} nhtsaStars (backup: src/data.ts.bak3)`);
  } else {
    console.log('Dry run — re-run with --apply');
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

// Curated re-fetch for vehicles whose round-1 image was the wrong generation/market.
// Searches Commons with generation-aware queries, prints top candidates per id.
// Usage: node scripts/refetch-bad-images.cjs [id ...]   (no ids = all targets, dry run only)
const UA = 'GarageFit/1.0 (curated image fix; open-source vehicle comparison demo)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);

// id -> generation-aware queries (model codes make old gens rank out)
const TARGETS = {
  'vw-jetta-2024': ['Volkswagen Jetta 2024', 'Volkswagen Jetta Mk7 facelift', 'Volkswagen Jetta 2023 front'],
  'bmw-3-2024': ['BMW 3 Series G20 2024', 'BMW G20 330i front', '2024 BMW 3 Series sedan front'],
  'bmw-x5-2024': ['BMW X5 G05 2024', 'BMW X5 LCI 2024 front', '2024 BMW X5 xDrive40i'],
  'toyota-sienna-2024': ['Toyota Sienna 2022 front', 'Toyota Sienna XSE 2021', 'Toyota Sienna 2021 Platinum'],
  'honda-odyssey-2024': ['2024 Honda Odyssey front', 'Honda Odyssey 2021 facelift front', 'Honda Odyssey RL6'],
  'audi-q5-2024': ['2024 Audi Q5 front', 'Audi Q5 FY 2024 front', 'Audi Q5 2023 front'],
  'dodge-durango-2024': ['Dodge Durango 2022 front', '2023 Dodge Durango front', 'Dodge Durango 2021 SRT front'],
};

async function api(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

(async () => {
  const only = process.argv.slice(2);
  for (const [id, queries] of Object.entries(TARGETS)) {
    if (only.length && !only.includes(id)) continue;
    console.log(`\n=== ${id} ===`);
    for (const q of queries) {
      try {
        const j = await api({
          action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '6',
          gsrlimit: '8', prop: 'imageinfo', iiprop: 'url|size|extmetadata',
          iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName',
        });
        const pages = Object.values(j.query?.pages || {});
        console.log(`  [q] ${q}`);
        for (const p of pages) {
          const ii = p.imageinfo?.[0];
          if (!ii) continue;
          console.log(`    ${p.title} | ${ii.width}x${ii.height} | ${stripHtml(ii.extmetadata?.Artist?.value)} | ${stripHtml(ii.extmetadata?.LicenseShortName?.value)}`);
          console.log(`      ${ii.thumburl || ii.url}`);
        }
      } catch (e) {
        console.log('  ERR', q, e.message);
      }
      await sleep(900);
    }
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

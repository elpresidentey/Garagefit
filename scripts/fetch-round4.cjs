// Round 4: last two gaps — Silverado 1500 T1 (2021, 2022). Prints top candidates.
// Usage: node scripts/fetch-round4.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const JOBS = [
  { id: 'chevrolet-silverado-2021-53', year: 2021, q: ['2021 Silverado High Country Crew Cab', '2021 Silverado LTZ', 'Chevrolet Silverado 1500 2021 front', '2021 Silverado Custom pickup', 'Silverado T1XX Crew Cab'] },
  { id: 'chevrolet-silverado-2022-53', year: 2022, make: 'Chevrolet', q: ['2022 Silverado High Country Crew Cab', '2022 Silverado Custom pickup', 'Chevrolet Silverado 1500 2022 front', '2022 Silverado LTZ', 'Silverado T1XX refresh'] },
];
const BAN = ['2500hd', '3500hd', '2500', '3500', '1999chevrolet', '2011chevrolet', 'silveradointerior', 'interior', 'ev ', 'evrst', 'eassist', 'crash', 'wreck'];
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
(async () => {
  for (const v of JOBS) {
    console.log(`\n== ${v.id}`);
    for (const q of v.q) {
      try {
        const j = await api({ action: 'query', generator: 'search', gsrsearch: q + ' automobile', gsrnamespace: '6', gsrlimit: '10', prop: 'imageinfo', iiprop: 'size', iiextmetadatafilter: 'LicenseShortName' });
        const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
        for (const p of pages) {
          const t = norm(p.title || '');
          if (BAN.some((b) => t.includes(b))) continue;
          console.log(`   ${p.title} [${q}]`);
        }
      } catch (e) { console.log('ERR', q, e.message); }
      await sleep(900);
    }
    await sleep(600);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

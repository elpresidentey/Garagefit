// Round 4b: motor-show angles for the two Silverado gaps.
// Usage: node scripts/fetch-round4b.cjs
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const QUERIES = [
  'Chevrolet Silverado 2021 au SIAM', 'Silverado Trail Boss 2021 front', '2021 Silverado LT Trail Boss Crew Cab',
  'Chevrolet Silverado 2022 au SIAM', 'Silverado ZR2 2022 front', '2022 Silverado LT Trail Boss',
  'Chevrolet Silverado Custom 2021', 'Chevrolet Silverado Custom 2022',
];
const BAN = ['2500', '3500', '1999', '2011', 'interior', 'ev ', 'evrst', 'crash', 'wreck', 'k2xx', 'gmtk2'];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
async function api(params, retries = 2) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  for (let a = 0; ; a++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && a < retries) { await sleep(15000 * (a + 1)); continue; }
    throw new Error('HTTP ' + res.status);
  }
}
(async () => {
  for (const q of QUERIES) {
    try {
      const j = await api({ action: 'query', generator: 'search', gsrsearch: q + ' automobile', gsrnamespace: '6', gsrlimit: '10', prop: 'imageinfo', iiprop: 'size' });
      const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
      console.log(`\n## ${q} (${pages.length} raw)`);
      for (const p of pages) {
        const t = norm(p.title || '');
        if (BAN.some((b) => t.includes(b))) { console.log(`   BAN ${p.title}`); continue; }
        console.log(`   KEEP? ${p.title}`);
      }
    } catch (e) { console.log('ERR', q, e.message); }
    await sleep(900);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

// Final attempt: NX 350 + A 220 photos. Prints candidates for review.
// Usage: node scripts/fetch-lux3.cjs
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const QUERIES = [
  'Lexus NX 350h 2023 front', 'LEXUS NX China front', '2023 Lexus NX 350 SUV', 'Lexus NX second generation',
  'Mercedes A 200 2024 sedan', 'Mercedes A-Class V177 sedan front', '2023 Mercedes A 220',
];
const BAN = ['nx200', 'nx300h', 'rx', 'ux', 'es ', 'is ', 'ct ', 'lc ', 'rc ', 'glc', 'gla', 'cla', 'c-class', 'e-class', 's-class', 'w220', 'w221', 'interior', 'detail', 'wreck', 'taxi'];
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
      const j = await api({ action: 'query', generator: 'search', gsrsearch: q + ' automobile', gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo', iiprop: 'size' });
      const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
      console.log(`\n## ${q} (${pages.length} raw)`);
      for (const p of pages) {
        const t = norm(p.title || '');
        if (BAN.some((b) => t.includes(b))) { console.log(`   BAN ${p.title}`); continue; }
        console.log(`   ? ${p.title}`);
      }
    } catch (e) { console.log('ERR', q, e.message); }
    await sleep(900);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

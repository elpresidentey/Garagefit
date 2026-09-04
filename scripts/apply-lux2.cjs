// Apply the 6 visually-verified lux picks by exact Commons title.
// Usage: node scripts/apply-lux2.cjs
const fs = require('fs');
const DATA = 'src/data.ts';
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const PICKS = [
  ['lexus-is-300-2024', 'File:LEXUS IS 300 (XE30) China (4).jpg'],
  ['lexus-nx-350-2024', 'File:Lexus NX 350h AWD AAZH20 2023 (1).jpg'],
  ['lexus-rx-350-2024', 'File:Lexus RX 500h F Performance AWD (2024) (53626371426).jpg'],
  ['lexus-ux-250h-2024', 'File:LEXUS UX 250h UX 260h China (11).jpg'],
  ['mercedes-a-220-2024', 'File:Mercedes-Benz A 200 Limousine Progressive (V 177, Facelift) – f 10032024.jpg'],
  ['mercedes-s-500-2024', 'File:MERCEDES-BENZ S-CLASS (W223) China (21).jpg'],
];
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);
(async () => {
  const j = await (await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    format: 'json', action: 'query', titles: PICKS.map((p) => p[1]).join('|'),
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName',
  }), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json();
  const byTitle = {};
  for (const p of Object.values(j.query?.pages || {})) {
    const info = p.imageinfo?.[0];
    byTitle[p.title] = { url: info?.thumburl || info?.url, artist: stripHtml(info?.extmetadata?.Artist?.value), license: stripHtml(info?.extmetadata?.LicenseShortName?.value) };
  }
  let src = fs.readFileSync(DATA, 'utf8');
  let n = 0;
  for (const [id, title] of PICKS) {
    const info = byTitle[title];
    if (!info?.url) { console.log('LOOKUP MISS', title); continue; }
    const credit = `Photo: ${info.artist || 'Wikimedia Commons contributor'} via Wikimedia Commons (${info.license || 'CC'})`.replace(/"/g, "'");
    const anchor = `{id:"${id}"`;
    const idx = src.indexOf(anchor);
    const eol = src.indexOf('\n', idx);
    let line = src.slice(idx, eol);
    if (line.includes('imageUrl:')) { console.log('SKIP (has image)', id); continue; }
    line = line.replace(/},?\s*$/, (m) => `,imageUrl:"${info.url}",imageCredit:"${credit}"` + m);
    src = src.slice(0, idx) + line + src.slice(eol);
    n++;
    console.log('OK', id);
  }
  fs.writeFileSync(DATA, src);
  console.log(`Applied ${n}/${PICKS.length}`);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

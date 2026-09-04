// Apply only the 4 verified-correct round-2 matches.
const fs = require('fs');
const DATA = 'src/data.ts';
const KEEP = new Set([
  'toyota-camry-2015-le-25',
  'toyota-corolla-2017-le-18',
  'toyota-corolla-2020-le',
  'toyota-corolla-2023-le',
]);
const round2 = JSON.parse(fs.readFileSync('image-round2.json', 'utf8'));
let src = fs.readFileSync(DATA, 'utf8');
let n = 0;
for (const r of round2) {
  if (r.status !== 'match' || !KEEP.has(r.id)) continue;
  const credit = `Photo: ${r.artist || 'Wikimedia Commons contributor'} via Wikimedia Commons (${r.license || 'CC'})`.replace(/"/g, "'");
  const anchor = `{id:"${r.id}"`;
  const idx = src.indexOf(anchor);
  const eol = src.indexOf('\n', idx);
  let line = src.slice(idx, eol);
  if (line.includes('imageUrl:')) { console.log('SKIP (has image)', r.id); continue; }
  line = line.replace(/},?\s*$/, (m) => `,imageUrl:"${r.url}",imageCredit:"${credit}"` + m);
  src = src.slice(0, idx) + line + src.slice(eol);
  n++;
}
fs.writeFileSync(DATA, src);
console.log(`Applied ${n} imageUrls`);

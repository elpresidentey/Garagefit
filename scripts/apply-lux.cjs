// Apply only the 6 reviewed-good lux matches from image-report.json.
// (fetch-images --apply would re-dupe the 158 existing records.)
const fs = require('fs');
const DATA = 'src/data.ts';
const GOOD = new Set([
  'lexus-es-350-2024',
  'lexus-es-300h-2024',
  'mercedes-e-350-2024',
  'mercedes-gle-350-2024',
  'mercedes-gla-250-2024',
  'mercedes-glb-250-2024',
]);
const report = JSON.parse(fs.readFileSync('image-report.json', 'utf8'));
let src = fs.readFileSync(DATA, 'utf8');
let n = 0;
for (const r of report) {
  if (r.status !== 'match' || !GOOD.has(r.id)) continue;
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
  console.log('OK', r.id, '<-', r.title);
}
fs.writeFileSync(DATA, src);
console.log(`Applied ${n}/${GOOD.size}`);

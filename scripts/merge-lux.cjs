// Merge Lexus + Mercedes 2024 records into src/data.ts (strips estW helper key).
const fs = require('fs');
const files = ['scripts/newcars-lexus.json', 'scripts/newcars-mercedes.json'];
let recs = [];
for (const f of files) recs = recs.concat(JSON.parse(fs.readFileSync(f, 'utf8')));
recs.sort((a, b) => (a.make < b.make ? -1 : 1) || (a.model < b.model ? -1 : 1));
const q = s => JSON.stringify(s);
const line = r => {
  const parts = [
    `id:${q(r.id)}`, `year:${r.year}`, `make:${q(r.make)}`, `model:${q(r.model)}`, `trim:${q(r.trim)}`,
    `body:${q(r.body)}`, `seats:${r.seats}`, `doors:${r.doors}`, `fuel:${q(r.fuel)}`, `eff:${r.eff}`,
    `effUnit:${q(r.effUnit)}`, `msrp:${r.msrp}`, `widthFolded:${r.widthFolded}`, `widthExtended:${r.widthExtended}`,
    `legroom:${r.legroom}`, `safety:${q(r.safety)}`, `handsFree:${r.handsFree}`, `rangeMi:${r.rangeMi === null ? 'null' : r.rangeMi}`,
  ];
  if (r.nhtsaStars != null) parts.push(`nhtsaStars:${r.nhtsaStars}`);
  return `{${parts.join(',')}}`;
};
const block = recs.map(r => line(r)).join(',\n');
let data = fs.readFileSync('src/data.ts', 'utf8');
const close = data.lastIndexOf('\n];');
if (close === -1) throw new Error('no closing ]; found');
data = data.slice(0, close) + ',\n' + block + '\n];\n';
fs.writeFileSync('src/data.ts', data);
console.log('merged', recs.length, 'records; new total ids:', (data.match(/id:"/g) || []).length);

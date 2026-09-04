// Merge researched 2015-2023 records into src/data.ts (strips helper keys, sorts, bumps stamp).
const fs = require('fs');
const files = ['scripts/newcars-2015-2017.json', 'scripts/newcars-2018-2020.json', 'scripts/newcars-2021-2023.json'];
let recs = [];
for (const f of files) recs = recs.concat(JSON.parse(fs.readFileSync(f, 'utf8')));
recs.sort((a, b) => a.year - b.year || (a.make < b.make ? -1 : a.make > b.make ? 1 : 0) || (a.model < b.model ? -1 : 1));
const q = s => JSON.stringify(s);
const line = r => {
  const parts = [
    `id:${q(r.id)}`, `year:${r.year}`, `make:${q(r.make)}`, `model:${q(r.model)}`, `trim:${q(r.trim)}`,
    `body:${q(r.body)}`, `seats:${r.seats}`, `doors:${r.doors}`, `fuel:${q(r.fuel)}`, `eff:${r.eff}`,
    `effUnit:${q(r.effUnit)}`, `msrp:${r.msrp}`, `widthFolded:${r.widthFolded}`, `widthExtended:${r.widthExtended}`,
    `legroom:${r.legroom}`, `safety:${q(r.safety)}`, `handsFree:${r.handsFree}`, `rangeMi:${r.rangeMi === null ? 'null' : r.rangeMi}`,
    `used:true`,
  ];
  if (r.nhtsaStars != null) parts.push(`nhtsaStars:${r.nhtsaStars}`);
  return `{${parts.join(',')}}`;
};
const block = recs.map(r => line(r)).join(',\n');
let data = fs.readFileSync('src/data.ts', 'utf8');
const close = data.lastIndexOf('\n];');
if (close === -1) throw new Error('no closing ]; found');
data = data.slice(0, close) + ',\n' + block + '\n];\n';
data = data.replace(`export const DATA_STAMP = '2026-09-03'`, `export const DATA_STAMP = '2026-09-04'`);
fs.writeFileSync('src/data.ts', data);
console.log('merged', recs.length, 'records; new total ids:', (data.match(/id:"/g) || []).length);

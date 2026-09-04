// IIHS-verified safety corrections (checked against iihs.org 2024 award lists).
const fs = require('fs');
// 1. Lexus batch: ES/RX earned base TSP (not +), IS earned nothing in 2024.
const lf = 'scripts/newcars-lexus.json';
const arr = JSON.parse(fs.readFileSync(lf, 'utf8'));
arr.forEach((r) => {
  if (r.id.includes('es-350') || r.id.includes('es-300h') || r.id.includes('rx-350')) r.safety = 'TSP';
  if (r.id.includes('is-300')) r.safety = '—';
});
fs.writeFileSync(lf, JSON.stringify(arr, null, 2));
console.log('lexus safety corrected');
// 2. Existing C-Class 2024: IIHS 2024-25 TSP+.
const df = 'src/data.ts';
let t = fs.readFileSync(df, 'utf8');
const before = '{id:"mercedes-c-2024",year:2024,make:"Mercedes-Benz",model:"C-Class",trim:"C 300",body:"Sedan",seats:5,doors:4,fuel:"Gasoline",eff:30,effUnit:"MPG",msrp:46950,widthFolded:71.3,widthExtended:77.5,legroom:41.7,safety:"—"';
if (!t.includes(before)) throw new Error('C-Class anchor not found');
t = t.replace(before, before.replace('safety:"—"', 'safety:"TSP+"'));
fs.writeFileSync(df, t);
console.log('c-class safety fixed');

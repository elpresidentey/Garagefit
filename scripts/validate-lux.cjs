const fs = require('fs');
const files = ['scripts/newcars-lexus.json', 'scripts/newcars-mercedes.json'];
let all = [];
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(f, 'records:', arr.length);
  arr.forEach(r => console.log(' ', r.id, '|', r.trim, '| $' + r.msrp, '|', r.eff + r.effUnit, '|', r.widthFolded + '/' + r.widthExtended, '|', r.legroom, '|', r.safety, '| hf:' + r.handsFree, '| nhtsa:' + (r.nhtsaStars ?? '-'), r.estW ? '| ESTW' : ''));
  all = all.concat(arr);
}
const ids = new Set();
let bad = 0;
for (const r of all) {
  const issues = [];
  if (!/^[a-z0-9-]+$/.test(r.id)) issues.push('bad id');
  if (ids.has(r.id)) issues.push('DUP');
  ids.add(r.id);
  if (r.year !== 2024) issues.push('year');
  if (!(r.eff >= 15 && r.eff <= 60)) issues.push('eff:' + r.eff);
  if (!(r.widthFolded >= 65 && r.widthFolded <= 85)) issues.push('folded:' + r.widthFolded);
  if (!(r.widthExtended >= 70 && r.widthExtended <= 95)) issues.push('ext:' + r.widthExtended);
  if (r.widthExtended < r.widthFolded) issues.push('ext<fold');
  if (!(r.msrp >= 30000 && r.msrp <= 130000)) issues.push('msrp:' + r.msrp);
  if (!['TSP+', 'TSP', '—'].includes(r.safety)) issues.push('safety');
  if ('imageUrl' in r || 'verified' in r || 'used' in r) issues.push('forbidden key');
  if (issues.length) { bad++; console.log('ISSUE', r.id, issues.join(',')); }
}
const data = fs.readFileSync('src/data.ts', 'utf8');
const existing = new Set([...data.matchAll(/id:"([^"]+)"/g)].map(m => m[1]));
console.log('clashes:', all.filter(r => existing.has(r.id)).map(r => r.id));
console.log(bad ? `FAIL ${bad}` : 'ALL OK');

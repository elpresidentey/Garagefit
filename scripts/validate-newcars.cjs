const fs = require('fs');
const files = ['scripts/newcars-2015-2017.json', 'scripts/newcars-2018-2020.json', 'scripts/newcars-2021-2023.json'];
const req = ['id','year','make','model','trim','body','seats','doors','fuel','eff','effUnit','msrp','widthFolded','widthExtended','legroom','safety','handsFree','rangeMi','used'];
const bodies = new Set(['Sedan','SUV','Crossover','Truck','Hatch','Coupe','Wagon','Minivan']);
const fuels = new Set(['Gasoline','Hybrid','PHEV','EV','Hydrogen']);
let all = [];
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(f, 'records:', arr.length);
  all = all.concat(arr.map(r => ({ ...r, _f: f })));
}
console.log('total:', all.length);
const ids = new Set();
let bad = 0;
for (const r of all) {
  const issues = [];
  for (const k of req) if (!(k in r)) issues.push('missing:' + k);
  if (typeof r.id !== 'string' || !/^[a-z0-9-]+$/.test(r.id)) issues.push('bad id');
  if (ids.has(r.id)) issues.push('DUP ID');
  ids.add(r.id);
  if (r.year < 2015 || r.year > 2023) issues.push('year OOR');
  if (!bodies.has(r.body)) issues.push('body:' + r.body);
  if (!fuels.has(r.fuel)) issues.push('fuel:' + r.fuel);
  if (!(r.eff >= 10 && r.eff <= 160)) issues.push('eff OOR:' + r.eff);
  if (!(r.widthFolded >= 60 && r.widthFolded <= 95)) issues.push('folded OOR:' + r.widthFolded);
  if (!(r.widthExtended >= 60 && r.widthExtended <= 105)) issues.push('extended OOR:' + r.widthExtended);
  if (r.widthExtended < r.widthFolded) issues.push('ext<fold');
  if (!(r.legroom >= 30 && r.legroom <= 55)) issues.push('legroom OOR:' + r.legroom);
  if (!(r.msrp >= 4000 && r.msrp <= 90000)) issues.push('msrp OOR:' + r.msrp);
  if (!['TSP+','TSP','—'].includes(r.safety)) issues.push('safety:' + r.safety);
  if (r.used !== true) issues.push('used flag');
  if ('imageUrl' in r || 'verified' in r || 'tag' in r) issues.push('forbidden key');
  if (issues.length) { bad++; console.log('ISSUE', r.id, '(' + r._f + '):', issues.join(', ')); }
}
console.log(bad ? `FAIL: ${bad} bad records` : 'ALL RECORDS OK');
console.log('estW count:', all.filter(r => r.estW).length);
// check overlap with existing ids
const data = fs.readFileSync('src/data.ts', 'utf8');
const existing = new Set([...data.matchAll(/id:"([^"]+)"/g)].map(m => m[1]));
const clash = all.filter(r => existing.has(r.id));
console.log('id clashes with data.ts:', clash.length ? clash.map(r => r.id) : 'none');

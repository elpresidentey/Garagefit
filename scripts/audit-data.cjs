const fs = require('fs');
const t = fs.readFileSync('src/data.ts', 'utf8');
const years = [...t.matchAll(/year:(\d{4})/g)].map(m => +m[1]);
console.log('count:', years.length);
console.log('min:', Math.min(...years), 'max:', Math.max(...years));
const h = {};
years.forEach(y => { h[y] = (h[y] || 0) + 1; });
console.log('byYear:', JSON.stringify(h));
const makes = {};
for (const m of t.matchAll(/make:"([^"]+)"/g)) { makes[m[1]] = (makes[m[1]] || 0) + 1; }
console.log('byMake:', JSON.stringify(makes));
const fuels = {};
for (const m of t.matchAll(/fuel:"([^"]+)"/g)) { fuels[m[1]] = (fuels[m[1]] || 0) + 1; }
console.log('byFuel:', JSON.stringify(fuels));
// show one full record + tail to see id conventions, verified flags, image conventions
const lines = t.split('\n');
console.log('--- head ---');
console.log(lines.slice(0, 8).join('\n'));
console.log('--- tail ---');
console.log(lines.slice(-12).join('\n'));

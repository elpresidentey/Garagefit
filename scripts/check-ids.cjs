const fs = require('fs');
const src = fs.readFileSync('src/data.ts', 'utf8');
const ids = [...src.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);
const r = JSON.parse(fs.readFileSync('image-report.json', 'utf8')).map((x) => x.id);
console.log('data:', ids.length, 'report:', r.length);
console.log('missing from report:', JSON.stringify(ids.filter((i) => !r.includes(i))));

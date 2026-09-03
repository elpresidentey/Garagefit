const fs = require('fs');
const src = fs.readFileSync('src/data.ts', 'utf8');
const ids = [...src.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);
console.log('records:', ids.length);
console.log('verified:', (src.match(/verified:true/g) || []).length);
const t = src.split('\n').find((l) => l.includes('kia-telluride-2024'));
console.log('telluride tail:', JSON.stringify(t.slice(-200)));
// sanity: every record line ends with } or },
const bad = src.split('\n').filter((l) => l.includes('{id:"') && !/},?\s*$/.test(l));
console.log('malformed lines:', bad.length);

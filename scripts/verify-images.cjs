const fs = require('fs');
const src = fs.readFileSync('src/data.ts', 'utf8');
const rows = [...src.matchAll(/\{id:"([^"]+)".*?imageUrl:"([^"]+)"/g)].map((m) => ({ id: m[1], url: m[2] }));
console.log('with images:', rows.length);
const UA = 'GarageFit/1.0 (link verification)';
let bad = 0, i = 0;
const queue = [...rows];
async function worker() {
  while (queue.length) {
    const r = queue.shift();
    i++;
    try {
      const res = await fetch(r.url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.startsWith('image/')) { console.log('BAD', res.status, ct, r.id, r.url); bad++; }
    } catch (e) { console.log('ERR', e.message, r.id); bad++; }
    if (i % 20 === 0) console.log(`...${i}/${rows.length}`);
  }
}
(async () => { await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]); console.log(`done. bad=${bad}`); })();

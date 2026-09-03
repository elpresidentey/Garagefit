// Download all remote vehicle thumbs into public/vehicles/ and rewrite
// src/data.ts imageUrls to local relative paths.
// Usage: node scripts/localize-images.cjs [--apply]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data.ts');
const OUTDIR = path.join(ROOT, 'public', 'vehicles');
const APPLY = process.argv.includes('--apply');
const UA = 'GarageFit/1.0 (self-hosting freely-licensed Wikimedia Commons thumbnails with attribution)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dl(url, dest, retries = 3) {
  for (let a = 0; ; a++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5000) throw new Error('suspiciously small: ' + buf.length);
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (e) {
      if (a >= retries) throw e;
      await sleep(3000 * (a + 1));
    }
  }
}

(async () => {
  const src = fs.readFileSync(DATA, 'utf8');
  const rows = [...src.matchAll(/\{id:"([^"]+)"[^}]*?imageUrl:"([^"]+)"/g)].map((m) => ({ id: m[1], url: m[2] }));
  console.log('remote images:', rows.length);
  fs.mkdirSync(OUTDIR, { recursive: true });
  const results = [];
  let done = 0;
  const queue = rows.filter((r) => r.url.startsWith('http'));
  console.log('to download:', queue.length);
  async function worker() {
    while (queue.length) {
      const r = queue.shift();
      const dest = path.join(OUTDIR, r.id + '.jpg');
      try {
        if (!fs.existsSync(dest)) {
          const n = await dl(r.url, dest);
          console.log(`OK ${(n / 1024).toFixed(0)}k ${r.id}`);
        } else {
          console.log(`SKIP (exists) ${r.id}`);
        }
        results.push({ id: r.id, ok: true });
      } catch (e) {
        console.log('FAIL', r.id, e.message);
        results.push({ id: r.id, ok: false, url: r.url });
      }
      done++;
      if (done % 15 === 0) console.log(`...${done}/${rows.length}`);
      await sleep(200);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  const failed = results.filter((r) => !r.ok);
  console.log(`\ndownloaded/verified: ${results.length - failed.length}, failed: ${failed.length}`);
  failed.forEach((f) => console.log('  FAILED:', f.id));

  if (APPLY) {
    let out = src;
    let n = 0;
    for (const r of results) {
      if (!r.ok) continue; // keep remote URL for failures
      const file = `vehicles/${r.id}.jpg`;
      if (!fs.existsSync(path.join(OUTDIR, r.id + '.jpg'))) continue;
      const re = new RegExp(`(\\{id:"${r.id}".*?)imageUrl:"[^"]*"`, '');
      if (!re.test(out)) { console.log('ANCHOR MISS', r.id); continue; }
      out = out.replace(re, `$1imageUrl:"${file}"`);
      n++;
    }
    fs.copyFileSync(DATA, DATA + '.bak2');
    fs.writeFileSync(DATA, out);
    const total = fs.readdirSync(OUTDIR).reduce((a, f) => a + fs.statSync(path.join(OUTDIR, f)).size, 0);
    console.log(`Rewrote ${n} imageUrls to local files (${(total / 1048576).toFixed(1)} MB total). Backup: src/data.ts.bak2`);
  } else {
    console.log('Dry run — re-run with --apply to rewrite src/data.ts');
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

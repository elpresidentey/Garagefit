// Download 800px thumbs of the 6 pending picks to Temp for visual check.
const fs = require('fs');
const UA = 'GarageFit/1.0 (photo review)';
const PICKS = {
  'is': 'File:LEXUS IS 300 (XE30) China (4).jpg',
  'rx': 'File:LEXUS RX 350 (AL10) China (6).jpg',
  'ux': 'File:LEXUS UX 250h UX 260h China (11).jpg',
  's': 'File:MERCEDES-BENZ S-CLASS (W223) China (21).jpg',
  'nx': 'File:Lexus NX 350h AWD AAZH20 2023 (1).jpg',
  'a': 'File:Mercedes-Benz A 200 Limousine Progressive (V 177, Facelift) – f 10032024.jpg',
};
(async () => {
  const j = await (await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    format: 'json', action: 'query', titles: Object.values(PICKS).join('|'),
    prop: 'imageinfo', iiprop: 'url', iiurlwidth: '800',
  }), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json();
  for (const p of Object.values(j.query?.pages || {})) {
    const key = Object.keys(PICKS).find((k) => PICKS[k] === p.title);
    const url = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url;
    if (!url) { console.log('MISS', p.title); continue; }
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    const dest = `C:\\Users\\hp\\AppData\\Local\\Temp\\opencode\\review-${key}.jpg`;
    fs.writeFileSync(dest, buf);
    console.log('saved', dest, (buf.length / 1024).toFixed(0) + 'k');
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

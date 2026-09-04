// Apply the 10 reviewed round-3 wins by exact Commons title.
// Usage: node scripts/apply-round3.cjs
const fs = require('fs');
const DATA = 'src/data.ts';
const UA = 'GarageFit/1.0 (open-source vehicle comparison demo; dataset enrichment script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PICKS = [
  ['ford-f-150-2017-supercrew-27', 'File:2018 Ford F-150 XLT Crew Cab, front 11.10.19.jpg'],
  ['honda-civic-2017-lx-20', 'File:HONDA CIVIC SEDAN (FC,FK) China.jpg'],
  ['chevrolet-silverado-1500-2018-crew-53l', 'File:Chevrolet Silverado High Country 2018 (44665133611).jpg'],
  ['nissan-rogue-2018-sv-awd', 'File:2018 Nissan X-Trail (T32) ST wagon (2018-10-01) 01.jpg'],
  ['nissan-rogue-2019-sv-awd', 'File:Nissan X-TRAIL 20X (DBA-T32) front.jpg'],
  ['toyota-corolla-2021-le', 'File:2021 Toyota Corolla LE, Front Right, 10-19-2020.jpg'],
  ['toyota-corolla-2022-le', 'File:TOYOTA COROLLA SEDAN (E210) China (7).jpg'],
  ['toyota-rav4-2022-xle', 'File:2022 Toyota RAV4 Hybrid LE in Midnight Black Metallic, front left.jpg'],
  ['chevrolet-silverado-2023-53', 'File:Chevrolet Silverado High Country 2023 (53444212521).jpg'],
  ['ford-f-150-2023-27', 'File:Ford F-150 (P702) Washington DC Metro Area, USA.jpg'],
];
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);
(async () => {
  const j = await (await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    format: 'json', action: 'query', titles: PICKS.map((p) => p[1]).join('|'),
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '800', iiextmetadatafilter: 'Artist|LicenseShortName',
  }), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json();
  const byTitle = {};
  for (const p of Object.values(j.query?.pages || {})) {
    const info = p.imageinfo?.[0];
    byTitle[p.title] = { url: info?.thumburl || info?.url, artist: stripHtml(info?.extmetadata?.Artist?.value), license: stripHtml(info?.extmetadata?.LicenseShortName?.value) };
  }
  let src = fs.readFileSync(DATA, 'utf8');
  let n = 0;
  for (const [id, title] of PICKS) {
    const info = byTitle[title];
    if (!info?.url) { console.log('LOOKUP MISS', title); continue; }
    const credit = `Photo: ${info.artist || 'Wikimedia Commons contributor'} via Wikimedia Commons (${info.license || 'CC'})`.replace(/"/g, "'");
    const anchor = `{id:"${id}"`;
    const idx = src.indexOf(anchor);
    const eol = src.indexOf('\n', idx);
    let line = src.slice(idx, eol);
    if (line.includes('imageUrl:')) { console.log('SKIP (has image)', id); continue; }
    line = line.replace(/},?\s*$/, (m) => `,imageUrl:"${info.url}",imageCredit:"${credit}"` + m);
    src = src.slice(0, idx) + line + src.slice(eol);
    n++;
    console.log('OK', id);
  }
  fs.writeFileSync(DATA, src);
  console.log(`Applied ${n}/${PICKS.length}`);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

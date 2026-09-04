// Backfill the last 2 photo-less records from same-face siblings:
// 2021 <- 2020 (same pre-refresh T1 face), 2022 <- 2023 (same refreshed face).
const fs = require('fs');
const path = require('path');
const DATA = 'src/data.ts';
const FILL = [
  ['chevrolet-silverado-2021-53', 'chevrolet-silverado-1500-2020-crew-53l'],
  ['chevrolet-silverado-2022-53', 'chevrolet-silverado-2023-53'],
];
let src = fs.readFileSync(DATA, 'utf8');
for (const [dst, from] of FILL) {
  const getLine = (id) => {
    const idx = src.indexOf(`{id:"${id}"`);
    return src.slice(idx, src.indexOf('\n', idx));
  };
  const fromLine = getLine(from);
  const credit = fromLine.match(/imageCredit:"([^"]*)"/)[1];
  fs.copyFileSync(path.join('public', 'vehicles', `${from}.jpg`), path.join('public', 'vehicles', `${dst}.jpg`));
  const idx = src.indexOf(`{id:"${dst}"`);
  const eol = src.indexOf('\n', idx);
  let line = src.slice(idx, eol);
  line = line.replace(/},?\s*$/, (m) => `,imageUrl:"vehicles/${dst}.jpg",imageCredit:"${credit}"` + m);
  src = src.slice(0, idx) + line + src.slice(eol);
  console.log('OK', dst, '<-', from);
}
fs.writeFileSync(DATA, src);

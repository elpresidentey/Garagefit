// Remove wrong-vehicle photo matches (NASCAR truck, EV Lightning, Rogue Sport,
// Corolla Cross for sedan records, previous-gen shots, art car, etc.).
const fs = require('fs');
const DATA = 'src/data.ts';
const BAD = [
  'ford-f-150-2017-supercrew-27', // NASCAR race truck, not a stock F-150
  'toyota-corolla-2017-le-18', // Corolla iM hatch, not the LE sedan
  'toyota-corolla-2020-le', // Corolla Cross SUV
  'toyota-corolla-2021-le', // Corolla Cross SUV
  'toyota-corolla-2022-le', // Corolla Cross SUV
  'toyota-corolla-2023-le', // Corolla Cross Hybrid SUV
  'toyota-rav4-2022-xle', // XA40 previous-gen photo
  'chevrolet-silverado-2021-53', // 1999 Silverado
  'ford-f-150-2023-27', // F-150 Lightning EV
  'nissan-rogue-2019-sv-awd', // Rogue Sport (different model)
  'honda-civic-2017-lx-20', // Euro 1.0 hatch
  'nissan-rogue-2018-sv-awd', // Rogue Krom/Select previous gen
  'chevrolet-silverado-1500-2018-crew-53l', // 2014-15 front end
  'toyota-camry-2015-le-25', // art-car paint job
];
let src = fs.readFileSync(DATA, 'utf8');
let n = 0;
for (const id of BAD) {
  const re = new RegExp(`(\\{id:"${id}".*?),imageUrl:"[^"]*",imageCredit:"[^"]*"`, '');
  if (!re.test(src)) { console.log('NOT FOUND (already clean?)', id); continue; }
  src = src.replace(re, '$1');
  n++;
}
fs.writeFileSync(DATA, src);
console.log(`stripped images from ${n}/${BAD.length} records`);

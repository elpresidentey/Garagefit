const fs = require('fs');
const t = fs.readFileSync('src/data.ts', 'utf8');
for (const id of ['chevrolet-equinox-2018-lt-fwd', 'toyota-highlander-2021-le', 'nissan-rogue-2021-sv', 'ford-f-150-2015-supercrew-27', 'ram-1500-2015-crew-57']) {
  const i = t.indexOf('{id:"' + id + '"');
  console.log(t.slice(i, i + 280));
}

// Verification-pass corrections (2026-09-04).
const fs = require('fs');
const DATA = 'src/data.ts';
let src = fs.readFileSync(DATA, 'utf8');
let n = 0;
// 2021 Highlander V6 AWD: EPA 20/27 → 23 combined (was 22).
{
  const anchor = '{id:"toyota-highlander-2021-le",year:2021,make:"Toyota",model:"Highlander",trim:"LE 3.5L V6 AWD",body:"SUV",seats:8,doors:4,fuel:"Gasoline",eff:22,';
  if (!src.includes(anchor)) throw new Error('highlander anchor miss');
  src = src.replace(anchor, anchor.replace('eff:22,', 'eff:23,'));
  n++;
}
fs.writeFileSync(DATA, src);
console.log(`applied ${n} correction(s)`);

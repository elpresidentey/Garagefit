// Remove duplicate remote imageUrl/imageCredit pairs left by fetch-images --apply
// on records that already had local images. New records were already rewritten
// to local paths by localize, so any remaining thumb.wikimedia.org URL is a dupe.
const fs = require('fs');
const DATA = 'src/data.ts';
let src = fs.readFileSync(DATA, 'utf8');
const before = (src.match(/thumb\.wikimedia\.org/g) || []).length;
src = src.replace(/,imageUrl:"https:\/\/thumb\.wikimedia\.org[^"]*",imageCredit:"[^"]*"/g, '');
const after = (src.match(/thumb\.wikimedia\.org/g) || []).length;
fs.writeFileSync(DATA, src);
console.log(`removed ${before - after} duplicate remote image pairs (${before} -> ${after} remaining)`);

const fs = require('fs');
const t = fs.readFileSync('src/data.ts', 'utf8');
for (const id of ['mercedes-c-2024', 'mercedes-glc-2024']) {
  const i = t.indexOf('{id:"' + id + '"');
  console.log(t.slice(i, i + 300));
}

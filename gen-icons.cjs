// Dependency-free PNG icon generator for GarageFit PWA.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [11, 18, 32, 255];
const TEAL = [30, 58, 138, 255];
const PAPER = [248, 250, 252, 255];

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
// Rounded-square mask: 1 inside, 0 outside (1px AA edge).
function rrect(x, y, cx, cy, half, r) {
  const dx = Math.abs(x - cx) - (half - r);
  const dy = Math.abs(y - cy) - (half - r);
  if (dx <= 0 && dy <= 0) return 1;
  const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - r;
  if (d <= -0.75) return 1;
  if (d >= 0.75) return 0;
  return 0.5 - d / 1.5;
}
function drawIcon(size, glyphScale) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const half = (size / 2) * glyphScale;
  const rad = half * 0.24;
  const ring = Math.max(2, size * 0.028);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const sq = rrect(px, py, c, c, half, rad);
      // Glyph: white ring = outer rounded square minus inner rounded square, plus solid inner tile.
      const inner = rrect(px, py, c, c, half - ring * 2.2, Math.max(1, rad - ring));
      const tile = rrect(px, py, c, c, half * 0.34, Math.max(1, rad * 0.45));
      const ringM = Math.max(0, sq - inner);
      const white = Math.max(ringM, tile);
      let col = BG;
      // teal tile behind glyph
      const t = sq;
      const r = white;
      const blend = (a, b, m) => a + (b - a) * m;
      const tealMix = [blend(BG[0], TEAL[0], t), blend(BG[1], TEAL[1], t), blend(BG[2], TEAL[2], t)];
      const final = [blend(tealMix[0], PAPER[0], r), blend(tealMix[1], PAPER[1], r), blend(tealMix[2], PAPER[2], r)];
      const o = (y * size + x) * 4;
      buf[o] = final[0]; buf[o + 1] = final[1]; buf[o + 2] = final[2]; buf[o + 3] = 255;
    }
  }
  return buf;
}
const outDir = path.join(__dirname, 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
const jobs = [
  ['icon-192.png', 192, 0.62],
  ['icon-512.png', 512, 0.62],
  ['maskable-512.png', 512, 0.5],
  ['apple-touch-icon.png', 180, 0.62],
];
for (const [name, size, g] of jobs) {
  fs.writeFileSync(path.join(outDir, name), encodePNG(size, size, drawIcon(size, g)));
  console.log('wrote', name);
}

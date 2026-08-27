/**
 * Writes the PWA icons as real PNGs with no image dependency — Node's zlib is
 * all a valid PNG needs. The mark follows the design system: a --base field
 * with one amber bar, which is the same "flat field, one geometric mark"
 * language the library uses for artwork.
 */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BASE = [0x0b, 0x0b, 0x0c];
const SIGNAL = [0xff, 0xb0, 0x00];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** `maskable` keeps the mark inside the safe circle so Android can crop it. */
function png(size, maskable) {
  const barW = Math.round(size * (maskable ? 0.1 : 0.14));
  const barH = Math.round(size * (maskable ? 0.34 : 0.46));
  const x0 = Math.round((size - barW) / 2);
  const y0 = Math.round((size - barH) / 2);

  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inBar = x >= x0 && x < x0 + barW && y >= y0 && y < y0 + barH;
      const [r, g, b] = inBar ? SIGNAL : BASE;
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon.png', 48, false],
]) {
  const buf = png(size, maskable);
  writeFileSync(`public/${name}`, buf);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${buf.length} bytes  sha256=${createHash('sha256').update(buf).digest('hex').slice(0, 12)}`);
}

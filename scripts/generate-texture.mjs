import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// A flat powder-coat color map: flecks have no highlights or shadows.
const width = 1024;
const height = 1536;
const pixels = Buffer.alloc(width * height * 3);
let seed = 0x51a7c0de;
const random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x100000000;
};

function paint(x, y, value) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const offset = (y * width + x) * 3;
  pixels[offset] = value;
  pixels[offset + 1] = value;
  pixels[offset + 2] = value;
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    paint(x, y, 14 + Math.floor(random() * 5));
  }
}

for (let i = 0; i < 44000; i++) {
  const x = Math.floor(random() * width);
  const y = Math.floor(random() * height);
  const value = random() < 0.08 ? 78 + Math.floor(random() * 18) : 37 + Math.floor(random() * 28);
  paint(x, y, value);
  const size = random();
  if (size < 0.3) paint(x + 1, y, value);
  if (size < 0.08) paint(x, y + 1, value);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 2;
const scanlines = Buffer.alloc(height * (1 + width * 3));
for (let y = 0; y < height; y++) {
  pixels.copy(scanlines, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
}

writeFileSync(new URL('../public/powder-coat.png', import.meta.url), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(scanlines, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]));

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const colors = {
  background: [216, 216, 212], body: [18, 20, 22], rim: [114, 117, 113],
  print: [224, 222, 214], screenRim: [6, 8, 11], screen: [171, 184, 205],
  ink: [43, 56, 84], knob: [9, 11, 12], knobEdge: [45, 48, 48],
  metal: [180, 182, 177], red: [225, 67, 60],
};

function icon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  const blend = (x, y, color, alpha) => {
    if (x < 0 || x >= size || y < 0 || y >= size || alpha <= 0) return;
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(pixels[i + c] * (1 - alpha) + color[c] * alpha);
    pixels[i + 3] = 255;
  };
  const shape = (x0, y0, x1, y1, color, distance) => {
    for (let y = Math.max(0, Math.floor(y0 * scale - 2)); y < Math.min(size, Math.ceil(y1 * scale + 2)); y++) {
      for (let x = Math.max(0, Math.floor(x0 * scale - 2)); x < Math.min(size, Math.ceil(x1 * scale + 2)); x++) {
        const d = distance((x + 0.5) / scale, (y + 0.5) / scale) * scale;
        blend(x, y, color, Math.max(0, Math.min(1, 0.5 - d)));
      }
    }
  };
  const rect = (x, y, w, h, r, color) => {
    const cx = x + w / 2, cy = y + h / 2;
    shape(x, y, x + w, y + h, color, (px, py) => {
      const dx = Math.abs(px - cx) - w / 2 + r;
      const dy = Math.abs(py - cy) - h / 2 + r;
      return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
    });
  };
  const circle = (cx, cy, r, color) => shape(cx - r, cy - r, cx + r, cy + r, color, (x, y) => Math.hypot(x - cx, y - cy) - r);

  rect(0, 0, 512, 512, 0, colors.background);
  rect(58, 28, 396, 456, 28, colors.body);
  rect(72, 42, 368, 428, 20, colors.rim);
  rect(75, 45, 362, 422, 18, colors.body);
  rect(102, 82, 308, 155, 7, colors.screenRim);
  rect(113, 93, 286, 133, 2, colors.screen);
  rect(136, 128, 45, 7, 1, colors.ink);
  rect(193, 128, 45, 7, 1, colors.ink);
  rect(136, 171, 240, 3, 1, colors.ink);
  circle(256, 171, 9, colors.ink);
  for (const cx of [167, 345]) {
    circle(cx, 309, 57, colors.knobEdge);
    circle(cx, 309, 48, colors.knob);
    rect(cx - 4, 271, 8, 30, 3, colors.print);
  }
  circle(256, 387, 18, colors.knob);
  circle(256, 387, 12, colors.red);
  circle(251, 382, 4, colors.print);
  circle(256, 443, 28, colors.metal);
  circle(256, 443, 20, colors.knobEdge);
  circle(256, 443, 16, colors.metal);

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const chunk = (type, data) => {
    const name = Buffer.from(type);
    const body = Buffer.concat([name, data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
    const footer = Buffer.alloc(4); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([header, body, footer]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [180, 192, 512]) writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), icon(size));

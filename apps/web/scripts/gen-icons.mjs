// Generate maskable PNG icons (192, 512) from the icon.svg geometry, with no
// image toolchain: we rasterise the shapes into an RGBA buffer and encode a PNG
// with Node's zlib. Run: node scripts/gen-icons.mjs
//
// The design mirrors public/icon.svg — a dark field, an inner rounded-square
// outline and three lines in the accent green — but fills the whole canvas so
// the OS maskable safe zone is respected (important content stays centred).

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BG = [0x16, 0x15, 0x0f];
const FG = [0x5d, 0xca, 0xa5];

function hypot(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy);
}

// Signed-distance-ish test: is (x,y) inside a rounded rect [x0,y0,x1,y1], r?
function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return hypot(x - cx, y - cy) <= r;
}

function render(size) {
  const s = size / 512; // scale from the 512 design space
  const px = (v) => v * s;
  const buf = Buffer.alloc(size * size * 4);

  // Inner outline: rounded square, stroke 20 in design space. Draw as an outer
  // filled rounded rect minus an inner one.
  const ox0 = px(120),
    oy0 = px(120),
    ox1 = px(392),
    oy1 = px(392),
    oR = px(24);
  const sw = px(20);
  const ix0 = ox0 + sw,
    iy0 = oy0 + sw,
    ix1 = ox1 - sw,
    iy1 = oy1 - sw,
    iR = Math.max(0, oR - sw);

  // Three horizontal capsules (lines with round caps), stroke 20.
  const lineR = px(10);
  const lines = [
    [px(196), px(316), px(196)], // x0, x1, y
    [px(196), px(316), px(256)],
    [px(196), px(268), px(316)],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG;
      const cx = x + 0.5;
      const cy = y + 0.5;

      const inOutline =
        insideRoundRect(cx, cy, ox0, oy0, ox1, oy1, oR) &&
        !insideRoundRect(cx, cy, ix0, iy0, ix1, iy1, iR);
      if (inOutline) color = FG;

      for (const [lx0, lx1, ly] of lines) {
        if (insideRoundRect(cx, cy, lx0, ly - lineR, lx1, ly + lineR, lineR)) {
          color = FG;
          break;
        }
      }

      const i = (y * size + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 0xff;
    }
  }
  return buf;
}

// ── Minimal PNG encoder (truecolour+alpha, 8-bit) ──────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // 10,11,12 default 0 (deflate, adaptive filtering, no interlace)

  // Prepend a zero filter byte to each scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
for (const size of [192, 512]) {
  const png = encodePng(render(size), size);
  const path = join(outDir, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}

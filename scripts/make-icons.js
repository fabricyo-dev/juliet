'use strict';
// Generates the tray template glyph and the app icon from the designer's sprite sheets. Run: npm run icons
const fs = require('node:fs');
const path = require('node:path');
const { encodePNG, decodePNG } = require('../src/shared/png');
const A = require('../src/shared/juliet-anim');

const ASSETS = path.join(__dirname, '..', 'assets');
const JULIET = path.join(ASSETS, 'juliet');

function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }
function image(W, H) { return Buffer.alloc(W * H * 4, 0); }
function write(name, W, H, rgba) {
  fs.writeFileSync(path.join(ASSETS, name), encodePNG(W, H, rgba));
  console.log('wrote', name, `${W}x${H}`);
}
function sheet(key) { return decodePNG(fs.readFileSync(path.join(JULIET, A.SHEETS[key].image))); }

// copy one 128×128 cell out of a sheet, scaled by an integer factor (nearest neighbour), onto dst at (ox, oy)
function blitCell(dst, DW, src, rect, ox, oy, scale) {
  for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
    const si = ((rect.y + y) * src.width + (rect.x + x)) * 4;
    if (src.rgba[si + 3] === 0) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const di = ((oy + y * scale + dy) * DW + (ox + x * scale + dx)) * 4;
      dst[di] = src.rgba[si]; dst[di + 1] = src.rgba[si + 1]; dst[di + 2] = src.rgba[si + 2]; dst[di + 3] = src.rgba[si + 3];
    }
  }
}

const talk = sheet('turnTalk');
const FACE = A.frameRect(5); // first talkToUser frame: Juliet facing the user

// ---- app icon: 512×512, soft rounded square, face frame at 3× ----
{
  const W = 512, b = image(W, W);
  const [r, g, bl] = hex('#f6efe6');
  const inset = 40, rad = 96;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (x < inset || y < inset || x >= W - inset || y >= W - inset) continue;
    const cx = Math.max(inset + rad, Math.min(W - inset - rad, x));
    const cy = Math.max(inset + rad, Math.min(W - inset - rad, y));
    if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
    const i = (y * W + x) * 4; b[i] = r; b[i + 1] = g; b[i + 2] = bl; b[i + 3] = 255;
  }
  blitCell(b, W, talk, FACE, 64, 52, 3); // 384 px cat, feet (anchor y=120 → 412) sit just above the plate's lower edge
  write('icon.png', W, W, b);
}

// ---- tray template: black silhouette of her head (alpha only matters for template images) ----
// Head region of the face frame in cell coords; downsampled with a "mostly opaque" threshold.
// Box around the head (ears ≈ y18, chin ≈ y62, x 50–98) with margin; the raised tail lives at x < 50 and is masked out.
const HEAD = { x: 44, y: 10, w: 60, h: 60, minX: 50 };
function traySilhouette(size) {
  const b = image(size, size);
  const opaque = new Float64Array(size * size), total = new Float64Array(size * size);
  for (let sy = 0; sy < HEAD.h; sy++) for (let sx = 0; sx < HEAD.w; sx++) {
    const bx = Math.floor((sx * size) / HEAD.w), by = Math.floor((sy * size) / HEAD.h);
    const cellX = HEAD.x + sx, cellY = HEAD.y + sy;
    const si = ((FACE.y + cellY) * talk.width + (FACE.x + cellX)) * 4 + 3;
    total[by * size + bx]++;
    if (cellX >= HEAD.minX && talk.rgba[si] > 0) opaque[by * size + bx]++;
  }
  for (let i = 0; i < size * size; i++) {
    if (total[i] && opaque[i] / total[i] >= 0.5) { b[i * 4] = 0; b[i * 4 + 1] = 0; b[i * 4 + 2] = 0; b[i * 4 + 3] = 255; }
  }
  return b;
}
write('trayTemplate.png', 16, 16, traySilhouette(16));
write('trayTemplate@2x.png', 32, 32, traySilhouette(32));

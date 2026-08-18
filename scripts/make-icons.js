'use strict';
// Generates tray + app icons and a reference sprite sheet from the pixel matrices. Run: npm run icons
const fs = require('node:fs');
const path = require('node:path');
const { encodePNG } = require('../src/shared/png');
const SPRITE = require('../src/shared/sprite-data');

const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }

// draw a 16x16 char matrix into rgba at (ox,oy) with integer scale
function blit(rgba, W, matrix, ox, oy, scale, palette) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ch = matrix[y][x];
    if (ch === '.') continue;
    const [r, g, b] = hex(palette[ch]);
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const px = ox + x * scale + dx, py = oy + y * scale + dy;
      const i = (py * W + px) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
}
function image(W, H) { return Buffer.alloc(W * H * 4, 0); }
function write(name, W, H, rgba) {
  fs.writeFileSync(path.join(OUT, name), encodePNG(W, H, rgba));
  console.log('wrote', name, `${W}x${H}`);
}

// tray: black template image (only alpha matters), 16 and 32
const BLACK = { k: '#000000' };
{ const b = image(16, 16); blit(b, 16, SPRITE.TRAY_FACE, 0, 0, 1, BLACK); write('trayTemplate.png', 16, 16, b); }
{ const b = image(32, 32); blit(b, 32, SPRITE.TRAY_FACE, 0, 0, 2, BLACK); write('trayTemplate@2x.png', 32, 32, b); }

// app icon: sit frame on a soft rounded square, 512x512
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
  blit(b, W, SPRITE.FRAMES[SPRITE.FRAME_INDEX.SIT], 64, 64, 24, SPRITE.PALETTE);
  write('icon.png', W, W, b);
}

// placeholder sheet for reference: 8 frames × 16px
{
  const b = image(128, 16);
  SPRITE.FRAMES.forEach((f, i) => blit(b, 128, f, i * 16, 0, 1, SPRITE.PALETTE));
  write('juliet-placeholder-sheet.png', 128, 16, b);
}

// big preview of all frames (for humans): 8 frames × 96px
{
  const b = image(8 * 96, 96);
  SPRITE.FRAMES.forEach((f, i) => blit(b, 8 * 96, f, i * 96, 0, 6, SPRITE.PALETTE));
  write('juliet-preview.png', 8 * 96, 96, b);
}

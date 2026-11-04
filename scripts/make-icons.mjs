// Генерирует PNG-иконки приложения без внешних зависимостей: свой растеризатор + zlib.
// Рисунок: белый фон, серебристый трек кольца, зелёная дуга прогресса 270° и светло-зелёная точка.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const BG = [0xff, 0xff, 0xff];
const TRACK = [0xe1, 0xe4, 0xe8];
const PROGRESS = [0x34, 0xb3, 0x6b];
const ENERGY = [0x9f, 0xe2, 0xb5];

// scale — доля размера, в которую вписан рисунок (для maskable меньше, safe zone 80%).
function shade(x, y, scale) {
  const cx = 0.5, cy = 0.5;
  const dx = (x - cx) / scale, dy = (y - cy) / scale;
  const r = Math.hypot(dx, dy);
  const R = 0.36, T = 0.1;
  if (r < 0.1) return ENERGY;
  // скруглённые концы дуги
  const caps = [0, 270].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [Math.sin(rad) * R, -Math.cos(rad) * R];
  });
  for (const [px, py] of caps) if (Math.hypot(dx - px, dy - py) <= T / 2) return PROGRESS;
  if (Math.abs(r - R) <= T / 2) {
    // угол от 12 часов по часовой стрелке, 0..360
    const a = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    return a <= 270 ? PROGRESS : TRACK;
  }
  return BG;
}

function render(size, scale) {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, scale);
          r += c[0]; g += c[1]; b += c[2];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(r / SS / SS);
      raw[o + 1] = Math.round(g / SS / SS);
      raw[o + 2] = Math.round(b / SS / SS);
    }
  }
  return png(size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['apple-touch-icon.png', 180, 1],
  ['icon-maskable-512.png', 512, 0.72],
];
for (const [name, size, scale] of files) {
  writeFileSync(join(OUT, name), render(size, scale));
  console.log('icons/' + name);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#FFFFFF"/>
<circle cx="50" cy="50" r="36" fill="none" stroke="#E1E4E8" stroke-width="10"/>
<path d="M50 14 A36 36 0 1 1 14 50" fill="none" stroke="#34B36B" stroke-width="10" stroke-linecap="round"/>
<circle cx="50" cy="50" r="10" fill="#9FE2B5"/>
</svg>
`;
writeFileSync(join(OUT, 'favicon.svg'), svg);
console.log('icons/favicon.svg');

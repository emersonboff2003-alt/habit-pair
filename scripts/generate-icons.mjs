/* Gera os ícones do PWA em public/icons via sharp. Uso: node scripts/generate-icons.mjs */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

function svg(size, maskable) {
  const inset = maskable ? 0 : size * 0.125;
  const r = (size - inset * 2) * 0.22;
  const bar = size * 0.0625;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#09090b"/>
  <rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" rx="${r}" fill="url(#g)"/>
  <path d="M ${size * 0.3} ${size * 0.5} L ${size * 0.46} ${size * 0.68} L ${size * 0.72} ${size * 0.34}" fill="none" stroke="#09090b" stroke-width="${bar}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

const targets = [
  { size: 192, file: "icon-192.png", maskable: false },
  { size: 512, file: "icon-512.png", maskable: false },
  { size: 192, file: "icon-192-maskable.png", maskable: true },
  { size: 512, file: "icon-512-maskable.png", maskable: true },
  { size: 180, file: "apple-touch-icon.png", maskable: false },
];

for (const { size, file, maskable } of targets) {
  const buffer = await sharp(Buffer.from(svg(size, maskable)))
    .png()
    .toBuffer();
  writeFileSync(resolve(outDir, file), buffer);
  console.log("Gerado:", file);
}

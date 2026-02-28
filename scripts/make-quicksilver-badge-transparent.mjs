#!/usr/bin/env node
/**
 * Make black background of quicksilver verified badge transparent.
 * Reads assets/quicksilver_verified_badge.png, writes back as PNG with alpha.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = join(root, 'assets', 'quicksilver_verified_badge.png');
const outputPath = inputPath;

if (!existsSync(inputPath)) {
  console.warn('[make-quicksilver-badge-transparent] File not found:', inputPath);
  process.exit(0);
}

const buffer = readFileSync(inputPath);
const { data, info } = await sharp(buffer)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const threshold = 40;

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r <= threshold && g <= threshold && b <= threshold) {
    data[i + 3] = 0;
  }
}

const out = await sharp(Buffer.from(data), {
  raw: { width, height, channels: 4 },
})
  .png()
  .toBuffer();

writeFileSync(outputPath, out);
console.log('Written', outputPath, 'with transparent background');

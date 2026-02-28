#!/usr/bin/env node
/**
 * One-off: make black background of gold checkmark badge transparent.
 * Reads assets/gold_checkmark_badge.png, writes back as PNG with alpha.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = join(root, 'assets', 'gold_checkmark_badge.png');
const outputPath = inputPath;

const buffer = readFileSync(inputPath);
const { data, info } = await sharp(buffer)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const threshold = 40; // treat pixels with R,G,B all below this as background

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r <= threshold && g <= threshold && b <= threshold) {
    data[i + 3] = 0; // alpha = 0
  }
}

const out = await sharp(Buffer.from(data), {
  raw: { width, height, channels: 4 },
})
  .png()
  .toBuffer();

writeFileSync(outputPath, out);
console.log('Written', outputPath, 'with transparent background');

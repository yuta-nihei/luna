// Normalizes the Luna source icon to a 1024×1024 square (1:1, Retina baseline)
// and applies a macOS squircle alpha mask for Dock rendering in dev builds.
//
//   node scripts/prepare-app-icon.mjs

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = join(ROOT, "public/images/luna-icon.png");
const OUTPUT = join(ROOT, "public/images/luna-icon-macos.png");

const SIZE = 1024;
// macOS Big Sur+ safe zone — artwork at 832/1024 matches Dock size of system apps.
const CONTENT_SIZE = Math.round(SIZE * (832 / 1024));
// Superellipse exponent used by macOS Big Sur+ icon silhouette (approximation).
const SQUIRCLE_N = 5;

function createSquircleMask(size) {
  const data = Buffer.alloc(size * size * 4);
  const radius = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - radius + 0.5) / radius;
      const ny = (y - radius + 0.5) / radius;
      const inside =
        Math.pow(Math.abs(nx), SQUIRCLE_N) + Math.pow(Math.abs(ny), SQUIRCLE_N) <= 1;
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = inside ? 255 : 0;
    }
  }

  return data;
}

function isGuideLinePixel(r, g, b, a) {
  return a > 200 && r <= 25 && b <= 50;
}

async function trimTemplateGuideLines(input, bounds) {
  const { data, info } = await sharp(input)
    .extract(bounds)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;

  function guideCount(y) {
    let count = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isGuideLinePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) count++;
    }
    return count;
  }

  let top = 0;
  while (top < h && guideCount(top) <= w * 0.25) top++;
  while (top < h && guideCount(top) > w * 0.25) top++;

  let bottom = h - 1;
  while (bottom > top && guideCount(bottom) <= w * 0.25) bottom--;
  while (bottom > top && guideCount(bottom) > w * 0.25) bottom--;

  return {
    left: bounds.left,
    top: bounds.top + top,
    width: bounds.width,
    height: bottom - top + 1,
  };
}

async function detectContentBounds(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const alpha = data[i + 3];
      const luminance = data[i] + data[i + 1] + data[i + 2];
      if (alpha > 16 && luminance > 24) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { left: 0, top: 0, width: info.width, height: info.height };
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function main() {
  const meta = await sharp(INPUT).metadata();
  const bg = await sharp(INPUT)
    .extract({
      left: Math.floor(meta.width / 2),
      top: Math.floor(meta.height / 2),
      width: 1,
      height: 1,
    })
    .raw()
    .toBuffer();

  const background = { r: bg[0], g: bg[1], b: bg[2] };
  const detected = await detectContentBounds(INPUT);
  const bounds = await trimTemplateGuideLines(INPUT, detected);

  const mask = await sharp(createSquircleMask(SIZE), {
    raw: { width: SIZE, height: SIZE, channels: 4 },
  })
    .png()
    .toBuffer();

  mkdirSync(dirname(OUTPUT), { recursive: true });

  const applySquircle = (input) =>
    sharp(input)
      .ensureAlpha()
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toFile(OUTPUT);

  const marginX = (SIZE - detected.width) / 2;
  const marginY = (SIZE - detected.height) / 2;
  const isMacOSReady =
    meta.width === SIZE &&
    meta.height === SIZE &&
    Math.abs(detected.width - CONTENT_SIZE) <= 8 &&
    Math.abs(detected.left - marginX) <= 8 &&
    Math.abs(detected.top - marginY) <= 8;

  if (isMacOSReady) {
    await applySquircle(INPUT);
    console.log(
      `wrote ${OUTPUT} (${SIZE}x${SIZE} square, macOS-ready passthrough ${detected.width}x${detected.height})`,
    );
    return;
  }

  // Crop letterboxing, fit into the macOS safe zone, center on 1024×1024 (1:1).
  const artwork = await sharp(INPUT)
    .extract(bounds)
    .resize(CONTENT_SIZE, CONTENT_SIZE, { fit: "contain", background })
    .png()
    .toBuffer();

  const canvas = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: artwork, gravity: "center" }])
    .png()
    .toBuffer();

  await applySquircle(canvas);

  console.log(
    `wrote ${OUTPUT} (${SIZE}x${SIZE} square, crop ${bounds.width}x${bounds.height} guide-trimmed → ${CONTENT_SIZE}px safe zone)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

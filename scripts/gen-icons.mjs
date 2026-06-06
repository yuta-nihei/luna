// Generates valid placeholder app icons for Tauri into src-tauri/icons/.
// Solid Luna-accent squares — replace later with `pnpm tauri icon <logo.png>`.
//
//   node scripts/gen-icons.mjs
//
// Produces: 32x32.png, 128x128.png, 128x128@2x.png (256), icon.png (512),
// icon.ico (PNG-encoded), icon.icns (ic08 256 chunk).

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const COLOR = [0x7a, 0xa2, 0xf7, 0xff]; // Luna accent #7AA2F7

const crcTable = (() => {
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
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePNG(size, [r, g, b, a]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const row = Buffer.alloc(1 + size * 4);
  for (let x = 0; x < size; x++) {
    const o = 1 + x * 4;
    row[o] = r;
    row[o + 1] = g;
    row[o + 2] = b;
    row[o + 3] = a;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeICO(png256) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 0 => 256
  entry[1] = 0; // height 0 => 256
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png256.length, 8); // size
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, png256]);
}

function makeICNS(png256) {
  const type = Buffer.from("ic08", "ascii"); // 256x256
  const clen = Buffer.alloc(4);
  clen.writeUInt32BE(8 + png256.length, 0);
  const body = Buffer.concat([type, clen, png256]);
  const magic = Buffer.from("icns", "ascii");
  const flen = Buffer.alloc(4);
  flen.writeUInt32BE(8 + body.length, 0);
  return Buffer.concat([magic, flen, body]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });

const png256 = makePNG(256, COLOR);
const files = {
  "32x32.png": makePNG(32, COLOR),
  "128x128.png": makePNG(128, COLOR),
  "128x128@2x.png": png256,
  "icon.png": makePNG(512, COLOR),
  "icon.ico": makeICO(png256),
  "icon.icns": makeICNS(png256),
};

for (const [name, buf] of Object.entries(files)) {
  writeFileSync(join(outDir, name), buf);
  console.log(`wrote icons/${name} (${buf.length} bytes)`);
}

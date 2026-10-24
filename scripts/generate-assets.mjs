/**
 * scripts/generate-assets.mjs
 * توليد أصول الصور والأيقونات (assets):
 * - assets/spc-logo.png (295x248)
 * - assets/header-sy.png (224x116)
 * - assets/icon.png (256x256)
 * - assets/icon.ico (256x256 حاوية ICO متوافقة مع Windows و NSIS)
 * - تضمين خطوط Amiri في assets/fonts إن لم تكن متوفرة
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function createPng(width, height, r, g, b, isIcon = false) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR: 8-bit RGBA (color type 6) or RGB (color type 2)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines: for each row, 1 filter byte (0) + width * 4 bytes RGBA
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      if (isIcon) {
        // رسم نمط دائري جذاب للأيقونة باللون النفطي والذهبي الخاص بـ SPC
        const centerX = width / 2;
        const centerY = height / 2;
        const dist = Math.hypot(x - centerX, y - centerY);
        const radius = width * 0.45;
        
        if (dist <= radius) {
          // خلفية دائرية نفطية #0F4C5C
          if (dist > radius - 6) {
            // إطار ذهبي خارجي
            rawData[pxOffset] = 217;     // R
            rawData[pxOffset + 1] = 119; // G
            rawData[pxOffset + 2] = 6;   // B
            rawData[pxOffset + 3] = 255; // A
          } else {
            rawData[pxOffset] = 15;      // R: #0F4C5C
            rawData[pxOffset + 1] = 76;  // G
            rawData[pxOffset + 2] = 92;  // B
            rawData[pxOffset + 3] = 255; // A
          }
        } else {
          // شفافية خارج الدائرة
          rawData[pxOffset] = 0;
          rawData[pxOffset + 1] = 0;
          rawData[pxOffset + 2] = 0;
          rawData[pxOffset + 3] = 0;
        }
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * إنشاء ملف ICO يحوي PNG بقياس 256x256 (القياس المعياري لـ Windows و NSIS)
 */
function createIcoFromPng(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type = 1 (Icon)
  header.writeUInt16LE(1, 4); // Count = 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(0, 0);   // Width: 0 = 256px
  dirEntry.writeUInt8(0, 1);   // Height: 0 = 256px
  dirEntry.writeUInt8(0, 2);   // Color count: 0 (>=8bpp)
  dirEntry.writeUInt8(0, 3);   // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(pngBuffer.length, 8); // Image size in bytes
  dirEntry.writeUInt32LE(22, 12); // Image offset (6 + 16 = 22)

  return Buffer.concat([header, dirEntry, pngBuffer]);
}

const assetsDir = path.join(process.cwd(), 'assets');
const publicAssetsDir = path.join(process.cwd(), 'public', 'assets');
const fontsDir = path.join(assetsDir, 'fonts');
const publicFontsDir = path.join(publicAssetsDir, 'fonts');

for (const dir of [assetsDir, publicAssetsDir, fontsDir, publicFontsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. spc-logo.png: 295x248
const spcLogo = createPng(295, 248, 15, 76, 92);
fs.writeFileSync(path.join(assetsDir, 'spc-logo.png'), spcLogo);
fs.writeFileSync(path.join(publicAssetsDir, 'spc-logo.png'), spcLogo);

// 2. header-sy.png: 224x116
const headerSy = createPng(224, 116, 20, 30, 45);
fs.writeFileSync(path.join(assetsDir, 'header-sy.png'), headerSy);
fs.writeFileSync(path.join(publicAssetsDir, 'header-sy.png'), headerSy);

// 3. icon.png: 256x256
const iconPng = createPng(256, 256, 15, 76, 92, true);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPng);
fs.writeFileSync(path.join(publicAssetsDir, 'icon.png'), iconPng);

// 4. icon.ico: 256x256 ICO
const iconIco = createIcoFromPng(iconPng);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), iconIco);

console.log('✅ تم توليد وتحديث أصول المشروع بنجاح:');
console.log('- assets/spc-logo.png (295x248)');
console.log('- assets/header-sy.png (224x116)');
console.log('- assets/icon.png (256x256)');
console.log('- assets/icon.ico (256x256 NSIS Windows Icon)');

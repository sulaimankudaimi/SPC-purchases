#!/usr/bin/env node
/**
 * scripts/extract-assets.mjs
 * سكربت استخراج الصورتين من ملف الاستمارة طلب_اساسي.xlsx
 * بدون أي مكتبات خارجية (Pure Node.js built-ins)
 *
 * المسارات المستهدفة:
 * xl/media/image1.png -> assets/spc-logo.png  (295×248)
 * xl/media/image2.png -> assets/header-sy.png (224×116)
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const XLSX_PATH = path.join(ROOT_DIR, 'docs', 'reference', 'طلب_اساسي.xlsx');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

// دالة فحص أبعاد PNG
function getPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) return null;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isPng) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

// محلل ملفات ZIP نقي في Node.js لقراءة ملفات XLSX (وهي في حقيقتها أرشيف ZIP)
function extractImagesPureNode(xlsxPath) {
  const buf = fs.readFileSync(xlsxPath);
  let offset = 0;
  const extracted = {};

  while (offset < buf.length - 4) {
    const sig = buf.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      // Local file header signature
      const compression = buf.readUInt16LE(offset + 8);
      const compressedSize = buf.readUInt32LE(offset + 18);
      const uncompressedSize = buf.readUInt32LE(offset + 22);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);

      const fileName = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;
      const dataEnd = dataStart + compressedSize;

      if (fileName.includes('image1.png') || fileName.includes('image2.png')) {
        const rawData = buf.subarray(dataStart, dataEnd);
        let decompressedData;
        if (compression === 0) {
          decompressedData = rawData;
        } else if (compression === 8) {
          decompressedData = zlib.inflateRawSync(rawData);
        }
        if (decompressedData) {
          extracted[fileName] = decompressedData;
        }
      }

      offset = dataEnd;
    } else if (sig === 0x02014b50 || sig === 0x06054b50) {
      // Central directory or end of central directory
      break;
    } else {
      offset++;
    }
  }

  return extracted;
}

function run() {
  console.log('\n--- بدء استخراج صور الاستمارة من docs/reference/طلب_اساسي.xlsx ---');

  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`❌ الملف المرجعي غير موجود في المسار: ${XLSX_PATH}`);
    console.error('يرجى نسخ ملف "طلب_اساسي.xlsx" إلى مجلد docs/reference/ أولاً.');
    process.exit(1);
  }

  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  let extracted = {};
  try {
    extracted = extractImagesPureNode(XLSX_PATH);
  } catch (err) {
    console.warn(`تحذير: فشل المحلل الداخلي (${err.message})، جاري محاولة استخدام أدوات النظام...`);
  }

  const logoTarget = path.join(ASSETS_DIR, 'spc-logo.png');
  const headerTarget = path.join(ASSETS_DIR, 'header-sy.png');

  let img1Data = extracted['xl/media/image1.png'] || extracted['xl/media/image1.PNG'];
  let img2Data = extracted['xl/media/image2.png'] || extracted['xl/media/image2.PNG'];

  if (!img1Data || !img2Data) {
    // محاولة استخراج بديلة عبر أدوات النظام
    console.log('جاري الاستخراج عبر أدوات النظام...');
    try {
      if (process.platform === 'win32') {
        const tempDir = path.join(ROOT_DIR, '.temp_xlsx_extract');
        execSync(`powershell -Command "Expand-Archive -Path '${XLSX_PATH}' -DestinationPath '${tempDir}' -Force"`);
        if (fs.existsSync(path.join(tempDir, 'xl/media/image1.png'))) {
          fs.copyFileSync(path.join(tempDir, 'xl/media/image1.png'), logoTarget);
        }
        if (fs.existsSync(path.join(tempDir, 'xl/media/image2.png'))) {
          fs.copyFileSync(path.join(tempDir, 'xl/media/image2.png'), headerTarget);
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
      } else {
        execSync(`unzip -p "${XLSX_PATH}" "xl/media/image1.png" > "${logoTarget}"`);
        execSync(`unzip -p "${XLSX_PATH}" "xl/media/image2.png" > "${headerTarget}"`);
      }
    } catch (sysErr) {
      console.error(`❌ تعذر الاستخراج عبر أدوات النظام: ${sysErr.message}`);
    }
  } else {
    fs.writeFileSync(logoTarget, img1Data);
    fs.writeFileSync(headerTarget, img2Data);
  }

  // التحقق من وجود وأبعاد الملفات المستخرجة
  const logoDims = fs.existsSync(logoTarget) ? getPngDimensions(logoTarget) : null;
  const headerDims = fs.existsSync(headerTarget) ? getPngDimensions(headerTarget) : null;

  console.log('\nنتيجة الفحص:');
  if (logoDims) {
    const ok = logoDims.width === 295 && logoDims.height === 248;
    console.log(`${ok ? '✅' : '⚠️'} assets/spc-logo.png: ${logoDims.width}×${logoDims.height} (المتوقع 295×248)`);
  } else {
    console.log('❌ assets/spc-logo.png: غير موجود');
  }

  if (headerDims) {
    const ok = headerDims.width === 224 && headerDims.height === 116;
    console.log(`${ok ? '✅' : '⚠️'} assets/header-sy.png: ${headerDims.width}×${headerDims.height} (المتوقع 224×116)`);
  } else {
    console.log('❌ assets/header-sy.png: غير موجود');
  }
}

run();

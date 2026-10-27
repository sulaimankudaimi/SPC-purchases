/**
 * tests/cases/fix7.ts
 * حالات اختبار المرحلة F7: معايير الكود، جودة البناء، الخطوط، واستقرار الاختبارات السابقة
 * - F7.1 [AIS]: مسح شجرة src/ كاملة والتأكد أن لا ملف برمجي يتجاوز 300 سطر.
 * - F7.2 [AIS]: فحص package.json والتأكد من غياب @google/genai و express و dotenv و motion و @types/express.
 * - F7.3 [AIS]: فحص استيراد Amiri في الواجهة ووجود @font-face بعنوان data: في ناتج buildPrDocument.
 * - F7.4 [CI]: تشغيل tsc --noEmit (strict) و eslint و prettier --check والتأكد من نجاحها.
 * - F7.5 [AIS+CI]: التأكد من نجاح جميع حالات الاختبارات السابقة.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { t, assert } from '../lib/harness';
import { buildPrDocument } from '../../src/shared/pdfLayout';
import { amiriFontDataUri } from '../../src/shared/amiriFont';

export function registerFix7Tests() {
  // F7.1: مسح شجرة src/ والتأكد من عدم تجاوز 300 سطر
  t('F7.1', '[AIS] لا يوجد أي ملف مصدري في src/ يتجاوز 300 سطر', () => {
  const srcDir = path.resolve(process.cwd(), 'src');
  const violations: Array<{ file: string; lines: number }> = [];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanDir(fullPath);
      } else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        if (lines > 300) {
          violations.push({ file: path.relative(process.cwd(), fullPath), lines });
        }
      }
    }
  }

  scanDir(srcDir);
  assert.equal(
    violations.length,
    0,
    `توجد ملفات تتجاوز 300 سطر في src/: ${violations.map((v) => `${v.file} (${v.lines} سطر)`).join(', ')}`
  );
});

// F7.2: خلو package.json من الحزم غير المبررة
t('F7.2', '[AIS] خلو package.json من الحزم غير المبررة (@google/genai, express, dotenv, motion)', () => {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };

  const forbidden = ['@google/genai', 'express', 'dotenv', 'motion', '@types/express'];
  for (const f of forbidden) {
    assert.ok(!allDeps[f], `الحزمة غير المبررة ${f} لا تزال موجودة في package.json`);
  }

  // التأكد من وجود lucide-react المستعملة
  assert.ok(allDeps['lucide-react'], 'حزمة lucide-react يجب أن تبقى لأنها مستخدمة فعلياً في الواجهة');
  // التأكد من وجود @fontsource/amiri
  assert.ok(allDeps['@fontsource/amiri'], 'حزمة @fontsource/amiri يجب أن تكون مثبتة ومحددة الإصدار');
});

// F7.3: فحص خط Amiri ودمجه كـ data URI داخل PDF
t('F7.3', '[AIS] استيراد Amiri في الواجهة ووجود @font-face بعنوان data: في ناتج buildPrDocument', () => {
  // 1. فحص index.css للتأكد من استيراد @fontsource/amiri وخلوه من مسار Amiri غير الموجود
  const cssPath = path.resolve(process.cwd(), 'src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssContent.includes('@fontsource/amiri'), 'index.css يجب أن يستورد خط amiri من @fontsource/amiri');
  assert.ok(!cssContent.includes('/assets/fonts/Amiri-'), 'index.css يجب ألا يحتوي على مسار /assets/fonts/Amiri-* غير الموجود');
  assert.ok(cssContent.includes("local('Sakkal Majalla')"), "index.css يجب أن يبقي على Sakkal Majalla عبر local() أولاً");

  // 2. فحص amiriFontDataUri
  assert.ok(amiriFontDataUri.startsWith('data:font/woff2;base64,'), 'amiriFontDataUri يجب أن يبدأ بـ data:font/woff2;base64,');

  // 3. فحص buildPrDocument واحتوائه على @font-face مع data:
  const pdfHtml = buildPrDocument(
    {
      code: 'spc 1-9-26 (1)',
      request_date: '2026-09-01',
      entity: 'دائرة الإنتاج',
      requester: 'م. ناصر العوده'
    },
    [
      { line_no: 1, name: 'صمام أمان', qty: 2, unit_price: 15000 }
    ]
  );

  assert.ok(pdfHtml.includes("@font-face"), 'مستند PDF يجب أن يحتوي على @font-face');
  assert.ok(pdfHtml.includes("font-family: 'Amiri'"), "مستند PDF يجب أن يعرف font-family: 'Amiri'");
  assert.ok(pdfHtml.includes("url('data:font/woff2;base64,"), 'مستند PDF يجب أن يضمّن خط Amiri كـ Data URI بصيغة data:font/woff2;base64,');
});

// F7.4: فحص tsc --noEmit و eslint و prettier --check
t('F7.4', '[CI] اجتياز tsc --noEmit (strict) و eslint و prettier --check بنجاح دون أي خطأ', () => {
  // فحص tsconfig strict
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  assert.equal(tsconfig.compilerOptions?.strict, true, 'tsconfig.json يجب أن يفعّل "strict": true');
  assert.ok(Array.isArray(tsconfig.include), 'tsconfig.json يجب أن يحتوي على include');

  // تشغيل prettier --check
  try {
    execSync('npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}" "scripts/**/*.ts"', {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
  } catch (err: any) {
    assert.ok(false, `فحص Prettier فشل: ${err?.stderr?.toString() || err?.message}`);
  }

  // تشغيل eslint
  try {
    execSync('npx eslint src/ scripts/ tests/', {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
  } catch (err: any) {
    assert.ok(false, `فحص ESLint فشل: ${err?.stderr?.toString() || err?.message}`);
  }

  // تشغيل tsc --noEmit
  try {
    execSync('npm run lint', {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
  } catch (err: any) {
    assert.ok(false, `فحص tsc --noEmit فشل: ${err?.stdout?.toString() || err?.message}`);
  }
});

  // F7.5: فحص اجتياز جميع الاختبارات السابقة
  t('F7.5', '[AIS+CI] استقرار جميع الحالات السابقة واجتيازها دون فشل', () => {
    // فحص تشغيل حالات fix1, fix4, fix6
    try {
      execSync('npm run fix1:test', { cwd: process.cwd(), stdio: 'pipe' });
      execSync('npm run fix4:test', { cwd: process.cwd(), stdio: 'pipe' });
      execSync('npm run fix6:test', { cwd: process.cwd(), stdio: 'pipe' });
    } catch (err: any) {
      assert.ok(false, `فشل أحد الاختبارات السابقة: ${err?.stdout?.toString() || err?.message}`);
    }
  });
}

registerFix7Tests();


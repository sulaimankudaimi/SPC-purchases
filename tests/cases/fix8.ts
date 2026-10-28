/**
 * tests/cases/fix8.ts
 * حالات اختبار المرحلة F8: مواءمة وثائق التقدم docs/PROGRESS.md وقرارات DECISIONS.md ومصفوفة التتبع
 * 
 * الحالات المغطاة:
 * - F8.1 [AIS] كل مرحلة 0–10 لها صف في PROGRESS.md.
 * - F8.2 [AIS] لا عبارة «بنسبة 100%» دون مرجع حالة اختبار.
 * - F8.3 [AIS] كل D وX وO و(أ–د) له صف في مصفوفة التتبع.
 */

import { t, assert } from '../lib/harness';

async function readFileSafe(relativePath: string): Promise<string> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const fullPath = path.resolve(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    try {
      const cleanPath = relativePath.replace(/^\.\//, '');
      const res = await window.fetch('/' + cleanPath);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // ignore
    }
  }

  return '';
}

export function registerFix8Tests(): void {
  // -------------------------------------------------------------------------
  // F8.1 [AIS]: كل مرحلة 0–10 لها صف في PROGRESS.md
  // -------------------------------------------------------------------------
  t('F8.1', '[AIS] كل مرحلة 0–10 لها صف في PROGRESS.md', async () => {
    const content = await readFileSafe('docs/PROGRESS.md');
    assert.ok(content.length > 0, 'تعذر قراءة ملف docs/PROGRESS.md');

    for (let i = 0; i <= 10; i++) {
      const phasePattern = `المرحلة ${i}`;
      assert.ok(
        content.includes(phasePattern),
        `المرحلة ${i} مفقودة من جدول تقدم المراحل في docs/PROGRESS.md`
      );
    }
    assert.ok(content.includes('المرحلة 11'), 'المرحلة 11 مفقودة من docs/PROGRESS.md');
  });

  // -------------------------------------------------------------------------
  // F8.2 [AIS]: لا عبارة «بنسبة 100%» دون مرجع حالة اختبار
  // -------------------------------------------------------------------------
  t('F8.2', '[AIS] لا عبارة «بنسبة 100%» دون مرجع حالة اختبار', async () => {
    const content = await readFileSafe('docs/PROGRESS.md');
    assert.ok(content.length > 0, 'تعذر قراءة ملف docs/PROGRESS.md');

    const matrixIndex = content.indexOf('## مصفوفة تتبع القرارات المعتمدة والممنوعات');
    assert.ok(matrixIndex !== -1, 'مصفوفة تتبع القرارات غير موجودة');

    const matrixPart = content.slice(matrixIndex);
    const lines = matrixPart.split('\n');

    for (const line of lines) {
      if (line.includes('بنسبة 100%')) {
        const hasRef = /(T-\d+|E-\d+|F\d+\.\d+|[A-Z]\d+\.\d+)/.test(line);
        assert.ok(
          hasRef,
          `وُجدت عبارة «بنسبة 100%» دون مرجع اختبار في السطر: ${line}`
        );
      }
      assert.equal(
        line.includes('مثبت ومجتاز بنسبة 100%'),
        false,
        `العبارة العامة القديمة «مثبت ومجتاز بنسبة 100%» لا تزال موجودة في السطر: ${line}`
      );
    }
  });

  // -------------------------------------------------------------------------
  // F8.3 [AIS]: كل D وX وO و(أ–د) له صف في المصفوفة
  // -------------------------------------------------------------------------
  t('F8.3', '[AIS] كل D وX وO و(أ–د) له صف في المصفوفة', async () => {
    const content = await readFileSafe('docs/PROGRESS.md');
    assert.ok(content.length > 0, 'تعذر قراءة ملف docs/PROGRESS.md');

    const matrixIndex = content.indexOf('## مصفوفة تتبع القرارات المعتمدة والممنوعات');
    assert.ok(matrixIndex !== -1, 'مصفوفة تتبع القرارات غير موجودة');
    const matrixPart = content.slice(matrixIndex);

    // D1 إلى D12
    for (let i = 1; i <= 12; i++) {
      assert.ok(
        matrixPart.includes(`**D${i}**`),
        `القرار D${i} مفقود من مصفوفة التتبع`
      );
    }

    // X1 إلى X5
    for (let i = 1; i <= 5; i++) {
      assert.ok(
        matrixPart.includes(`**X${i}**`),
        `الممنوع X${i} مفقود من مصفوفة التتبع`
      );
    }

    // O1 إلى O5
    for (let i = 1; i <= 5; i++) {
      assert.ok(
        matrixPart.includes(`**O${i}**`),
        `القرار المفتوح O${i} مفقود من مصفوفة التتبع`
      );
    }

    // (أ) إلى (د)
    const openItems = ['(أ)', '(ب)', '(ج)', '(د)'];
    for (const item of openItems) {
      assert.ok(
        matrixPart.includes(item),
        `البند المفتوح ${item} مفقود من مصفوفة التتبع`
      );
    }
  });

  // -------------------------------------------------------------------------
  // G1.1 [AIS]: لا || echo في build.yml
  // -------------------------------------------------------------------------
  t('G1.1', '[AIS] لا || echo في build.yml', async () => {
    const content = await readFileSafe('.github/workflows/build.yml');
    assert.ok(content.length > 0, 'تعذر قراءة ملف .github/workflows/build.yml');
    assert.equal(
      content.includes('|| echo'),
      false,
      'وُجد التعبير الممنوع || echo داخل ملف سير عمل build.yml'
    );
  });

  // -------------------------------------------------------------------------
  // G1.2 [AIS]: PROGRESS لا يحوي «ناجحة» لمراحل F4–F7
  // -------------------------------------------------------------------------
  t('G1.2', '[AIS] PROGRESS لا يحوي «ناجحة» لمراحل F4–F7', async () => {
    const content = await readFileSafe('docs/PROGRESS.md');
    assert.ok(content.length > 0, 'تعذر قراءة ملف docs/PROGRESS.md');
    const lines = content.split('\n');
    for (const line of lines) {
      if (/F[4-7]/.test(line)) {
        assert.equal(
          line.includes('ناجحة'),
          false,
          `وُجدت كلمة «ناجحة» غير المستندة لتشغيل فعلي في سطر المرحلة: ${line}`
        );
      }
    }
  });

  // -------------------------------------------------------------------------
  // G3.1 [AIS]: لا استيراد من scripts/fixtures أو tests/fixtures داخل src (مسح raw)
  // -------------------------------------------------------------------------
  t('G3.1', '[AIS] لا استيراد من scripts/fixtures أو tests/fixtures داخل src (مسح raw)', async () => {
    let files: Array<{ path: string; content: string }> = [];

    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('node:fs');
      const path = await import('node:path');

      function scan(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'out' && entry.name !== 'dist') {
              scan(full);
            }
          } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js'))) {
            files.push({ path: full, content: fs.readFileSync(full, 'utf-8') });
          }
        }
      }
      scan(path.resolve(process.cwd(), 'src'));
    }

    if (files.length === 0 && typeof import.meta !== 'undefined' && (import.meta as any).glob) {
      const rawMap = (import.meta as any).glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
      files = Object.entries(rawMap).map(([p, content]) => ({ path: p, content: content as string }));
    }

    assert.ok(files.length > 0, 'لم يتم العثور على ملفات في src/ لفحص الاستيراد');

    for (const file of files) {
      assert.equal(
        file.content.includes('scripts/fixtures') || file.content.includes('tests/fixtures'),
        false,
        `تم العثور على استيراد من fixtures داخل كود المصدر src في الملف: ${file.path}`
      );
    }
  });
}

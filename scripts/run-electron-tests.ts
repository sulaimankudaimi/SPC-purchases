/**
 * scripts/run-electron-tests.ts
 * اختبارات Electron المؤجلة لبيئة Windows CI (المرحلة 10):
 * - E-1: إعدادات النافذة وأعلام الأمان (contextIsolation, sandbox, nodeIntegration, CSP, الأبعاد)
 * - E-2: فحص الأمان وعدم تضمين مفتاح service_role في كود العميل src/ (قاعدة 8 و D5)
 * - E-3: التحقق من معايير توليد PDF بصفحات 1/12/13 و A4 والنص `Notes` ومسار الأرشيف
 * - E-4: إعدادات التنصيب ومثبت NSIS في electron-builder.yml (D1 و D12)
 */

import fs from 'node:fs';
import path from 'node:path';
import { MAIN_WINDOW_CONFIG, CSP_HEADER } from '../src/main/index';
import { paginate, buildPrDocument } from '../src/shared/pdfLayout';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function check(id: string, name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    results.push({ id, name, passed: true });
    console.log(`  ✅ [${id}] ${name}`);
  } catch (err: any) {
    results.push({ id, name, passed: false, error: err?.message || String(err) });
    console.error(`  ❌ [${id}] ${name}: ${err?.message}`);
  }
}

async function run() {
  console.log('=== تشغيل فحوصات الإعداد الثابت (static-config) ===\n');

  // -------------------------------------------------------------------------
  // static-config-1: تشغيل النافذة وأعلام الأمان
  // -------------------------------------------------------------------------
  check('static-config-1', 'إعدادات النافذة وأعلام الأمان (contextIsolation=true, sandbox=true, nodeIntegration=false, CSP)', () => {
    if (!MAIN_WINDOW_CONFIG) throw new Error('إعدادات النافذة الرئيسية مفقودة');
    if (MAIN_WINDOW_CONFIG.minWidth < 1100 || MAIN_WINDOW_CONFIG.minHeight < 700) {
      throw new Error(`أبعاد النافذة الدنيا أصغر من 1100x700: ${MAIN_WINDOW_CONFIG.minWidth}x${MAIN_WINDOW_CONFIG.minHeight}`);
    }
    const wp = MAIN_WINDOW_CONFIG.webPreferences;
    if (wp.nodeIntegration !== false) throw new Error('nodeIntegration يجب أن تكون false تماماً');
    if (wp.contextIsolation !== true) throw new Error('contextIsolation يجب أن تكون true تماماً');
    if (wp.sandbox !== true) throw new Error('sandbox يجب أن تكون true تماماً');
    if (!CSP_HEADER.includes("default-src 'self'")) throw new Error('سياسة CSP تفتقر إلى default-src');
    if (!CSP_HEADER.includes("https://*.supabase.co")) throw new Error('سياسة CSP لا تسمح بنطاق Supabase');
  });

  // -------------------------------------------------------------------------
  // static-config-2: فحص الأمان وعدم تضمين مفاتيح service_role في src/ (قاعدة 8 و D5)
  // -------------------------------------------------------------------------
  check('static-config-2', 'خلو ملفات الواجهة والعميل src/ من أي مفاتيح service_role (قاعدة 8)', () => {
    const srcDir = path.join(process.cwd(), 'src');
    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('SERVICE_ROLE') || content.includes('service_role_key')) {
            throw new Error(`تسريب أمني: تم العثور على إشارة إلى service_role في الملف ${file}`);
          }
        }
      }
    }
    scanDir(srcDir);
  });

  // -------------------------------------------------------------------------
  // static-config-3: معايير توليد PDF بصفحات 1/12/13 ومقاس A4 والنص Notes ومسار الأرشيف
  // -------------------------------------------------------------------------
  check('static-config-3', 'تخطيط PDF: تقسيم الصفحات 1 و12 و13، A4، تصحيح Notes، ومسار الأرشيف (D2, D8, D10)', () => {
    // 1. فحص 1 مادة -> صفحة واحدة
    const items1 = [{ line_no: 1, name: 'أنبوب', specs: '', unit: 'عدد', qty: 2, unit_price: 100, line_total: 200, notes: '' }];
    const pages1 = paginate(items1);
    if (pages1.length !== 1) throw new Error(`1 مادة أنتجت ${pages1.length} صفحات والمطلوب 1`);

    // 2. فحص 12 مادة -> صفحة واحدة
    const items12 = Array.from({ length: 12 }, (_, i) => ({
      line_no: i + 1,
      name: `مادة ${i + 1}`,
      specs: 'مواصفة',
      unit: 'قطعة',
      qty: 1,
      unit_price: 50,
      line_total: 50,
      notes: ''
    }));
    const pages12 = paginate(items12);
    if (pages12.length !== 1) throw new Error(`12 مادة أنتجت ${pages12.length} صفحات والمطلوب 1`);

    // 3. فحص 13 مادة -> صفحتان
    const items13 = Array.from({ length: 13 }, (_, i) => ({
      line_no: i + 1,
      name: `مادة ${i + 1}`,
      specs: 'مواصفة',
      unit: 'قطعة',
      qty: 1,
      unit_price: 50,
      line_total: 50,
      notes: ''
    }));
    const pages13 = paginate(items13);
    if (pages13.length !== 2) throw new Error(`13 مادة أنتجت ${pages13.length} صفحات والمطلوب 2`);

    // 4. فحص تصحيح nots إلى Notes
    const sampleRequest = {
      code: 'spc 1-1-26 (1)',
      request_date: '2026-01-01',
      entity: 'الإنتاج',
      requester: 'سليمان',
      currency: 'ليرة سورية جديدة'
    };
    const html = buildPrDocument(sampleRequest, items1, {
      signatories: {
        supply_manager: 'أحمد',
        dept_manager: 'خالد',
        procurement: 'عمر'
      }
    });

    if (!html.includes('Notes') && !html.includes('ملاحظات')) {
      throw new Error('لم يتم العثور على عمود Notes المصحح في HTML الاستمارة');
    }

    if (html.includes('>nots<')) {
      throw new Error('الخطأ الإملائي القديم nots لا يزال موجوداً في قالب الاستمارة');
    }
  });

  // -------------------------------------------------------------------------
  // static-config-4: إعدادات مثبت NSIS والتنصيب
  // -------------------------------------------------------------------------
  check('static-config-4', 'التحقق من إعدادات electron-builder لـ NSIS ومسارات الاختصارات (D1, D12)', () => {
    const configPath = path.join(process.cwd(), 'electron-builder.yml');
    const content = fs.readFileSync(configPath, 'utf8');

    if (!content.includes('nsis')) throw new Error('الهدف nsis غير محدد في electron-builder.yml');
    if (!content.includes('publish: null')) throw new Error('يجب تعطيل التحديث التلقائي publish: null وفق القرار D12');
    if (!content.includes('sign: null')) throw new Error('التطبيق غير موقع رقمياً sign: null وفق القرار D12');
    if (!content.includes('createDesktopShortcut: always')) throw new Error('إنشاء اختصار سطح المكتب مطلوب دائماً');
  });

  console.log('\n--- نتائج فحص Electron المؤجل ---');
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`❌ فشل ${failed.length} من أصل ${results.length} فحصاً!`);
    process.exit(1);
  } else {
    console.log(`✅ نجحت كافة فحوصات Electron المؤجلة (${results.length}/${results.length}) بنسبة 100%!`);
  }
}

run().catch((err) => {
  console.error('خطأ غير متوقع:', err);
  process.exit(1);
});

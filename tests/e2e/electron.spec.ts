/**
 * tests/e2e/electron.spec.ts
 * اختبارات Playwright E2E الشاملة لتطبيق Electron الحقيقي (منظومة المشتريات)
 * تُشغّل التطبيق فعلياً بـ _electron.launch على ناتج البناء out/main/index.js
 * وتتحقق من المتطلبات المعمارية والأمنية والوظيفية (E1 إلى E6).
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { buildPrDocument } from '../../src/shared/pdfLayout';

const rootDir = path.resolve(__dirname, '../../');
const outMainPath = path.join(rootDir, 'out/main/index.js');

function logStepSummary(testId: string, title: string, success: boolean, detail?: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    const icon = success ? '✅' : '❌';
    const extra = detail ? ` (${detail})` : '';
    fs.appendFileSync(summaryPath, `- ${icon} **${testId}**: ${title}${extra}\n`, 'utf8');
  } catch {
    // Ignore in local environments without GITHUB_STEP_SUMMARY
  }
}

test.describe.serial('اختبارات تكامل Playwright في بيئة Electron الحقيقية (E1 إلى E6)', () => {
  let electronApp: ElectronApplication;
  let firstWindow: Page;

  test.beforeAll(async () => {
    if (!fs.existsSync(outMainPath)) {
      throw new Error(`ملف البناء out/main/index.js غير موجود في المسار: ${outMainPath}. يجب تشغيل npm run build أولاً.`);
    }

    // تشغيل تطبيق Electron فعلياً من ملف البناء
    electronApp = await electron.launch({
      args: [outMainPath]
    });

    firstWindow = await electronApp.firstWindow();
    await firstWindow.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      try {
        await electronApp.close();
      } catch {
        // ignore if already closed
      }
    }
  });

  // -------------------------------------------------------------------------
  // E1: عنوان النافذة ووسم html dir=rtl وlang=ar
  // -------------------------------------------------------------------------
  test('E1: عنوان النافذة ووسم html dir=rtl وlang=ar', async () => {
    try {
      const title = await firstWindow.title();
      expect(title).toContain('منظومة المشتريات');

      const dir = await firstWindow.evaluate(() => document.documentElement.getAttribute('dir'));
      const lang = await firstWindow.evaluate(() => document.documentElement.getAttribute('lang'));

      expect(dir).toBe('rtl');
      expect(lang).toBe('ar');

      logStepSummary('E1', 'عنوان النافذة ووسم html dir=rtl وlang=ar', true);
    } catch (err: any) {
      logStepSummary('E1', 'عنوان النافذة ووسم html dir=rtl وlang=ar', false, err?.message);
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // E2: typeof require داخل الصفحة 'undefined' وwindow.api.ping() يعيد 'pong' وwindow.open لا يفتح نافذة
  // -------------------------------------------------------------------------
  test('E2: typeof require داخل الصفحة undefined وwindow.api.ping() يعيد pong وwindow.open لا يفتح نافذة', async () => {
    try {
      const isRequireUndefined = await firstWindow.evaluate(() => typeof (window as any).require === 'undefined');
      expect(isRequireUndefined).toBe(true);

      const ping = await firstWindow.evaluate(async () => {
        const api = (window as any).api;
        return api ? await api.ping() : null;
      });
      expect(ping).toBe('pong');

      const initialWindows = electronApp.windows().length;
      const openResult = await firstWindow.evaluate(() => {
        return window.open('https://example.com');
      });
      expect(openResult).toBeNull();
      expect(electronApp.windows().length).toBe(initialWindows);

      logStepSummary('E2', 'عزل السياق (typeof require = undefined) ونجاح ping ورفض window.open', true);
    } catch (err: any) {
      logStepSummary('E2', 'عزل السياق (typeof require = undefined) ونجاح ping ورفض window.open', false, err?.message);
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // E3: تشغيل نسخة ثانية لا يزيد عدد النوافذ (Single Instance Lock)
  // -------------------------------------------------------------------------
  test('E3: تشغيل نسخة ثانية لا يزيد عدد النوافذ (Single Instance Lock)', async () => {
    try {
      const initialWindows = electronApp.windows().length;
      let secondApp: ElectronApplication | null = null;
      try {
        secondApp = await electron.launch({
          args: [outMainPath]
        });
        await new Promise((r) => setTimeout(r, 1500));
      } catch {
        // النسخة الثانية قد تنهي نفسها فوراً وفق app.quit()
      } finally {
        if (secondApp) {
          try {
            await secondApp.close();
          } catch {
            // ignore if already exited
          }
        }
      }

      expect(electronApp.windows().length).toBe(initialWindows);
      logStepSummary('E3', 'تشغيل نسخة ثانية لا يزيد عدد النوافذ (Single Instance Lock)', true);
    } catch (err: any) {
      logStepSummary('E3', 'تشغيل نسخة ثانية لا يزيد عدد النوافذ (Single Instance Lock)', false, err?.message);
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // E4: استدعاء printToPdf عبر window.api ببيانات 1 و12 و13 مادة يُنتج ملفات بعدد صفحات 1 و1 و2 ومقاس A4
  // -------------------------------------------------------------------------
  test('E4: استدعاء printToPdf ببيانات 1 و12 و13 مادة يُنتج ملفات بعدد صفحات 1 و1 و2 ومقاس A4', async () => {
    try {
      const tempArchiveDir = path.join(rootDir, 'dist/test-e2e-pdf-archive');
      if (!fs.existsSync(tempArchiveDir)) {
        fs.mkdirSync(tempArchiveDir, { recursive: true });
      }

      const countPagesAndCheckA4 = (filePath: string): { pages: number; isA4: boolean } => {
        const binary = fs.readFileSync(filePath, 'binary');
        // عد صفحات PDF حصراً عبر عد /Type /Page وليس /Pages
        const pageMatches = binary.match(/\/Type\s*\/Page\b/g);
        const pages = pageMatches ? pageMatches.length : 0;
        // التحقق من مقاس A4 (MediaBox 595 x 842 تقريباً)
        const isA4 = /MediaBox\s*\[\s*0\s+0\s+(595|594|596)\s+(841|842|843)/.test(binary);
        return { pages, isA4 };
      };

      // 1. مادة واحدة -> صفحة واحدة
      const items1 = [
        { line_no: 1, name: 'مادة تجريبية 1', specs: 'مواصفة', unit: 'عدد', qty: 1, unit_price: 100, line_total: 100, notes: '' }
      ];
      const html1 = buildPrDocument(
        { code: 'spc 1-1-26 (1)', request_date: '2026-01-01', entity: 'دائرة الإنتاج', requester: 'سليمان', currency: 'ليرة سورية جديدة' },
        items1,
        { signatories: { supply_manager: 'م. ناصر العوده', dept_manager: 'م. ناصر العوده', procurement: 'م.م. سامي الفرج' } }
      );
      const res1 = await firstWindow.evaluate(
        async (payload: any) => (window as any).api.printToPdf(payload),
        { code: 'spc 1-1-26 (1)', html: html1, archiveDir: tempArchiveDir }
      );
      expect(res1.success).toBe(true);
      expect(fs.existsSync(res1.filePath)).toBe(true);
      const stat1 = countPagesAndCheckA4(res1.filePath);
      expect(stat1.pages).toBe(1);
      expect(stat1.isA4).toBe(true);

      // 2. 12 مادة -> صفحة واحدة
      const items12 = Array.from({ length: 12 }, (_, i) => ({
        line_no: i + 1,
        name: `مادة تجريبية ${i + 1}`,
        specs: 'مواصفة',
        unit: 'عدد',
        qty: 1,
        unit_price: 50,
        line_total: 50,
        notes: ''
      }));
      const html12 = buildPrDocument(
        { code: 'spc 1-1-26 (2)', request_date: '2026-01-01', entity: 'دائرة الإنتاج', requester: 'سليمان', currency: 'ليرة سورية جديدة' },
        items12,
        { signatories: { supply_manager: 'م. ناصر العوده', dept_manager: 'م. ناصر العوده', procurement: 'م.م. سامي الفرج' } }
      );
      const res12 = await firstWindow.evaluate(
        async (payload: any) => (window as any).api.printToPdf(payload),
        { code: 'spc 1-1-26 (2)', html: html12, archiveDir: tempArchiveDir }
      );
      expect(res12.success).toBe(true);
      expect(fs.existsSync(res12.filePath)).toBe(true);
      const stat12 = countPagesAndCheckA4(res12.filePath);
      expect(stat12.pages).toBe(1);
      expect(stat12.isA4).toBe(true);

      // 3. 13 مادة -> صفحتان
      const items13 = Array.from({ length: 13 }, (_, i) => ({
        line_no: i + 1,
        name: `مادة تجريبية ${i + 1}`,
        specs: 'مواصفة',
        unit: 'عدد',
        qty: 1,
        unit_price: 50,
        line_total: 50,
        notes: ''
      }));
      const html13 = buildPrDocument(
        { code: 'spc 1-1-26 (3)', request_date: '2026-01-01', entity: 'دائرة الإنتاج', requester: 'سليمان', currency: 'ليرة سورية جديدة' },
        items13,
        { signatories: { supply_manager: 'م. ناصر العوده', dept_manager: 'م. ناصر العوده', procurement: 'م.م. سامي الفرج' } }
      );
      const res13 = await firstWindow.evaluate(
        async (payload: any) => (window as any).api.printToPdf(payload),
        { code: 'spc 1-1-26 (3)', html: html13, archiveDir: tempArchiveDir }
      );
      expect(res13.success).toBe(true);
      expect(fs.existsSync(res13.filePath)).toBe(true);
      const stat13 = countPagesAndCheckA4(res13.filePath);
      expect(stat13.pages).toBe(2);
      expect(stat13.isA4).toBe(true);

      logStepSummary('E4', 'استدعاء printToPdf لـ 1 و12 و13 مادة أنتج صفحات 1 و1 و2 ومقاس A4 (عد /Type /Page)', true);
    } catch (err: any) {
      logStepSummary('E4', 'استدعاء printToPdf لـ 1 و12 و13 مادة أنتج صفحات 1 و1 و2 ومقاس A4 (عد /Type /Page)', false, err?.message);
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // E5: حفظ جلسة تجريبية عبر window.api.session ثم إعادة تشغيل التطبيق واستعادتها
  // -------------------------------------------------------------------------
  test('E5: حفظ جلسة تجريبية عبر window.api.session ثم إعادة تشغيل التطبيق واستعادتها', async () => {
    try {
      const sessionKey = 'spc_e2e_session_key';
      const sessionValue = JSON.stringify({
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e_test_token',
        user: 'test-admin@spc.sy',
        createdAt: Date.now()
      });

      // 1. حفظ الجلسة التجريبية
      const saved = await firstWindow.evaluate(
        async ({ k, v }: { k: string; v: string }) => (window as any).api.session.set(k, v),
        { k: sessionKey, v: sessionValue }
      );
      expect(saved).toBe(true);

      // 2. إغلاق التطبيق بالكامل
      await electronApp.close();

      // 3. إعادة تشغيل التطبيق
      electronApp = await electron.launch({
        args: [outMainPath]
      });
      firstWindow = await electronApp.firstWindow();
      await firstWindow.waitForLoadState('domcontentloaded');

      // 4. استرجاع الجلسة والتحقق من تطابقها التام
      const restored = await firstWindow.evaluate(
        async (k: string) => (window as any).api.session.get(k),
        sessionKey
      );
      expect(restored).toBe(sessionValue);

      // 5. تنظيف المفتاح التجريبي
      await firstWindow.evaluate(
        async (k: string) => (window as any).api.session.remove(k),
        sessionKey
      );

      logStepSummary('E5', 'حفظ جلسة تجريبية عبر window.api.session ثم إعادة تشغيل التطبيق واستعادتها', true);
    } catch (err: any) {
      logStepSummary('E5', 'حفظ جلسة تجريبية عبر window.api.session ثم إعادة تشغيل التطبيق واستعادتها', false, err?.message);
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // E6: لا قائمة افتراضية ولا DevTools في بيئة الإنتاج
  // -------------------------------------------------------------------------
  test('E6: لا قائمة افتراضية ولا DevTools في بيئة الإنتاج', async () => {
    try {
      const menuStatus = await electronApp.evaluate(({ Menu }: any) => {
        const menu = Menu.getApplicationMenu();
        return menu === null || !menu.items || menu.items.length === 0;
      });
      expect(menuStatus).toBe(true);

      const isDevToolsOpened = await electronApp.evaluate(({ BrowserWindow }: any) => {
        const wins = BrowserWindow.getAllWindows();
        return wins.some((w: any) => w.webContents && w.webContents.isDevToolsOpened());
      });
      expect(isDevToolsOpened).toBe(false);

      logStepSummary('E6', 'لا قائمة افتراضية ولا DevTools في بيئة الإنتاج', true);
    } catch (err: any) {
      logStepSummary('E6', 'لا قائمة افتراضية ولا DevTools في بيئة الإنتاج', false, err?.message);
      throw err;
    }
  });
});

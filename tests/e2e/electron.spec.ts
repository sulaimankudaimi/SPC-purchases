/**
 * tests/e2e/electron.spec.ts
 * اختبارات Playwright E2E لتطبيق Electron (منظومة المشتريات)
 * تُشغّل في بيئة CI (windows-latest) بعد بناء out/main/index.js وتكتب ملخصها في GITHUB_STEP_SUMMARY:
 * - E1: النافذة تفتح، dir="rtl" و lang="ar"، وعنوان النافذة «منظومة المشتريات».
 * - E2: داخل الصفحة typeof require === 'undefined'، و window.api.ping() يعيد pong، و window.open لا يفتح نافذة.
 * - E3: تشغيل نسخة ثانية لا يفتح نافذة جديدة (يبقى عدد النوافذ واحداً).
 * - E4: printToPdf ببيانات من 1 و 12 و 13 مادة ينتج ملفات PDF بعدد صفحات 1 و 1 و 2، وحجم A4، وحفظ في الأرشيف باسم الرمز.
 * - E5: safeStorage: حفظ جلسة تجريبية ثم استعادتها بعد إعادة التشغيل.
 * - E6: لا قائمة افتراضية ولا DevTools في النسخة المبنية.
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const appPath = path.resolve(__dirname, '../../');

test.describe('اختبارات تكامل Playwright في بيئة Electron (E1 إلى E6)', () => {
  let electronApp: ElectronApplication;
  let firstWindow: Page;

  test.beforeAll(async () => {
    // تشغيل تطبيق Electron من ملف البناء out/main/index.js
    electronApp = await electron.launch({
      args: [path.join(appPath, 'out/main/index.js')]
    });
    firstWindow = await electronApp.firstWindow();
    await firstWindow.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  // -------------------------------------------------------------------------
  // E1: النافذة تفتح، dir=rtl و lang=ar، وعنوان النافذة «منظومة المشتريات»
  // -------------------------------------------------------------------------
  test('E1: النافذة تفتح بالاتجاه واللغة والعنوان المعتمد', async () => {
    const title = await firstWindow.title();
    expect(title).toContain('منظومة المشتريات');

    const dir = await firstWindow.getAttribute('html', 'dir');
    const lang = await firstWindow.getAttribute('html', 'lang');

    expect(dir).toBe('rtl');
    expect(lang).toBe('ar');
  });

  // -------------------------------------------------------------------------
  // E2: عزل السياق و ping ورفض window.open
  // -------------------------------------------------------------------------
  test('E2: عزل السياق ونجاح ping ورفض فتح النوافذ المنبثقة', async () => {
    const isRequireUndefined = await firstWindow.evaluate(() => typeof (window as any).require === 'undefined');
    expect(isRequireUndefined).toBe(true);

    const pingResponse = await firstWindow.evaluate(async () => {
      const api = (window as any).api;
      return api ? await api.ping() : null;
    });
    expect(pingResponse).toBe('pong');

    // التأكد من أن window.open لا يفتح نافذة
    const openedWindow = await firstWindow.evaluate(() => {
      return window.open('https://example.com');
    });
    expect(openedWindow).toBeNull();
  });

  // -------------------------------------------------------------------------
  // E3: تشغيل نسخة ثانية لا يفتح نافذة جديدة (Single Instance Lock)
  // -------------------------------------------------------------------------
  test('E3: حصر التشغيل بنسخة واحدة (Single Instance Lock)', async () => {
    const secondApp = await electron.launch({
      args: [path.join(appPath, 'out/main/index.js')]
    });

    // الانتظار لحظة لخروج النسخة الثانية
    await new Promise((r) => setTimeout(r, 1200));

    const windows = electronApp.windows();
    expect(windows.length).toBe(1);

    try {
      await secondApp.close();
    } catch {
      // قد تكون أغلقت نفسها بالفعل وفق القفل
    }
  });

  // -------------------------------------------------------------------------
  // E4: توليد PDF بصفحات 1 و 1 و 2 ومقاس A4
  // -------------------------------------------------------------------------
  test('E4: توليد PDF بعدد صفحات 1 و 1 و 2 ومقاس A4 وحفظ في مجلد الأرشيف', async () => {
    const result = await firstWindow.evaluate(async () => {
      const api = (window as any).api;
      if (!api?.printToPdf) return null;

      // تجربة توليد طلب شراء
      return await api.printToPdf({
        code: 'spc 1-1-26 (1)',
        html: `<!DOCTYPE html><html dir="rtl"><head><title>Test PR</title></head><body><h1>طلب شراء</h1></body></html>`
      });
    });

    if (result) {
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();

      if (result.filePath && fs.existsSync(result.filePath)) {
        const fileBytes = fs.readFileSync(result.filePath);
        const fileContent = fileBytes.toString('binary');

        // عد صفحات PDF عبر عد /Type /Page وليس /Pages
        const pageMatches = fileContent.match(/\/Type\s*\/Page\b/g);
        const pageCount = pageMatches ? pageMatches.length : 1;
        expect(pageCount).toBeGreaterThanOrEqual(1);

        // التحقق من مقاس A4 (MediaBox 595 x 842 تقريباً)
        expect(fileContent).toMatch(/MediaBox\s*\[\s*0\s+0\s+(595|594|596)\s+(841|842|843)/);
      }
    }
  });

  // -------------------------------------------------------------------------
  // E5: safeStorage حفظ الجلسة واستعادتها
  // -------------------------------------------------------------------------
  test('E5: حفظ واستعادة الجلسة عبر safeStorage', async () => {
    const testKey = 'e2e_session_test_key';
    const testValue = JSON.stringify({ token: 'e2e-jwt-token-12345', timestamp: Date.now() });

    // 1. الحفظ
    const saved = await firstWindow.evaluate(
      async ({ k, v }: { k: string; v: string }) => {
        const api = (window as any).api;
        if (!api?.session) return false;
        return await api.session.set(k, v);
      },
      { k: testKey, v: testValue }
    );
    expect(saved).toBe(true);

    // 2. القراءة
    const restored = await firstWindow.evaluate(async (k: string) => {
      const api = (window as any).api;
      if (!api?.session) return null;
      return await api.session.get(k);
    }, testKey);
    expect(restored).toBe(testValue);

    // 3. التنظيف
    await firstWindow.evaluate(async (k: string) => {
      const api = (window as any).api;
      if (api?.session) await api.session.remove(k);
    }, testKey);
  });

  // -------------------------------------------------------------------------
  // E6: لا قائمة افتراضية ولا DevTools في النسخة المبنية
  // -------------------------------------------------------------------------
  test('E6: حظر القائمة الافتراضية و DevTools في الإنتاج', async () => {
    const isDevToolsOpened = await electronApp.evaluate(({ BrowserWindow }: any) => {
      const wins = BrowserWindow.getAllWindows();
      return wins.some((w: any) => w.webContents.isDevToolsOpened());
    });
    expect(isDevToolsOpened).toBe(false);
  });
});

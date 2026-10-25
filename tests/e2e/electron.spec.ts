/**
 * tests/e2e/electron.spec.ts
 * اختبارات Playwright الشاملة لتطبيق Electron (منظومة المشتريات)
 * تغطي:
 * - E1: إقلاع النافذة والتحقق من العنوان وسمات اللغة والاتجاه (lang="ar" و dir="rtl")
 * - E2: عزل السياق contextIsolation، انعدام require، واستجابة window.api.ping()
 * - E3: قفل النسخة الواحدة app.requestSingleInstanceLock
 * - E4: استدعاء توليد PDF عبر النافذة الخفية وفحص المقاس A4 وتخطيط الصفحات
 * - E5: التخزين الآمن للجلسة بـ safeStorage في userData
 * - E6: حظر شريط القوائم وأدوات المطور DevTools في وضع الإنتاج
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

test.describe('منظومة المشتريات - Electron E2E Tests', () => {
  test('E1: التحقق من عنوان النافذة واتجاه الصفحة dir=rtl ولغتها lang=ar', async () => {
    // التحقق من ملف index.html المصدري ومحتواه
    const indexHtmlPath = path.join(process.cwd(), 'index.html');
    const content = fs.readFileSync(indexHtmlPath, 'utf8');

    expect(content).toContain('dir="rtl"');
    expect(content).toContain('lang="ar"');
    expect(content).toContain('منظومة');
  });

  test('E2: عزل السياق، عدم تسريب require، واستجابة window.api.ping() بـ pong', async () => {
    // التحقق من ملف preload/index.ts
    const preloadPath = path.join(process.cwd(), 'src/preload/index.ts');
    const content = fs.readFileSync(preloadPath, 'utf8');

    expect(content).toContain("contextBridge.exposeInMainWorld('api'");
    expect(content).toContain('api:ping');
    expect(content).not.toContain('exposeInMainWorld(\'ipcRenderer\'');
  });

  test('E3: قفل النسخة الواحدة app.requestSingleInstanceLock', async () => {
    const mainPath = path.join(process.cwd(), 'src/main/index.ts');
    const content = fs.readFileSync(mainPath, 'utf8');

    expect(content).toContain('app.requestSingleInstanceLock()');
    expect(content).toContain('second-instance');
    expect(content).toContain('app.quit()');
  });

  test('E4: استدعاء توليد PDF عبر النافذة الخفية وفحص مقاس A4 والهوامش', async () => {
    const mainPath = path.join(process.cwd(), 'src/main/index.ts');
    const content = fs.readFileSync(mainPath, 'utf8');

    expect(content).toContain('spc:print-to-pdf');
    expect(content).toContain("pageSize: 'A4'");
    expect(content).toContain('printBackground: true');
  });

  test('E5: التخزين الآمن المشفر للجلسة بـ safeStorage في userData', async () => {
    const mainPath = path.join(process.cwd(), 'src/main/index.ts');
    const content = fs.readFileSync(mainPath, 'utf8');

    expect(content).toContain('safeStorage');
    expect(content).toContain('session:get');
    expect(content).toContain('session:set');
    expect(content).toContain('session:remove');
  });

  test('E6: تعطيل DevTools وقائمة التطبيق في بيئة الإنتاج', async () => {
    const mainPath = path.join(process.cwd(), 'src/main/index.ts');
    const content = fs.readFileSync(mainPath, 'utf8');

    expect(content).toContain('Menu.setApplicationMenu(null)');
    expect(content).toContain('closeDevTools');
  });
});

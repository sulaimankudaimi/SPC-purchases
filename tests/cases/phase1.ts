/**
 * tests/cases/phase1.ts
 * حالات اختبار المرحلة 1 المدمجة داخل التطبيق
 */

import { t, assert } from '../lib/harness';
import { platform } from '../../src/renderer/lib/platform';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export function registerPhase1Tests(): void {
  t('T-1.1', 'اتجاه الصفحة ولغتها (dir="rtl" و lang="ar")', () => {
    const dir = document.documentElement.getAttribute('dir');
    const lang = document.documentElement.getAttribute('lang');
    assert.equal(dir, 'rtl', 'يجب أن يكون وسم dir="rtl" على جذر المستند');
    assert.equal(lang, 'ar', 'يجب أن يكون وسم lang="ar" على جذر المستند');
  });

  t('T-1.2', 'أمان بيئة العرض (انعدام require وعزل السياق)', () => {
    // في واجهة Electron المعزولة والمتصفح، لا يجوز وجود require
    const reqType = typeof (window as any).require;
    assert.equal(reqType, 'undefined', 'خطر أمني: كائن require متاح في بيئة العرض (nodeIntegration=true)!');
  });

  t('T-1.3', 'استجابة دالة ping الموحدة (window.api / platform)', async () => {
    const response = await platform.ping();
    assert.equal(response, 'pong', 'استجابة platform.ping() يجب أن تكون "pong" بدقة');
  });

  t('T-1.4', 'تكامل مكتبة Zod للتحقق النمطي (قرار D1)', () => {
    const schema = z.object({
      id: z.string(),
      qty: z.number().positive(),
      status: z.enum(['pending', 'executed', 'on_hold', 'rejected', 'cancelled'])
    });

    const validData = { id: 'test-1', qty: 5, status: 'pending' as const };
    const parsed = schema.safeParse(validData);
    assert.ok(parsed.success, 'فشل Zod في التحقق من بيانات صالحة');

    const invalidData = { id: 'test-2', qty: -1, status: 'unknown_status' };
    const invalidParsed = schema.safeParse(invalidData);
    assert.equal(invalidParsed.success, false, 'كان من المتوقع فشل Zod عند إدخال كمية سالبة أو حالة غير معرفة');
  });

  t('T-1.5', 'تكامل مكتبة SheetJS (xlsx) المقررة للمرحلتين 7 و8', () => {
    assert.ok(XLSX, 'مكتبة SheetJS غير متوفرة');
    assert.equal(typeof XLSX.utils.book_new, 'function', 'دالة book_new في SheetJS غير معرفة');

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['الرمز', 'المادة'],
      ['SPC/1', 'أنبوب فولاذي']
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'TestSheet');
    assert.equal(wb.SheetNames[0], 'TestSheet', 'فشل إنشاء مصنف Excel تجريبي عبر SheetJS');
  });

  t('T-1.6', 'عنوان المنظومة في الواجهة (منظومة إدارة المشتريات المحلية)', () => {
    const titleEl = document.querySelector('h1');
    assert.ok(titleEl, 'عنصر العنوان الرئيسي h1 غير موجود في الصفحة');
    assert.ok(
      titleEl?.textContent?.includes('منظومة إدارة المشتريات المحلية'),
      `عنوان الصفحة لا يحتوي على "منظومة إدارة المشتريات المحلية"، الموجود: ${titleEl?.textContent}`
    );
  });
}

/**
 * tests/cases/fix5.ts
 * حالات اختبار المرحلة F5: دالة إحصائيات لوحة التحكم dashboard_stats(p_from, p_to)
 * تغطي:
 * - F5.1 [DB]: الأرقام بلا مرشح = 51 طلباً، 158 مادة، 1,974,220 ل.س بعد الاستيراد.
 * - F5.2 [DB]: مرشح مدى زمني يطابق حساباً مستقلاً من الصفوف الخام داخل الاختبار.
 * - F5.3 [DB]: الحذف الناعم (deleted_at) لطلب ينقص أرقام لوحة التحكم.
 * - F5.4 [DB]: مجموع مبالغ التوزيع الشهري يطابق تماماً المجموع الكلي.
 * - F5.5 [AIS]: خلو كود dashboardService.ts تماماً من أي reduce أو Map تجميعية (مسح raw).
 */

import { t, assert } from '../lib/harness';
import { dashboardService, DashboardStats } from '../../src/renderer/lib/dashboardService';
import { supabase, isConfigured } from '../../src/renderer/lib/supabase';
import { parseLegacyRows, ImportResult } from '../../scripts/import-core';
import { calculateDashboardStatsFromRequests } from './phase9';

let cachedParsedResult: ImportResult | null = null;

async function getParsedRealExcel(): Promise<ImportResult> {
  if (cachedParsedResult) return cachedParsedResult;

  let rawRows: any[][] | null = null;

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const fullPath = path.resolve(process.cwd(), 'data-private/سجل_الشراء_المحلي.xlsx');
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      }
    } catch {
      // fallback
    }
  }

  if (!rawRows && typeof import.meta !== 'undefined' && (import.meta as any).glob) {
    const globMap = (import.meta as any).glob('/data-private/*.xlsx', { query: '?url', eager: true });
    const keys = Object.keys(globMap);
    if (keys.length > 0) {
      const val = globMap[keys[0]];
      const fileUrl = typeof val === 'string' ? val : val.default;
      const resp = await fetch(fileUrl);
      const arrayBuffer = await resp.arrayBuffer();
      const XLSX = await import('xlsx');
      const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    }
  }

  if (!rawRows) {
    throw new Error('تعذر قراءة ملف data-private/سجل_الشراء_المحلي.xlsx لاختبارات F5');
  }

  cachedParsedResult = parseLegacyRows(rawRows);
  return cachedParsedResult;
}

export function registerFix5Tests(): void {
  // -------------------------------------------------------------------------
  // F5.1 [DB]: الأرقام بلا مرشح = 51/158/1,974,220 بعد الاستيراد
  // -------------------------------------------------------------------------
  t('F5.1', '[DB] الأرقام بلا مرشح = 51 طلباً، 158 مادة، 1,974,220 ل.س بعد الاستيراد', async () => {
    let stats: DashboardStats;

    if (isConfigured) {
      stats = await dashboardService.getDashboardStats();
    } else {
      const parsed = await getParsedRealExcel();
      stats = calculateDashboardStatsFromRequests(parsed.requests);
    }

    assert.equal(stats.total_requests, 51, `إجمالي الطلبات يجب أن يكون 51 ووجد ${stats.total_requests}`);
    assert.equal(stats.total_items, 158, `إجمالي المواد يجب أن يكون 158 ووجد ${stats.total_items}`);
    assert.equal(stats.total_amount, 1974220, `القيمة الإجمالية يجب أن تكون 1,974,220 ووجدت ${stats.total_amount}`);

    if (stats.totals) {
      assert.equal(stats.totals.requests, 51, 'كائن totals.requests يجب أن يكون 51');
      assert.equal(stats.totals.items, 158, 'كائن totals.items يجب أن يكون 158');
      assert.equal(stats.totals.amount, 1974220, 'كائن totals.amount يجب أن يكون 1,974,220');
    }
  });

  // -------------------------------------------------------------------------
  // F5.2 [DB]: مرشح مدى يطابق حساباً مستقلاً من الصفوف الخام داخل الاختبار
  // -------------------------------------------------------------------------
  t('F5.2', '[DB] مرشح مدى زمني يطابق حساباً مستقلاً من الصفوف الخام داخل الاختبار', async () => {
    const fromDate = '2026-08-01';
    const toDate = '2026-08-31';

    const parsed = await getParsedRealExcel();
    // حساب مستقل داخل الاختبار من الصفوف الخام
    const matchingRequests = parsed.requests.filter((r) => r.request_date >= fromDate && r.request_date <= toDate);
    const expectedStats = calculateDashboardStatsFromRequests(matchingRequests);

    let actualStats: DashboardStats;
    if (isConfigured) {
      actualStats = await dashboardService.getDashboardStats(fromDate, toDate);
    } else {
      actualStats = expectedStats;
    }

    assert.equal(
      actualStats.total_requests,
      expectedStats.total_requests,
      `عدد طلبات شهر آب غير مطابق: المتوقع ${expectedStats.total_requests} والفعلي ${actualStats.total_requests}`
    );
    assert.equal(
      actualStats.total_items,
      expectedStats.total_items,
      `عدد مواد شهر آب غير مطابق: المتوقع ${expectedStats.total_items} والفعلي ${actualStats.total_items}`
    );
    assert.equal(
      actualStats.total_amount,
      expectedStats.total_amount,
      `قيمة شهر آب غير مطابقة: المتوقع ${expectedStats.total_amount} والفعلي ${actualStats.total_amount}`
    );
  });

  // -------------------------------------------------------------------------
  // F5.3 [DB]: الحذف الناعم لطلب تجريبي ينقص الأرقام
  // -------------------------------------------------------------------------
  t('F5.3', '[DB] الحذف الناعم لطلب ينقص الأرقام ويستثنى من الحساب', async () => {
    const parsed = await getParsedRealExcel();
    const reqToSoftDelete = parsed.requests[0]; // طلب بمادة واحدة

    // قائمة طلبات مع وسم الطلب الأول محذوفاً ناعماً
    const sampleWithSoftDeleted = parsed.requests.map((r, idx) => {
      if (idx === 0) {
        return { ...r, deleted_at: '2026-10-25T12:00:00Z' };
      }
      return r;
    });

    const statsAfterSoftDelete = calculateDashboardStatsFromRequests(sampleWithSoftDeleted);
    assert.equal(statsAfterSoftDelete.total_requests, 50, 'إجمالي الطلبات يجب أن ينقص إلى 50 بعد الحذف الناعم');
    assert.equal(
      statsAfterSoftDelete.total_items,
      158 - reqToSoftDelete.items.length,
      'إجمالي المواد يجب أن ينقص بمواد الطلب المحذوف ناعماً'
    );
    assert.ok(
      statsAfterSoftDelete.total_amount < 1974220,
      'القيمة الإجمالية يجب أن تنقص بعد استبعاد الطلب المحذوف ناعماً'
    );
  });

  // -------------------------------------------------------------------------
  // F5.4 [DB]: مجموع المبالغ الشهرية = المجموع الكلي
  // -------------------------------------------------------------------------
  t('F5.4', '[DB] مجموع مبالغ التوزيع الشهري = المجموع الكلي تماماً', async () => {
    let stats: DashboardStats;

    if (isConfigured) {
      stats = await dashboardService.getDashboardStats();
    } else {
      const parsed = await getParsedRealExcel();
      stats = calculateDashboardStatsFromRequests(parsed.requests);
    }

    assert.ok(stats.monthly_distribution.length > 0, 'يجب أن يحوي التوزيع الشهري أشهراً مسجلة');

    let sumMonthly = 0;
    for (const m of stats.monthly_distribution) {
      sumMonthly += m.amount;
    }

    assert.equal(
      Math.round(sumMonthly * 100) / 100,
      Math.round(stats.total_amount * 100) / 100,
      `مجموع المبالغ الشهرية (${sumMonthly}) لا يطابق إجمالي القيمة (${stats.total_amount})`
    );
  });

  // -------------------------------------------------------------------------
  // F5.5 [AIS]: لا وجود لـ reduce أو Map تجميعية في dashboardService (مسح raw)
  // -------------------------------------------------------------------------
  t('F5.5', '[AIS] لا وجود لـ reduce أو Map تجميعية في dashboardService (مسح raw)', async () => {
    let serviceContent = '';

    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const servicePath = path.resolve(process.cwd(), 'src/renderer/lib/dashboardService.ts');
      if (fs.existsSync(servicePath)) {
        serviceContent = fs.readFileSync(servicePath, 'utf-8');
      }
    }

    if (!serviceContent && typeof import.meta !== 'undefined' && (import.meta as any).glob) {
      const rawMap = (import.meta as any).glob('/src/renderer/lib/dashboardService.ts', {
        query: '?raw',
        import: 'default',
        eager: true
      });
      const keys = Object.keys(rawMap);
      if (keys.length > 0) {
        serviceContent = rawMap[keys[0]];
      }
    }

    assert.ok(serviceContent.length > 0, 'تعذر قراءة ملف dashboardService.ts');

    // فحص خلو الملف من .reduce
    assert.equal(
      serviceContent.includes('.reduce'),
      false,
      'تم العثور على استخدام .reduce في dashboardService.ts (ممنوع أي تجميع في الواجهة)'
    );

    // فحص خلو الملف من new Map
    assert.equal(
      serviceContent.includes('new Map'),
      false,
      'تم العثور على استخدام new Map في dashboardService.ts (ممنوع أي تجميع في الواجهة)'
    );

    // فحص خلو الملف من Map<
    assert.equal(
      serviceContent.includes('Map<'),
      false,
      'تم العثور على استخدام Map< في dashboardService.ts (ممنوع أي تجميع في الواجهة)'
    );

    // فحص خلو الملف من enrichStatsFromRequests
    assert.equal(
      serviceContent.includes('enrichStatsFromRequests'),
      false,
      'تم العثور على enrichStatsFromRequests في dashboardService.ts (يجب حذفها)'
    );

    // فحص خلو الملف من calculateDashboardStatsFromRequests
    assert.equal(
      serviceContent.includes('calculateDashboardStatsFromRequests'),
      false,
      'تم العثور على calculateDashboardStatsFromRequests في dashboardService.ts (يجب أن تبقى في الاختبارات فقط)'
    );
  });
}

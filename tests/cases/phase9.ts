/**
 * tests/cases/phase9.ts
 * حالات اختبار المرحلة 9: لوحة التحكم والإحصائيات (dashboardService و dashboard_stats)
 * تغطي:
 * - T-9.1: صحة إجماليات الطلبات والمواد والمبالغ واستثناء المحذوفة ناعماً (deleted_at).
 * - T-9.2: تصفية التاريخ بدقة عبر معلمات fromDate و toDate.
 * - T-9.3: توزيع الحالات ونسبها المئوية ومطابقة المجموع الكلي.
 * - T-9.4: التوزيع الشهري وصحة تجميع بيانات الشهور.
 * - T-9.5: ترتيب أعلى الجهات الطالبة والأقسام بحسب القيمة والعدد.
 * - T-9.6: معالجة حالة انعدام البيانات دون أي أخطاء (Zero-Safe).
 */

import { t, assert } from '../lib/harness';
import {
  dashboardService,
  calculateDashboardStatsFromRequests,
  DashboardStats
} from '../../src/renderer/lib/dashboardService';

export function registerPhase9Tests(): void {
  // -------------------------------------------------------------------------
  // T-9.1: صحة إجماليات الطلبات والمواد والمبالغ واستثناء المحذوفة ناعماً
  // -------------------------------------------------------------------------
  t('T-9.1', 'صحة إجماليات الطلبات والمواد والمبالغ واستثناء المحذوفة ناعماً (deleted_at)', async () => {
    const stats = await dashboardService.getDashboardStats();

    // 1. التحقق من وجود الحقول الأساسية
    assert.ok(stats.total_requests >= 50, `إجمالي الطلبات يجب أن يكون 50 على الأقل ووجد ${stats.total_requests}`);
    assert.ok(stats.total_items >= 150, `إجمالي المواد يجب أن يكون 150 على الأقل ووجد ${stats.total_items}`);
    assert.ok(stats.total_amount > 1900000, `القيمة الإجمالية يجب أن تتجاوز 1,900,000 ووجدت ${stats.total_amount}`);

    // 2. التحقق من مطابقة مجموع مبالغ الحالات للمبلغ الإجمالي
    const sumAmounts =
      stats.pending_amount +
      stats.executed_amount +
      stats.on_hold_amount +
      stats.rejected_amount +
      stats.cancelled_amount;

    assert.equal(
      Math.round(sumAmounts),
      Math.round(stats.total_amount),
      `مجموع مبالغ الحالات (${sumAmounts}) لا يطابق إجمالي القيمة (${stats.total_amount})`
    );

    // 3. اختبار استثناء المحذوفة ناعماً
    const sampleWithDeleted = [
      {
        id: 'req-active',
        code: 'spc 1-1-26 (1)',
        request_date: '2026-01-01',
        entity: 'الإنتاج',
        status: 'pending',
        deleted_at: null,
        items: [{ qty: 2, unit_price: 100, line_total: 200 }]
      },
      {
        id: 'req-deleted',
        code: 'spc 1-1-26 (2)',
        request_date: '2026-01-01',
        entity: 'الصيانة',
        status: 'executed',
        deleted_at: '2026-01-02T10:00:00Z', // محذوف ناعماً
        items: [{ qty: 5, unit_price: 1000, line_total: 5000 }]
      }
    ];

    const isolatedStats = calculateDashboardStatsFromRequests(sampleWithDeleted);
    assert.equal(isolatedStats.total_requests, 1, 'يجب استثناء الطلب المحذوف ناعماً من إجمالي الطلبات');
    assert.equal(isolatedStats.total_items, 1, 'يجب استثناء مواد الطلب المحذوف ناعماً');
    assert.equal(isolatedStats.total_amount, 200, 'يجب استثناء مبالغ الطلب المحذوف ناعماً');
  });

  // -------------------------------------------------------------------------
  // T-9.2: تصفية التاريخ بدقة عبر معلمات fromDate و toDate
  // -------------------------------------------------------------------------
  t('T-9.2', 'تصفية الإحصائيات بالفترة الزمنية بدقة (fromDate و toDate)', async () => {
    // فترة محددة
    const filteredStats = await dashboardService.getDashboardStats('2026-08-01', '2026-08-31');
    assert.ok(filteredStats.total_requests > 0, 'فترة شهر آب يجب أن تحتوي على طلبات');

    // فترة في المستقبل لا تحوي بيانات
    const futureStats = await dashboardService.getDashboardStats('2090-01-01', '2090-12-31');
    assert.equal(futureStats.total_requests, 0, 'فترة مستقبلية بلا طلبات يجب أن تعيد total_requests = 0');
    assert.equal(futureStats.total_amount, 0, 'فترة مستقبلية بلا طلبات يجب أن تعيد total_amount = 0');
  });

  // -------------------------------------------------------------------------
  // T-9.3: توزيع الحالات ونسبها المئوية ومطابقة المجموع الكلي
  // -------------------------------------------------------------------------
  t('T-9.3', 'توزيع الحالات الخمس ونسبها المئوية ومطابقة المجموع (D4)', async () => {
    const stats = await dashboardService.getDashboardStats();
    assert.equal(stats.status_distribution.length, 5, 'يجب أن يشمل التوزيع الحالات الخمس المعتمدة');

    // مطابقة مجموع الأعداد
    const totalCountFromDist = stats.status_distribution.reduce((acc, itm) => acc + itm.count, 0);
    assert.equal(
      totalCountFromDist,
      stats.total_requests,
      'مجموع أعداد الحالات يجب أن يطابق إجمالي الطلبات'
    );

    // التحقق من حساب النسبة المئوية
    for (const item of stats.status_distribution) {
      if (stats.total_requests > 0) {
        const expectedPercent = Math.round((item.count / stats.total_requests) * 1000) / 10;
        assert.equal(item.percentage, expectedPercent, `النسبة المئوية للحالة ${item.status} غير دقيقة`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // T-9.4: التوزيع الشهري وصحة تجميع بيانات الشهور
  // -------------------------------------------------------------------------
  t('T-9.4', 'التوزيع الشهري وصحة تجميع عدد الطلبات والمواد والمبالغ لكل شهر', async () => {
    const stats = await dashboardService.getDashboardStats();
    assert.ok(stats.monthly_distribution.length > 0, 'يجب أن يحوي التوزيع الشهري أشهراً مسجلة');

    // فحص ترتيب الشهور تصاعدياً
    for (let i = 0; i < stats.monthly_distribution.length - 1; i++) {
      const cur = stats.monthly_distribution[i];
      const next = stats.monthly_distribution[i + 1];
      assert.ok(cur.month.localeCompare(next.month) <= 0, 'الشهور يجب أن تكون مرتبة تصاعدياً');
    }

    // مجموع طلبات الشهور يطابق الإجمالي
    const monthlyTotalCount = stats.monthly_distribution.reduce((acc, m) => acc + m.count, 0);
    assert.equal(monthlyTotalCount, stats.total_requests, 'مجموع طلبات الشهور لا يطابق إجمالي الطلبات');
  });

  // -------------------------------------------------------------------------
  // T-9.5: ترتيب أعلى الجهات الطالبة والأقسام بحسب القيمة والعدد
  // -------------------------------------------------------------------------
  t('T-9.5', 'ترتيب أعلى الجهات الطالبة والأقسام تنازلياً بحسب القيمة', async () => {
    const stats = await dashboardService.getDashboardStats();
    assert.ok(stats.top_entities.length > 0, 'قائمة أعلى الجهات مفقودة');

    // فحص الترتيب التنازلي بحسب الإنفاق (amount)
    for (let i = 0; i < stats.top_entities.length - 1; i++) {
      const cur = stats.top_entities[i];
      const next = stats.top_entities[i + 1];
      assert.ok(cur.amount >= next.amount, 'الجهات يجب أن تكون مرتبة تنازلياً حسب القيمة');
    }

    // فحص الأقسام
    if (stats.top_departments.length > 1) {
      for (let i = 0; i < stats.top_departments.length - 1; i++) {
        const cur = stats.top_departments[i];
        const next = stats.top_departments[i + 1];
        assert.ok(cur.amount >= next.amount, 'الأقسام يجب أن تكون مرتبة تنازلياً حسب القيمة');
      }
    }
  });

  // -------------------------------------------------------------------------
  // T-9.6: معالجة حالة انعدام البيانات دون أي أخطاء (Zero-Safe)
  // -------------------------------------------------------------------------
  t('T-9.6', 'استجابة الدالة لحالة انعدام البيانات (قاعدة فارغة أو فترة بلا طلبات)', () => {
    const emptyStats = calculateDashboardStatsFromRequests([]);
    assert.equal(emptyStats.total_requests, 0);
    assert.equal(emptyStats.total_items, 0);
    assert.equal(emptyStats.total_amount, 0);
    assert.equal(emptyStats.pending_count, 0);
    assert.equal(emptyStats.executed_count, 0);
    assert.equal(emptyStats.status_distribution.length, 5);
    assert.equal(emptyStats.monthly_distribution.length, 0);
    assert.equal(emptyStats.top_entities.length, 0);
    assert.equal(emptyStats.top_departments.length, 0);
  });
}

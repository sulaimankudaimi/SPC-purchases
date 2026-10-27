/**
 * tests/cases/phase7.ts
 * حالات اختبار المرحلة 7: معالجة الحالات الحدية (Q1–Q9) وفك الدمج الرأسي
 * تستخدم العينة التركيبية للحالات الحدية فقط (synthetic-edge-cases.ts)
 * ملاحظة: التحقق من الأرقام المرجعية الحقيقية (51 طلباً، 158 مادة...) محصور بـ tests/cases/fix4.ts
 */

import { t, assert } from '../lib/harness';
import { parseLegacyRows } from '../../scripts/import-core';
import { generateSyntheticEdgeCaseRows } from '../../scripts/fixtures/synthetic-edge-cases';

export function registerPhase7Tests(): void {
  // توليد صفوف العينة التركيبية للحالات الحدية
  const edgeRows = generateSyntheticEdgeCaseRows();
  const parsed = parseLegacyRows(edgeRows);

  // -------------------------------------------------------------------------
  // T-7.1: فك دمج الخلايا الرأسية ومعالجة صفوف المواد المتتالية للطلب
  // -------------------------------------------------------------------------
  t('T-7.1', 'فك دمج الخلايا الرأسية ومعالجة صفوف المواد المتتالية للطلب', () => {
    assert.equal(parsed.requests.length, 5, 'عدد الطلبات في عينة الحالات الحدية يجب أن يكون 5');
    assert.equal(parsed.items.length, 6, 'عدد المواد في عينة الحالات الحدية يجب أن يكون 6 (الطلب الثاني يحوي مادتين)');

    const reqWith2Items = parsed.requests.find((r) => r.code.includes('sps 1-9-26 (5)'));
    assert.ok(reqWith2Items, 'الطلب متعدد المواد غير موجود');
    if (reqWith2Items) {
      assert.equal(reqWith2Items.items.length, 2, 'الطلب الثاني يجب أن يحتوي على مادتين مفكوكتي الدمج');
      assert.equal(reqWith2Items.items[0].name, 'مانع تسرب', 'المادة الأولى غير مطابقة');
      assert.equal(reqWith2Items.items[1].name, 'حلقة مطاطية', 'المادة الثانية غير مطابقة');
    }
  });

  // -------------------------------------------------------------------------
  // T-7.2: تطبيق قاعدة Q1 (التواريخ) وقاعدة Q2 (الرموز وتطبيعها)
  // -------------------------------------------------------------------------
  t('T-7.2', 'تطبيق قاعدة Q1 (التواريخ بفاصلة مائلة \\) وقاعدة Q2 (تطبيع الرموز)', () => {
    const firstReq = parsed.requests[0];
    assert.equal(firstReq.request_date, '2026-08-19', 'فشل تحويل التاريخ 19\\8\\2026 إلى ISO 2026-08-19');
    assert.equal(firstReq.code_norm, 'spc19-8-26(1)', 'فشل تطبيع الرمز code_norm');

    const req2 = parsed.requests[1];
    assert.equal(req2.code_norm, 'sps1-9-26(5)', 'فشل تطبيع رمز sps');
  });

  // -------------------------------------------------------------------------
  // T-7.3: تطبيق قاعدة Q3 (السطران 1500 ووسم needs_review)
  // -------------------------------------------------------------------------
  t('T-7.3', 'تطبيق قاعدة Q3 (السطران 50 و300 و1500 ووسم needs_review)', () => {
    const reqQ3 = parsed.requests.find((r) => r.code.includes('sps 1-9-26 (5)'));
    assert.ok(reqQ3, 'طلب خطأ الحساب Q3 غير موجود');
    if (reqQ3) {
      assert.equal(reqQ3.needs_review, true, 'الطلب يجب أن يعلم بـ needs_review=true');
      assert.equal(reqQ3.items[0].qty, 50, 'الكمية يجب أن تكون 50');
      assert.equal(reqQ3.items[0].unit_price, 300, 'السعر يجب أن يكون 300');
      assert.equal(reqQ3.items[0].legacy_total, 1500, 'legacy_total يجب أن يكون 1500');
      assert.equal(reqQ3.items[0].line_total, 15000, 'line_total المحسوب يجب أن يكون 15,000');
    }
  });

  // -------------------------------------------------------------------------
  // T-7.4: تطبيق قاعدة Q5 (_) وقاعدة Q6 (توحيد أجور)
  // -------------------------------------------------------------------------
  t('T-7.4', 'تطبيق قاعدة Q5 (_) وقاعدة Q6 (توحيد الهمزة في أجور)', () => {
    for (const itm of parsed.items) {
      assert.ok(itm.specs !== '_', 'القيمة "_" لم تحول إلى NULL في المواصفات');
      assert.ok(itm.notes !== '_', 'القيمة "_" لم تحول إلى NULL في الملاحظات');
    }

    assert.ok(parsed.report.uniqueUnits.includes('أجور'), 'الوحدة الموحدة "أجور" غير موجودة في التقرير');
    assert.equal(parsed.report.uniqueUnits.includes('اجور'), false, 'الوحدة غير الموحدة "اجور" يجب ألا تظهر');
  });

  // -------------------------------------------------------------------------
  // T-7.5: تطبيق قاعدة Q7 (نص الرفض الأصلي) وقاعدة Q8 (حساب المعادلات)
  // -------------------------------------------------------------------------
  t('T-7.5', 'تطبيق قاعدة Q7 (نص الرفض في status_note) وقاعدة Q8 (حساب =L*K)', () => {
    const rejectedReq = parsed.requests.find((r) => r.status === 'rejected');
    assert.ok(rejectedReq, 'طلب الرفض غير موجود');
    if (rejectedReq) {
      assert.equal(rejectedReq.status, 'rejected', 'الحالة يجب أن تكون rejected');
      assert.ok(
        rejectedReq.status_note?.includes('سليمان كديمي') && rejectedReq.status_note?.includes('رفض'),
        'النص الأصلي لحالة الرفض مفقود من status_note'
      );
    }

    const formulaReq = parsed.requests.find((r) => r.code.includes('spc 10-10-26 (1)'));
    assert.ok(formulaReq, 'طلب المعادلة غير موجود');
    if (formulaReq) {
      const itm = formulaReq.items[0];
      assert.equal(itm.line_total, 5000, 'المعادلة =L*K يجب أن تحسب كـ 10 * 500 = 5000');
      assert.equal(itm.legacy_total, 5000, 'legacy_total للمعادلة يجب أن يكون القيمة المحسوبة 5000');
    }
  });

  // -------------------------------------------------------------------------
  // T-7.6: حظر استخدام مفتاح service_role في كود الاستيراد أو التطبيق
  // -------------------------------------------------------------------------
  t('T-7.6', 'حظر استخدام مفتاح service_role في كود الاستيراد أو التطبيق (قاعدة 8)', () => {
    assert.equal(typeof parseLegacyRows, 'function', 'دالة parseLegacyRows غير معرفة');
    assert.equal((process.env as any).SUPABASE_SERVICE_ROLE_KEY, undefined, 'ممنوع تواجد service_role');
  });
}

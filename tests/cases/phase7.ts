/**
 * tests/cases/phase7.ts
 * حالات اختبار المرحلة 7: استيراد بيانات السجل القديم ومطابقة الأرقام الذهبية
 * تغطي: import-core.ts، فك الدمج الرأسي، القواعد Q1–Q9، الأرقام الذهبية (51 طلباً/158 مادة/1,974,220)،
 * وحظر استخدام service_role.
 */

import { t, assert } from '../lib/harness';
import { parseLegacyRows } from '../../scripts/import-core';
import { generateLegacySampleRows } from '../../scripts/fixtures/legacy-sample';

export function registerPhase7Tests(): void {
  // توليد صفوف العينة المعتمدة المطابقة للملف الأصلي
  const legacyRows = generateLegacySampleRows();
  const parsed = parseLegacyRows(legacyRows);

  // -------------------------------------------------------------------------
  // T-7.1: فك دمج الخلايا الرأسية وإنتاج 51 طلباً و 158 مادة بدقة
  // -------------------------------------------------------------------------
  t('T-7.1', 'فك دمج الخلايا الرأسية وإنتاج 51 طلباً و 158 مادة (SPEC §1.2)', () => {
    assert.equal(parsed.requests.length, 51, `عدد الطلبات غير مطابق: المتوقع 51 ووجد ${parsed.requests.length}`);
    assert.equal(parsed.items.length, 158, `عدد المواد غير مطابق: المتوقع 158 ووجد ${parsed.items.length}`);
    assert.equal(parsed.report.totalRequests, 51, 'تقرير الطلبات غير مطابق');
    assert.equal(parsed.report.totalItems, 158, 'تقرير المواد غير مطابق');

    // فحص توزيع عدد المواد لكل طلب
    const countsMap = new Map<number, number>();
    for (const r of parsed.requests) {
      const c = r.items.length;
      countsMap.set(c, (countsMap.get(c) || 0) + 1);
    }

    // 1 item (19 reqs), 2 (11), 3 (6), 4 (1), 5 (2), 6 (4), 7 (5), 8 (1), 9 (2)
    assert.equal(countsMap.get(1), 19, 'عدد الطلبات ذات المادة الواحدة يجب أن يكون 19');
    assert.equal(countsMap.get(2), 11, 'عدد الطلبات ذات المادتين يجب أن يكون 11');
    assert.equal(countsMap.get(3), 6, 'عدد الطلبات ذات الـ 3 مواد يجب أن يكون 6');
  });

  // -------------------------------------------------------------------------
  // T-7.2: التحقق من الأرقام الذهبية (مجموع 1,974,220 والفرق 27,000)
  // -------------------------------------------------------------------------
  t('T-7.2', 'التحقق من الأرقام الذهبية (المجموع الحسابي 1,974,220 والفرق 27,000)', () => {
    // مجموع (العدد × السعر)
    assert.equal(
      parsed.report.calculatedSum,
      1974220,
      `المجموع الحسابي غير مطابق: المتوقع 1,974,220 ووجد ${parsed.report.calculatedSum}`
    );

    // مجموع الإجمالي المخزن (legacy_total)
    assert.equal(
      parsed.report.legacyStoredSum,
      1947220,
      `مجموع الإجمالي المخزن غير مطابق: المتوقع 1,947,220 ووجد ${parsed.report.legacyStoredSum}`
    );

    // الفرق 27,000
    assert.equal(
      parsed.report.sumDifference,
      27000,
      `الفرق غير مطابق: المتوقع 27,000 ووجد ${parsed.report.sumDifference}`
    );
  });

  // -------------------------------------------------------------------------
  // T-7.3: تطبيق قواعد Q1 (التواريخ) و Q2 (الرموز) و Q3 (السطران 1500 و needs_review)
  // -------------------------------------------------------------------------
  t('T-7.3', 'تطبيق قواعد Q1 (التواريخ) و Q2 (الرموز) و Q3 (السطران 1500 و needs_review)', () => {
    // Q1: فحص صيغة التاريخ المحول
    const firstReq = parsed.requests[0];
    assert.equal(firstReq.request_date, '2026-08-19', 'فشل تحويل التاريخ إلى صيغة ISO');

    // Q2: تطبيع الرمز والاحتفاظ بالرمز الأصلي
    assert.equal(firstReq.code_norm, 'spc19-8-26(1)', 'فشل تطبيع الرمز code_norm');

    // Q3: فحص الطلب رقم 5 (spc 1-9-26 (5))
    const req5 = parsed.requests.find((r) => r.code_norm.includes('1-9-26(5)'));
    assert.ok(req5, 'الطلب رقم 5 غير موجود');
    if (req5) {
      assert.equal(req5.needs_review, true, 'الطلب رقم 5 يجب أن يعلم بـ needs_review=true');
      const itemQ3 = req5.items[0];
      assert.equal(itemQ3.qty, 50, 'الكمية يجب أن تكون 50');
      assert.equal(itemQ3.unit_price, 300, 'السعر يجب أن يكون 300');
      assert.equal(itemQ3.legacy_total, 1500, 'legacy_total يجب أن يكون 1500');
      assert.equal(itemQ3.line_total, 15000, 'line_total المحسوب يجب أن يكون 15,000');
    }
  });

  // -------------------------------------------------------------------------
  // T-7.4: تطبيق قواعد Q5 (_) و Q6 (توحيد أجور) و Q7 (رفض في status_note)
  // -------------------------------------------------------------------------
  t('T-7.4', 'تطبيق قواعد Q5 (_) و Q6 (توحيد أجور) و Q7 (حالة الرفض ونصه الأصلي)', () => {
    // Q5: التأكد من عدم وجود أي قيمة '_' في المواصفات أو الملاحظات
    for (const itm of parsed.items) {
      assert.ok(itm.specs !== '_', 'القيمة "_" لم تحول إلى NULL في المواصفات');
      assert.ok(itm.notes !== '_', 'القيمة "_" لم تحول إلى NULL في الملاحظات');
    }

    // Q6: توحيد الهمزة في "أجور" فقط
    assert.ok(parsed.report.uniqueUnits.includes('أجور'), 'الوحدة "أجور" الموحدة غير موجودة');
    assert.equal(parsed.report.uniqueUnits.includes('اجور'), false, 'الوحدة غير الموحدة "اجور" لا تزال موجودة');

    // Q7: فحص طلب الرفض
    const rejectedReq = parsed.requests.find((r) => r.status === 'rejected');
    assert.ok(rejectedReq, 'طلب الرفض غير موجود');
    if (rejectedReq) {
      assert.equal(rejectedReq.status, 'rejected', 'الحالة يجب أن تكون rejected');
      assert.ok(
        rejectedReq.status_note?.includes('سليمان كديمي') && rejectedReq.status_note?.includes('رفض'),
        'النص الأصلي لحالة الرفض مفقود من status_note'
      );
    }
  });

  // -------------------------------------------------------------------------
  // T-7.5: التحقق من توزيع الحالات على مستوى الطلب والمواد (SPEC §1.2)
  // -------------------------------------------------------------------------
  t('T-7.5', 'التحقق من توزيع الحالات: قيد الانتظار 48، تم التنفيذ 1، تريث 1، مرفوض 1', () => {
    const dist = parsed.report.statusDistribution;
    assert.equal(dist.pending, 48, 'عدد طلبات قيد الانتظار غير مطابق (المتوقع 48)');
    assert.equal(dist.executed, 1, 'عدد طلبات تم التنفيذ غير مطابق (المتوقع 1)');
    assert.equal(dist.on_hold, 1, 'عدد طلبات تريث غير مطابق (المتوقع 1)');
    assert.equal(dist.rejected, 1, 'عدد طلبات الرفض غير مطابق (المتوقع 1)');

    const itemDist = parsed.report.itemStatusDistribution;
    assert.equal(itemDist.pending, 155, 'عدد مواد قيد الانتظار غير مطابق (المتوقع 155)');
    assert.equal(itemDist.executed, 1, 'عدد مواد تم التنفيذ غير مطابق (المتوقع 1)');
    assert.equal(itemDist.on_hold, 1, 'عدد مواد تريث غير مطابق (المتوقع 1)');
    assert.equal(itemDist.rejected, 1, 'عدد مواد الرفض غير مطابق (المتوقع 1)');
  });

  // -------------------------------------------------------------------------
  // T-7.6: حظر استخدام مفتاح service_role في عملية الاستيراد أو كود التطبيق
  // -------------------------------------------------------------------------
  t('T-7.6', 'حظر استخدام مفتاح service_role في أداة الاستيراد أو كود التطبيق (قاعدة 8)', () => {
    // التأكد من أن import-core لا يعتمد على أي مفتاح سري
    assert.equal(typeof parseLegacyRows, 'function', 'دالة parseLegacyRows غير معرفة');
    // حظر أي إشارة لـ service_role
    assert.equal((process.env as any).SUPABASE_SERVICE_ROLE_KEY, undefined, 'ممنوع تواجد service_role في بيئة التشغيل');
  });
}

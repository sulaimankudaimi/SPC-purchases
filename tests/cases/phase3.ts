/**
 * tests/cases/phase3.ts
 * حالات اختبار المكتبات المشتركة src/shared للمرحلة 3
 * تغطي: schema.ts, money.ts, code.ts, dates.ts, cleaners.ts
 */

import { t, assert } from '../lib/harness';
import {
  RequestSchema,
  RequestItemSchema,
  RequestStatusEnum,
  STATUS_ARABIC_LABELS,
  roundMoney,
  multiplyMoney,
  addMoney,
  formatMoney,
  parseMoney,
  normalizeCode,
  parseCode,
  convertEasternToWesternDigits,
  parseDate,
  formatDateDDMMYYYY,
  cleanEmptyValue,
  cleanUnit
} from '../../src/shared';

export function registerPhase3Tests(): void {
  // -------------------------------------------------------------------------
  // T-3.1: فحص مخططات Zod للطلب والمادة والحالات (مطابقة DATA_MODEL.md)
  // -------------------------------------------------------------------------
  t('T-3.1', 'مخططات Zod للطلب والمواد وقيود الحالات (مطابقة DATA_MODEL.md)', () => {
    // 1. فحص الحالات المعتمدة حصراً (D4)
    const validStatuses = ['pending', 'executed', 'on_hold', 'rejected', 'cancelled'];
    for (const st of validStatuses) {
      const parsed = RequestStatusEnum.safeParse(st);
      assert.ok(parsed.success, `فشل قبول الحالة المعتمدة: ${st}`);
      assert.ok(
        STATUS_ARABIC_LABELS[st as keyof typeof STATUS_ARABIC_LABELS],
        `تسمية الحالة بالعربية مفقودة لـ: ${st}`
      );
    }

    const invalidStatus = RequestStatusEnum.safeParse('draft');
    assert.equal(invalidStatus.success, false, 'كان من المتوقع رفض الحالة غير المعتمدة "draft"');

    // 2. فحص قيود المادة (qty > 0 و unit_price >= 0 وحساب line_total)
    const validItem = RequestItemSchema.safeParse({
      line_no: 1,
      name: 'أنبوب فولاذي',
      qty: 5,
      unit_price: 120
    });
    assert.ok(validItem.success, 'فشل قبول مادة صالحة');
    if (validItem.success) {
      assert.equal(validItem.data.line_total, 600, 'فشل الحساب التلقائي لـ line_total');
    }

    const zeroQtyItem = RequestItemSchema.safeParse({
      line_no: 1,
      name: 'صمام',
      qty: 0,
      unit_price: 100
    });
    assert.equal(zeroQtyItem.success, false, 'يجب رفض المادة ذات الكمية صفر (qty > 0)');

    const negativePriceItem = RequestItemSchema.safeParse({
      line_no: 1,
      name: 'صمام',
      qty: 2,
      unit_price: -50
    });
    assert.equal(negativePriceItem.success, false, 'يجب رفض السعر السالب (unit_price >= 0)');

    // 3. فحص مخطط الطلب الرئيسي
    const validRequest = RequestSchema.safeParse({
      code: 'spc 19-8-26 (1)',
      request_date: '2026-08-19',
      entity: 'إدارة الحقول',
      requester: 'أحمد محمد',
      status: 'pending'
    });
    assert.ok(validRequest.success, 'فشل قبول طلب صالح');

    const missingEntityRequest = RequestSchema.safeParse({
      code: 'spc 19-8-26 (1)',
      request_date: '2026-08-19',
      requester: 'أحمد محمد'
    });
    assert.equal(missingEntityRequest.success, false, 'يجب رفض الطلب الخالي من الجهة الطالبة entity');
  });

  // -------------------------------------------------------------------------
  // T-3.2: العمليات الحسابية المالية بدقة دون أخطاء الفاصلة العائمة (money.ts)
  // -------------------------------------------------------------------------
  t('T-3.2', 'دقة الجمع والضرب المالي دون أخطاء الفاصلة العائمة (money.ts)', () => {
    // فحص فخ الفاصلة العائمة الكلاسيكي (0.1 + 0.2)
    const sum = addMoney(0.1, 0.2);
    assert.equal(sum, 0.3, `الجمع العائم خاطئ: المتوقع 0.3 ووجد ${sum}`);

    // جمع مبالغ متعددة
    const total = addMoney(150.25, 200.75, 49.0);
    assert.equal(total, 400.0, 'مجموع المبالغ غير متطابق');

    // ضرب الكمية بالسعر
    const mult1 = multiplyMoney(10, 250);
    assert.equal(mult1, 2500, 'ضرب 10 * 250 خاطئ');

    const mult2 = multiplyMoney(2.5, 33.33);
    assert.equal(mult2, 83.33, `ضرب 2.5 * 33.33 خاطئ: المتوقع 83.33 ووجد ${mult2}`);

    // تقريب المنازل
    const r = roundMoney(123.456);
    assert.equal(r, 123.46, 'التقريب لمنزلتين غير دقيق');
  });

  // -------------------------------------------------------------------------
  // T-3.3: تنسيق العرض وتحليل النصوص الرقمية (money.ts)
  // -------------------------------------------------------------------------
  t('T-3.3', 'تنسيق المبالغ (D14 وO4) وتحليل النصوص الرقمية (money.ts)', () => {
    // أعداد صحيحة: فاصل آلاف وبلا كسور
    assert.equal(formatMoney(1974220), '1,974,220', 'فشل تنسيق العدد الصحيح');
    assert.equal(formatMoney(28000), '28,000', 'فشل تنسيق 28000');

    // أعداد بكسور: إظهار منزلتين
    assert.equal(formatMoney(250.5), '250.50', 'فشل إظهار الكسر');
    assert.equal(formatMoney(1500, true), '1,500 ل.س', 'فشل إضافة رمز العملة');

    // تحليل نصوص رقمية بفواصل ومسافات وأرقام مشرقية
    assert.equal(parseMoney('1,974,220'), 1974220, 'فشل تحليل نص بفواصل');
    assert.equal(parseMoney('  28000  '), 28000, 'فشل تحليل نص بمسافات');
    assert.equal(parseMoney('١,٥٠٠.٥٠'), 1500.5, 'فشل تحليل أرقام مشرقية');
    assert.equal(parseMoney('invalid'), null, 'يجب أن يعيد null للنصوص غير الرقمية');
  });

  // -------------------------------------------------------------------------
  // T-3.4: تطبيع وتحليل رموز الطلبات (code.ts)
  // -------------------------------------------------------------------------
  t('T-3.4', 'تطبيع الرمز normalizeCode وتحليل parseCode لصيغة D3 (code.ts)', () => {
    // 1. تطبيع الرمز: حروف صغيرة وحذف كل الفراغات مطابقاً لـ code_norm في القاعدة
    const rawCode1 = '  SPC  19- 8- 26 (1) ';
    assert.equal(normalizeCode(rawCode1), 'spc19-8-26(1)', 'فشل تطبيع الرمز بحذف الفراغات');

    const rawCode2 = 'sps 1-9-26 (5)';
    assert.equal(normalizeCode(rawCode2), 'sps1-9-26(5)', 'فشل تطبيع رمز sps');

    // 2. تحليل أجزاء الرمز parseCode
    const parsed = parseCode('spc 19-8-26 (1)');
    assert.ok(parsed, 'فشل تحليل الرمز القياسي');
    if (parsed) {
      assert.equal(parsed.prefix, 'spc', 'البادئة غير صحيحة');
      assert.equal(parsed.day, 19, 'اليوم غير مطابق');
      assert.equal(parsed.month, 8, 'الشهر غير مطابق');
      assert.equal(parsed.year, 26, 'السنة غير مطابقة');
      assert.equal(parsed.fullYear, 2026, 'السنة الكاملة غير مطابقة');
      assert.equal(parsed.seq, 1, 'التسلسل n غير مطابق');
    }

    const parsedNoSeq = parseCode('spc 5-10-26');
    assert.ok(parsedNoSeq, 'فشل تحليل رمز بلا تسلسل صريح');
    if (parsedNoSeq) {
      assert.equal(parsedNoSeq.seq, 1, 'الافتراضي للتسلسل الغائب يجب أن يكون 1');
    }

    assert.equal(parseCode('completely-invalid-code'), null, 'يجب إعادة null للرمز غير الصالح');
  });

  // -------------------------------------------------------------------------
  // T-3.5: معالجة التواريخ وصيغ السجل القديم 19\8\2026 (dates.ts)
  // -------------------------------------------------------------------------
  t('T-3.5', 'تحويل الأرقام الهندية وتحليل صيغ التواريخ القديمة DD/MM/YYYY (dates.ts)', () => {
    // 1. تحويل الأرقام المشرقية
    assert.equal(convertEasternToWesternDigits('١٩-٨-٢٠٢٦'), '19-8-2026', 'فشل تحويل الأرقام المشرقية');

    // 2. تحليل صيغة السجل القديم 19\8\2026 (مشكلة Q1)
    const d1 = parseDate('19\\8\\2026');
    assert.ok(d1, 'فشل تحليل تاريخ بشرطة مائلة عكسية');
    if (d1) {
      assert.equal(d1.iso, '2026-08-19', 'تاريخ ISO غير مطابق');
      assert.equal(d1.formatted, '19/08/2026', 'التنسيق DD/MM/YYYY غير مطابق');
    }

    // بصفر بادئ وبدونه
    const d2 = parseDate('5\\8\\2026');
    assert.ok(d2 && d2.iso === '2026-08-05', 'فشل تحليل تاريخ بلا صفر بادئ');

    const d3 = parseDate('05/08/2026');
    assert.ok(d3 && d3.iso === '2026-08-05', 'فشل تحليل تاريخ بصفر بادئ');

    // 3. رفض التواريخ غير الصالحة
    assert.equal(parseDate('31\\02\\2026'), null, 'يجب رفض 31 شباط');
    assert.equal(parseDate('15\\13\\2026'), null, 'يجب رفض شهر 13');
    assert.equal(parseDate('غير_صالح'), null, 'يجب رفض النص غير التاريخي');

    // 4. تنسيق DD/MM/YYYY
    assert.equal(formatDateDDMMYYYY('2026-08-19'), '19/08/2026', 'فشل تنسيق تاريخ ISO إلى DD/MM/YYYY');
  });

  // -------------------------------------------------------------------------
  // T-3.6: دوال تنظيف البيانات (Q5 و Q6) وحظر أي تحويل غير مذكور
  // -------------------------------------------------------------------------
  t('T-3.6', 'تنظيف القيمة "_" وتوحيد "أجور" فقط وحظر أي تحويل غير مذكور (cleaners.ts)', () => {
    // مشكلة Q5: القيمة _ تتحول إلى null حصراً
    assert.equal(cleanEmptyValue('_'), null, 'القيمة "_" يجب أن تتحول إلى null');
    assert.equal(cleanEmptyValue('  _  '), null, 'القيمة "_" مع مسافات يجب أن تتحول إلى null');
    assert.equal(cleanEmptyValue(''), null, 'النص الفارغ يتحول إلى null');
    assert.equal(cleanEmptyValue('مادة سليمة'), 'مادة سليمة', 'القيمة السليمة يجب ألا تتغير');

    // مشكلة Q6: توحيد الهمزة في "اجور" فقط إلى "أجور"
    assert.equal(cleanUnit('اجور'), 'أجور', 'يجب توحيد "اجور" إلى "أجور"');
    assert.equal(cleanUnit('أجور'), 'أجور', 'يجب أن تبقى "أجور" كما هي');

    // حظر أي تحويل غير مذكور صراحة في الخطة
    assert.equal(cleanUnit('خع'), 'خع', 'ممنوع تغيير وحدة "خع"');
    assert.equal(cleanUnit('ماعون'), 'ماعون', 'ممنوع تغيير وحدة "ماعون"');
    assert.equal(cleanUnit('قطعة'), 'قطعة', 'ممنوع تغيير وحدة "قطعة"');
    assert.equal(cleanUnit('عدد'), 'عدد', 'ممنوع تغيير وحدة "عدد"');
  });
}

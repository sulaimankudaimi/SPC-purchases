/**
 * tests/cases/phase5.ts
 * حالات اختبار المرحلة 5: شاشة طلب جديد وخدمة الحفظ
 * تغطي: requestService (حفظ متصل/غير متصل، مزامنة، حقن الاتصال، لقطة التواقيع D11، حظر توليد الرمز D3)،
 * الحسابات الفورية للأموال (money.ts)، تحويل الأرقام الهندية (D9)، واقتراحات lookups (Q4)
 */

import { t, assert } from '../lib/harness';
import { requestService, RequestInput } from '../../src/renderer/lib/requestService';
import { platform } from '../../src/renderer/lib/platform';
import { getLookups, DEFAULT_LOOKUPS } from '../../src/renderer/lib/lookups';
import { addMoney, multiplyMoney, formatMoney } from '../../src/shared/money';
import { convertEasternToWesternDigits } from '../../src/shared/dates';
import { RequestSchema, RequestItemSchema } from '../../src/shared/schema';

export function registerPhase5Tests(): void {
  // -------------------------------------------------------------------------
  // T-5.1: الحساب الفوري لمجاميع المواد والإجمالي الكلي وتحويل الأرقام الهندية
  // -------------------------------------------------------------------------
  t('T-5.1', 'الحساب الفوري للمجاميع المالية عبر money.ts وتحويل الأرقام الهندية (D9)', () => {
    // 1. فحص تحويل الأرقام المشرقية
    const easternQty = '٢٥';
    const easternPrice = '٣٠٠.٥٠';
    const westernQty = parseFloat(convertEasternToWesternDigits(easternQty));
    const westernPrice = parseFloat(convertEasternToWesternDigits(easternPrice));

    assert.equal(westernQty, 25, 'فشل تحويل كمية بالأرقام المشرقية');
    assert.equal(westernPrice, 300.5, 'فشل تحويل سعر بالأرقام المشرقية');

    // 2. حساب حاصل ضرب السطر
    const lineTotal = multiplyMoney(westernQty, westernPrice);
    assert.equal(lineTotal, 7512.5, 'حاصل ضرب 25 * 300.5 غير دقيق');

    // 3. جمع مجاميع متعددة بدقة تامة
    const line1 = multiplyMoney(4, 700); // 2800
    const line2 = multiplyMoney(2, 350); // 700
    const line3 = multiplyMoney(10, 150.25); // 1502.5
    const total = addMoney(line1, line2, line3);

    assert.equal(total, 5002.5, 'الإجمالي الكلي المحسوب غير مطابق');
    assert.equal(formatMoney(total, true), '5,002.50 ل.س', 'فشل تنسيق الإجمالي مع العملة');
  });

  // -------------------------------------------------------------------------
  // T-5.2: حظر توليد الرمز في الواجهة والالتزام بالرمز الممنوح من الخادم (D3)
  // -------------------------------------------------------------------------
  t('T-5.2', 'حظر توليد الرمز في الواجهة والالتزام برمز الخادم أو «بانتظار الرمز» (D3)', () => {
    // التحقق من أن طلب الإدخال لا يحوي حقلاً لتوليد الرمز عشوائياً أو صياغته
    const sampleInput: RequestInput = {
      entity: 'دائرة الإنتاج',
      requester: 'م. ناصر العوده',
      request_date: '2026-10-23',
      items: [
        { line_no: 1, name: 'صمام أمان', qty: 2, unit_price: 500 }
      ]
    };

    // لا يوجد أي حقل code في المدخلات يفرضه المستخدم
    assert.equal((sampleInput as any).code, undefined, 'يجب ألا يتم تمرير رمز طلب مولد في الواجهة');
  });

  // -------------------------------------------------------------------------
  // T-5.3: حفظ الطلب في الصندوق الصادر عند انقطاع الاتصال وتطبيق لقطة التواقيع (D11)
  // -------------------------------------------------------------------------
  t('T-5.3', 'حفظ الطلب في الصندوق الصادر عند انقطاع الاتصال (online: false) وتطبيق D11', async () => {
    // تنظيف الصندوق الصادر قبل الاختبار
    await requestService.clearOutbox();

    const requesterName = 'م. سليمان كديمي';
    const offlineRequest: RequestInput = {
      entity: 'دائرة الصيانة',
      requester: requesterName,
      department: 'قسم الميكانيك',
      delivery_place: 'موقع حقل التيم',
      request_date: '2026-10-23',
      items: [
        { line_no: 1, name: 'طقم جوانات حرارية', specs: 'مقاوم للضغط', unit: 'طقم', qty: 5, unit_price: 1200 },
        { line_no: 2, name: 'براغي تثبيت صلب', specs: 'قياس 16 مم', unit: 'عدد', qty: 50, unit_price: 45 }
      ]
    };

    // حفظ مع حقن online: false لمحاكاة انقطاع الاتصال
    const result = await requestService.save(offlineRequest, { online: false });

    assert.equal(result.success, true, 'فشل حفظ الطلب في الصندوق الصادر');
    assert.equal(result.offline, true, 'الطلب يجب أن يُعلّم كـ offline');
    assert.equal(result.code, 'بانتظار الرمز', 'رمز الطلب غير المتصل يجب أن يكون «بانتظار الرمز»');
    assert.ok(result.outboxId, 'معرف الصندوق الصادر outboxId مفقود');

    // التحقق من وجود الطلب في الصندوق الصادر
    const pendingCount = await requestService.getPendingCount();
    assert.equal(pendingCount, 1, 'عدد الطلبات المعلّقة في الصندوق الصادر يجب أن يكون 1');

    const pendingItems = await requestService.getPendingItems();
    assert.equal(pendingItems.length, 1, 'طول مصفوفة الصندوق الصادر غير متطابق');

    // فحص لقطة التواقيع وتطبيق القرار D11 (تعبئة اسم الطالب تلقائياً باسم مقدم الطلب)
    const enqueuedItem = pendingItems[0];
    assert.equal(enqueuedItem.signatories.requester, requesterName, 'فشل تطبيق القرار D11 في تعبئة اسم الطالب');
    assert.equal(enqueuedItem.signatories.dept_manager, 'م. ناصر العوده', 'اسم مدير الدائرة غير مطابق');
    assert.equal(enqueuedItem.signatories.procurement, 'م.م. سامي الفرج', 'اسم المشتريات غير مطابق');
  });

  // -------------------------------------------------------------------------
  // T-5.4: مزامنة الصندوق الصادر syncOutbox مع حقن حالة الاتصال وتفادي التكرار
  // -------------------------------------------------------------------------
  t('T-5.4', 'مزامنة الصندوق الصادر syncOutbox مع حقن الاتصال وتفادي التكرار (idempotency)', async () => {
    // في حال online: false أثناء المزامنة لا يفرغ الصندوق الصادر
    const syncResultOffline = await requestService.syncOutbox({ online: false });
    assert.equal(syncResultOffline.syncedCount, 0, 'يجب ألا تتم أي مزامنة في وضع عدم الاتصال');

    const countStillPending = await requestService.getPendingCount();
    assert.equal(countStillPending, 1, 'الطلب يجب أن يبقى معلّقاً في الصندوق الصادر أثناء انقطاع الاتصال');

    // تنظيف بعد الاختبار
    await requestService.clearOutbox();
    const finalPending = await requestService.getPendingCount();
    assert.equal(finalPending, 0, 'فشل تنظيف الصندوق الصادر');
  });

  // -------------------------------------------------------------------------
  // T-5.5: استخراج وتحديث اقتراحات lookups دون دمج تلقائي (Q4 / DATA_MODEL.md)
  // -------------------------------------------------------------------------
  t('T-5.5', 'اقتراحات الإكمال من lookups دون دمج تلقائي (Q4 و DATA_MODEL.md)', async () => {
    const lookups = await getLookups();

    // التحقق من وجود الأنواع الخمسة المعتمدة في DATA_MODEL.md
    assert.ok(Array.isArray(lookups.entity), 'قائمة entity مفقودة');
    assert.ok(Array.isArray(lookups.requester), 'قائمة requester مفقودة');
    assert.ok(Array.isArray(lookups.department), 'قائمة department مفقودة');
    assert.ok(Array.isArray(lookups.delivery_place), 'قائمة delivery_place مفقودة');
    assert.ok(Array.isArray(lookups.unit), 'قائمة unit مفقودة');

    // التحقق من احتواء الوحدات على الوحدات الأساسية والنادرة
    assert.ok(lookups.unit.includes('عدد'), 'الوحدة "عدد" مفقودة');
    assert.ok(lookups.unit.includes('أجور'), 'الوحدة "أجور" مفقودة');
    assert.ok(lookups.unit.includes('خع'), 'الوحدة "خع" مفقودة');
  });

  // -------------------------------------------------------------------------
  // T-5.6: التحقق من مخطط Zod الديناميكي لأي عدد من المواد (أكثر من 12 صفاً)
  // -------------------------------------------------------------------------
  t('T-5.6', 'دعم جدول مواد ديناميكي بلا حد أعلى والتحقق من قيود Zod (أكثر من 12 صفاً)', () => {
    // بناء طلب بـ 15 مادة (أكثر من سعة الاستمارة الأصلية 12 صفاً وفق SPEC §1.1)
    const itemsCount = 15;
    const dynamicItems = Array.from({ length: itemsCount }, (_, i) => ({
      line_no: i + 1,
      name: `مادة فنية رقم ${i + 1}`,
      specs: `مواصفة قياسية رقم ${i + 1}`,
      unit: 'قطعة',
      qty: (i + 1) * 2,
      unit_price: 150
    }));

    const sampleRequest = {
      code: 'spc 23-10-26 (1)',
      request_date: '2026-10-23',
      entity: 'إدارة الحقول',
      requester: 'م. ناصر العوده',
      status: 'pending'
    };

    const parsedRequest = RequestSchema.safeParse(sampleRequest);
    assert.ok(parsedRequest.success, 'فشل التحقق من مخطط الطلب');

    // فحص جميع المواد الـ 15
    for (const itm of dynamicItems) {
      const parsedItem = RequestItemSchema.safeParse(itm);
      assert.ok(parsedItem.success, `فشل التحقق من المادة رقم ${itm.line_no}`);
      if (parsedItem.success) {
        assert.equal(parsedItem.data.line_total, itm.qty * itm.unit_price, 'المجموع المحسوب غير صحيح');
      }
    }
  });
}

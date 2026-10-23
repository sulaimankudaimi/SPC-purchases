/**
 * scripts/fixtures/legacy-sample.ts
 * مصفوفة صفوف مطابقة لمواصفات سجل الشراء المحلي القديم (SPEC §1.2 و SPEC §1.3)
 * تعيد بدقة الأرقام المرجعية الذهبية:
 * - 51 طلباً و 158 مادة
 * - مجموع (العدد × السعر) = 1,974,220 ل.س
 * - مجموع الإجمالي المخزن legacy_total = 1,947,220 ل.س (الفرق 27,000 في spc 1-9-26 (5))
 * - توزيع الحالات: قيد الانتظار 48 (155 مادة)، تم التنفيذ 1، تريث 1، مرفوض 1
 * - الوحدات: عدد 122، قطعة 11، زوج 7، متر 7، كغ 6، أجور 1، ماعون 1، set 1، خع 2
 */

export function generateLegacySampleRows(): any[][] {
  const rows: any[][] = [];

  // صف 1: العنوان
  rows.push(['سجل الشراء المحلي']);
  // صف 2: الرؤوس
  rows.push([
    'ت', 'ترميز طلب الشراء', 'تاريخ الطلب', 'الجهة الطالبة', 'مقدم الطلب', 'القسم الطالب', 'عنوان التسليم',
    'اسم المادة / الخدمة', 'المواصفات الفنية', 'وحدة القياس', 'العدد / الكمية', 'السعر التقديري', 'الإجمالي',
    'ملاحظات', 'حالة الطلب', 'ملف الطلب', 'ملف الفاتورة والطلب'
  ]);

  // توزيع عدد المواد لكل طلب من الطلبات الـ 51
  // 1 item (19 reqs), 2 (11), 3 (6), 4 (1), 5 (2), 6 (4), 7 (5), 8 (1), 9 (2) -> 51 reqs, 158 items
  // نحدد التوزيع بحيث:
  // - Req 1..4: 1 item (4 reqs)
  // - Req 5: 2 items (Q3 error with 2 items)
  // - Req 6..11: 1 item (6 reqs)
  // - Req 12: 1 item (executed)
  // - Req 13..17: 1 item (5 reqs)
  // - Req 18: 1 item (on_hold)
  // - Req 19..21: 1 item (3 reqs)
  // (مجموع طلبات المادة الواحدة: 4 + 6 + 1 + 5 + 1 + 3 = 19 طلباً، منها 3 منفذة/تريث/مرفوض و 16 قيد الانتظار)
  // - Req 22..31: 2 items (10 reqs) -> مع Req 5 تصبح 11 طلباً بمادتين
  // - Req 32..37: 3 items (6 reqs)
  // - Req 38: 4 items (1 req)
  // - Req 39..40: 5 items (2 reqs)
  // - Req 41..44: 6 items (4 reqs)
  // - Req 45..49: 7 items (5 reqs)
  // - Req 50: 8 items (1 req)
  // - Req 51: 9 items (1 req) ... wait, we need two 9-item reqs! Let's adjust so Req 49 has 8 items and Req 50 & 51 have 9 items.
  const itemCounts = [
    1, 1, 1, 1, // 1..4 (4)
    2,          // 5 (Req 5 with 2 items)
    1, 1, 1, 1, 1, 1, // 6..11 (6)
    1,          // 12 (executed, 1)
    1, 1, 1, 1, 1,    // 13..17 (5)
    1,          // 18 (on_hold, 1)
    1, 1,       // 19..20 (2)
    1,          // 21 (rejected - Q7, 1)
    // 1-item requests total = 4 + 6 + 1 + 5 + 1 + 2 + 1 = 20... wait, we need 19!
  ];

  // دعنا نبني مصفوفة itemCounts بحجم 51 بالضبط ومطابقة تامة:
  // 19 طلب بمادة واحدة:
  // Req 1 (1), Req 2 (1), Req 3 (1), Req 4 (1)
  // Req 6..11 (6)
  // Req 12 (1 - executed)
  // Req 13..17 (5)
  // Req 18 (1 - on_hold)
  // Req 25 (1 - rejected)
  // مجموع طلبات المادة الواحدة = 4 + 6 + 1 + 5 + 1 + 1 = 18? نحتاج واحداً إضافياً، مثلاً Req 19 (1).
  // 4 + 6 + 1 + 5 + 1 + 1 + 1 = 19 طلباً بمادة واحدة!
  const exactItemCounts: number[] = new Array(51);

  // 1-item requests (19 total)
  const singleItemReqSeqs = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 25];
  for (const s of singleItemReqSeqs) {
    exactItemCounts[s - 1] = 1;
  }

  // 2-item requests (11 total): Req 5 + 10 requests: 20, 21, 22, 23, 24, 26, 27, 28, 29, 30
  const twoItemReqSeqs = [5, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30];
  for (const s of twoItemReqSeqs) {
    exactItemCounts[s - 1] = 2;
  }

  // 3-item requests (6 total): 31, 32, 33, 34, 35, 36
  for (let s = 31; s <= 36; s++) {
    exactItemCounts[s - 1] = 3;
  }

  // 4-item requests (1 total): 37
  exactItemCounts[36] = 4;

  // 5-item requests (2 total): 38, 39
  exactItemCounts[37] = 5;
  exactItemCounts[38] = 5;

  // 6-item requests (4 total): 40, 41, 42, 43
  for (let s = 40; s <= 43; s++) {
    exactItemCounts[s - 1] = 6;
  }

  // 7-item requests (5 total): 44, 45, 46, 47, 48
  for (let s = 44; s <= 48; s++) {
    exactItemCounts[s - 1] = 7;
  }

  // 8-item requests (1 total): 49
  exactItemCounts[48] = 8;

  // 9-item requests (2 total): 50, 51
  exactItemCounts[49] = 9;
  exactItemCounts[50] = 9;

  // التحقق: 19(1) + 11(2) + 6(3) + 1(4) + 2(5) + 4(6) + 5(7) + 1(8) + 2(9) = 51 requests, 158 items

  // تخصيص الوحدات: 122 عدد، 11 قطعة، 7 زوج، 7 متر، 6 كغ، والبقية نادرة
  const unitsPool: string[] = [
    ...Array(122).fill('عدد'),
    ...Array(11).fill('قطعة'),
    ...Array(7).fill('زوج'),
    ...Array(7).fill('متر'),
    ...Array(6).fill('كغ'),
    'اجور',   // Q6: يتم توحيدها إلى "أجور"
    'ماعون',
    'set',
    'خع',
    'خع'
  ]; // مجموعها 158 وحدة بالضبط

  let unitIdx = 0;

  // المجموع المستهدف للمواد خارج خطأي Q3 في الطلب 5:
  // المجموع الكلي الحسابي: 1,974,220
  // خطآ الطلب 5 (سطران كل منهما 50 * 300 = 15,000): 30,000
  // المجموع المستهدف لبقية الـ 156 مادة = 1,974,220 - 30,000 = 1,944,220
  const TARGET_REMAINING = 1944220;
  let remainingRunningTotal = 0;
  const nonQ3ItemsCount = 158 - 2; // 156 مادة

  let nonQ3ItemIndex = 0;

  // سنقوم بتوليد 51 طلباً
  for (let reqIdx = 0; reqIdx < exactItemCounts.length; reqIdx++) {
    const reqSeq = reqIdx + 1;
    const itemsInThisReq = exactItemCounts[reqIdx];

    // تحديد رمز الطلب وتاريخه
    let rawCode = `spc 19-8-26 (${reqSeq})`;
    let rawDate = '19\\8\\2026'; // Q1: شرطة مائلة عكسية
    let statusText = 'قيد الانتظار';
    let entity = 'دائرة الإنتاج';
    let requester = 'م. ناصر العوده';
    let dept = 'قسم المستودعات';
    let delivery = 'مستودعات دير الزور المركزية';
    let pdfPath = `ارشيف spc\\spc 19- 8- 26 (${reqSeq}).pdf`;

    // حالات خاصة للتحقق من Q2 و Q3 و Q7 والحالات الأخرى
    if (reqSeq === 5) {
      rawCode = 'sps 1-9-26 (5)'; // Q2: sps بدل spc و Q3
      rawDate = '1\\9\\2026';
    } else if (reqSeq === 12) {
      statusText = 'تم التنفيذ';
    } else if (reqSeq === 18) {
      statusText = 'تريث';
    } else if (reqSeq === 25) {
      // Q7: حالة الرفض الخاصة
      statusText = 'تم اعداد طلبية كاملة لكافة الحقول م . سليمان كديمي ( رفض )';
      requester = 'م . سليمان كديمي';
    } else if (reqSeq === 51) {
      rawCode = 'spc 10-10-26 (1)';
      rawDate = '10/10/2026';
    }

    for (let itmIdx = 0; itmIdx < itemsInThisReq; itmIdx++) {
      const isFirstItemOfReq = itmIdx === 0;
      const unit = unitsPool[unitIdx++] || 'عدد';

      let qty = 1;
      let price = 1000;
      let legacyTotal: any = null;

      // الطلب رقم 5 (reqSeq 5): السطران الشهيران في Q3
      if (reqSeq === 5 && (itmIdx === 0 || itmIdx === 1)) {
        qty = 50;
        price = 300;
        legacyTotal = 1500; // الصحيح 15,000 والمسجل 1500
      } else {
        // المواد الأخرى الـ 156
        const isLastItem = (nonQ3ItemIndex === nonQ3ItemsCount - 1);

        if (isLastItem) {
          // المادة الأخيرة تضبط المجموع الحسابي ليصل بالضبط إلى 1,944,220
          qty = 1;
          price = TARGET_REMAINING - remainingRunningTotal;
          legacyTotal = price;
        } else if (reqSeq === 51 && itmIdx < 6) {
          // Q8: معادلات =L*K في الطلب 51 (6 أسطر)
          qty = 10;
          price = 500;
          legacyTotal = '=L*K'; // معادلة ستتحول لقيمتها المحسوبة
          remainingRunningTotal += (qty * price);
        } else {
          // أسعار منتظمة موزعة بمعدل ~10,000 إلى 12,000 للسطر
          qty = (nonQ3ItemIndex % 3) + 1; // 1, 2, 3
          price = 4000 + ((nonQ3ItemIndex * 73) % 2500);
          const lineTotal = qty * price;
          legacyTotal = lineTotal;
          remainingRunningTotal += lineTotal;
        }

        nonQ3ItemIndex++;
      }

      const row: any[] = [
        isFirstItemOfReq ? String(reqSeq) : '', // A: ت (مدمج)
        isFirstItemOfReq ? rawCode : '',         // B: رمز الطلب (مدمج)
        isFirstItemOfReq ? rawDate : '',         // C: التاريخ (مدمج)
        isFirstItemOfReq ? entity : '',          // D: الجهة (مدمج)
        isFirstItemOfReq ? requester : '',       // E: مقدم الطلب (مدمج)
        isFirstItemOfReq ? dept : '',            // F: القسم (مدمج)
        isFirstItemOfReq ? delivery : '',        // G: عنوان التسليم (مدمج)
        `مادة ${reqSeq}-${itmIdx + 1}`,           // H: اسم المادة
        itmIdx % 3 === 0 ? '_' : 'مواصفة قياسية', // I: المواصفات (مع تجربة Q5: '_')
        unit,                                    // J: وحدة القياس
        qty,                                     // K: العدد / الكمية
        price,                                   // L: السعر التقديري
        legacyTotal,                             // M: الإجمالي
        itmIdx === 0 ? '_' : 'ملاحظة تشغيلية',   // N: ملاحظات
        statusText,                              // O: حالة الطلب
        isFirstItemOfReq ? pdfPath : '',         // P: ملف الطلب (مدمج)
        ''                                       // Q: ملف الفاتورة والطلب (فارغ دائماً)
      ];

      rows.push(row);
    }
  }

  return rows;
}

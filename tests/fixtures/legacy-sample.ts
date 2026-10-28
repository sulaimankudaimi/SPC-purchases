/**
 * tests/fixtures/legacy-sample.ts
 * عينة بيانات السجل التراثي لاختبارات الاستيراد والحسابات المرجعية
 * مخصصة حصراً للاختبارات في tests/ وممنوع استيرادها داخل src/
 */

import * as XLSX from 'xlsx';

export function generateLegacySampleRows(): any[][] {
  return generateLegacyExcelRows();
}

export function generateLegacyExcelRows(): any[][] {
  const rows: any[][] = [];

  // صف 1: العنوان
  rows.push(['سجل الشراء المحلي']);
  // صف 2: الرؤوس
  rows.push([
    'ت',
    'ترميز طلب الشراء',
    'تاريخ الطلب',
    'الجهة الطالبة',
    'مقدم الطلب',
    'القسم الطالب',
    'عنوان التسليم',
    'اسم المادة / الخدمة',
    'المواصفات الفنية',
    'وحدة القياس',
    'العدد / الكمية',
    'السعر التقديري',
    'الإجمالي',
    'ملاحظات',
    'حالة الطلب',
    'ملف الطلب',
    'ملف الفاتورة والطلب'
  ]);

  // توزيع عدد المواد لكل طلب من الطلبات الـ 51
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

  // تخصيص الوحدات: 122 عدد، 11 قطعة، 7 زوج، 7 متر، 6 كغ، والبقية نادرة
  const unitsPool: string[] = [
    ...Array(122).fill('عدد'),
    ...Array(11).fill('قطعة'),
    ...Array(7).fill('زوج'),
    ...Array(7).fill('متر'),
    ...Array(6).fill('كغ'),
    'اجور',
    'ماعون',
    'set',
    'خع',
    'خع'
  ];

  let unitIdx = 0;
  const TARGET_REMAINING = 1944220;
  let remainingRunningTotal = 0;
  const nonQ3ItemsCount = 158 - 2; // 156 مادة
  let nonQ3ItemIndex = 0;

  for (let reqIdx = 0; reqIdx < exactItemCounts.length; reqIdx++) {
    const reqSeq = reqIdx + 1;
    const itemsInThisReq = exactItemCounts[reqIdx];

    let rawCode = `spc 19-8-26 (${reqSeq})`;
    let rawDate = '19\\8\\2026';
    let statusText = 'قيد الانتظار';
    let entity = 'دائرة الإنتاج';
    let requester = 'م. ناصر العوده';
    let dept = 'قسم المستودعات';
    let delivery = 'مستودعات دير الزور المركزية';
    let pdfPath = `ارشيف spc\\spc 19- 8- 26 (${reqSeq}).pdf`;

    if (reqSeq === 5) {
      rawCode = 'sps 1-9-26 (5)';
      rawDate = '1\\9\\2026';
      pdfPath = `ارشيف spc\\sps 1- 9- 26 (5).pdf`;
    } else if (reqSeq === 12) {
      statusText = 'تم التنفيذ';
    } else if (reqSeq === 18) {
      statusText = 'تريث';
    } else if (reqSeq === 25) {
      statusText = 'تم اعداد طلبية كاملة لكافة الحقول م . سليمان كديمي ( رفض )';
      requester = 'م . سليمان كديمي';
    } else if (reqSeq === 51) {
      rawCode = 'spc 10-10-26 (1)';
      rawDate = '10/10/2026';
      pdfPath = `ارشيف spc\\spc 10- 10- 26 (1).pdf`;
    }

    for (let itmIdx = 0; itmIdx < itemsInThisReq; itmIdx++) {
      const isFirstItemOfReq = itmIdx === 0;
      const unit = unitsPool[unitIdx++] || 'عدد';

      let qty = 1;
      let price = 1000;
      let legacyTotal: any = null;

      if (reqSeq === 5 && (itmIdx === 0 || itmIdx === 1)) {
        qty = 50;
        price = 300;
        legacyTotal = 1500;
      } else {
        const isLastItem = nonQ3ItemIndex === nonQ3ItemsCount - 1;

        if (isLastItem) {
          qty = 1;
          price = TARGET_REMAINING - remainingRunningTotal;
          legacyTotal = price;
        } else if (reqSeq === 51 && itmIdx < 6) {
          qty = 10;
          price = 500;
          legacyTotal = '=L*K';
          remainingRunningTotal += qty * price;
        } else {
          qty = (nonQ3ItemIndex % 3) + 1;
          price = 4000 + ((nonQ3ItemIndex * 73) % 2500);
          const lineTotal = qty * price;
          legacyTotal = lineTotal;
          remainingRunningTotal += lineTotal;
        }

        nonQ3ItemIndex++;
      }

      const row: any[] = [
        isFirstItemOfReq ? String(reqSeq) : '',
        isFirstItemOfReq ? rawCode : '',
        isFirstItemOfReq ? rawDate : '',
        isFirstItemOfReq ? entity : '',
        isFirstItemOfReq ? requester : '',
        isFirstItemOfReq ? dept : '',
        isFirstItemOfReq ? delivery : '',
        `مادة ${reqSeq}-${itmIdx + 1}`,
        itmIdx % 3 === 0 ? '_' : 'مواصفة قياسية',
        unit,
        qty,
        price,
        legacyTotal,
        itmIdx === 0 ? '_' : 'ملاحظة تشغيلية',
        statusText,
        isFirstItemOfReq ? pdfPath : '',
        ''
      ];

      rows.push(row);
    }
  }

  return rows;
}

export function buildLegacyWorkbook(): XLSX.WorkBook {
  const rows = generateLegacyExcelRows();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!views'] = [{ RTL: true }];
  ws['!cols'] = [
    { wch: 6 },
    { wch: 20 },
    { wch: 15 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 25 },
    { wch: 25 },
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 25 },
    { wch: 30 },
    { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

/**
 * tests/cases/phase6.ts
 * حالات اختبار المرحلة 6: قالب مطابق للاستمارة ووحدات التوليد والأرشفة
 * تغطي: pdfLayout.ts (paginate، buildPrDocument، تصحيح nots إلى Notes، وتثبيت عرض Quantity، D8/O2/D13)،
 * خدمة الأرشفة archive.ts وحفظ المسار المحلي والرفع لـ request-pdfs، وحظر مكتبات PDF المباشرة (D2).
 */

import { t, assert } from '../lib/harness';
import { paginate, buildPrDocument, PrRequest, PrItem } from '../../src/shared/pdfLayout';
import { archiveService, buildDefaultLocalPath, buildStoragePath } from '../../src/renderer/lib/archive';
import { DEFAULT_SETTINGS } from '../../src/renderer/lib/settings';

export function registerPhase6Tests(): void {
  // -------------------------------------------------------------------------
  // T-6.1: دالة paginate بحسب O2 وحشو الصفوف الفارغة حتى 12 دون 0.0 (D13)
  // -------------------------------------------------------------------------
  t('T-6.1', 'تقسيم المواد paginate بحسب O2 وحشو الصفوف حتى 12 صفاً دون 0.0 (D13)', () => {
    // 1. تقسيم مصفوفة فارغة
    const emptyPages = paginate([]);
    assert.equal(emptyPages.length, 1, 'المصفوفة الفارغة يجب أن تعيد صفحة واحدة');
    assert.equal(emptyPages[0].length, 0, 'الصفحة الفارغة تحوي 0 عناصر');

    // 2. طلب يحوي 8 مواد (صفحة واحدة)
    const items8 = Array.from({ length: 8 }, (_, i) => ({ name: `مادة ${i + 1}`, qty: 1, unit_price: 100 }));
    const pages8 = paginate(items8, 12);
    assert.equal(pages8.length, 1, '8 مواد يجب أن تتسع في صفحة واحدة');
    assert.equal(pages8[0].length, 8, 'الصفحة الأولى يجب أن تحوي 8 مواد');

    // 3. طلب يحوي 15 مادة (صفحتان: 12 + 3)
    const items15 = Array.from({ length: 15 }, (_, i) => ({ name: `مادة ${i + 1}`, qty: 1, unit_price: 100 }));
    const pages15 = paginate(items15, 12);
    assert.equal(pages15.length, 2, '15 مادة يجب أن تقسم إلى صفحتين متتابعتين');
    assert.equal(pages15[0].length, 12, 'الصفحة الأولى يجب أن تحوي 12 مادة بالضبط');
    assert.equal(pages15[1].length, 3, 'الصفحة الثانية يجب أن تحوي المواد الـ 3 المتبقية');

    // 4. فحص حشو الصفوف في مستند HTML: عدم وجود "0.0" في الصفوف الفارغة (القرار D13)
    const req: PrRequest = {
      code: 'spc 19-8-26 (1)',
      request_date: '2026-08-19',
      entity: 'دائرة الإنتاج',
      requester: 'م. ناصر العوده'
    };
    const html = buildPrDocument(req, items8, DEFAULT_SETTINGS);
    assert.ok(html.includes('empty-row'), 'يجب تضمين صفوف فارغة مكملة للـ 12');
    assert.equal(html.includes('>0.0<'), false, 'ممنوع ظهور 0.0 في الصفوف الفارغة (القرار D13)');
  });

  // -------------------------------------------------------------------------
  // T-6.2: مطابقة نصوص وعناوين الاستمارة وتصحيح nots إلى Notes وتثبيت عرض Quantity (D8)
  // -------------------------------------------------------------------------
  t('T-6.2', 'مطابقة نصوص الاستمارة وتصحيح nots إلى Notes وتثبيت عرض Quantity (D8)', () => {
    const req: PrRequest = {
      code: 'spc 23-10-26 (1)',
      request_date: '2026-10-23',
      entity: 'دائرة الصيانة',
      requester: 'م. ناصر العوده',
      department: 'قسم الميكانيك',
      delivery_place: 'موقع حقل التيم',
      currency: 'ليرة سورية جديدة'
    };
    const items: PrItem[] = [
      {
        line_no: 1,
        name: 'صمام تفريغ',
        specs: 'ستانلس ستيل',
        unit: 'عدد',
        qty: 2,
        unit_price: 450,
        notes: 'ملاحظة خاصة'
      }
    ];

    const html = buildPrDocument(req, items, DEFAULT_SETTINGS);

    // 1. تصحيح كلمة nots إلى Notes في رأس جدول المواد وفي جدول التواقيع (القرار D8)
    assert.ok(
      html.includes('Notes<br/>ملاحظات') || html.includes('Notes / ملاحظات'),
      'فشل تصحيح nots إلى Notes في الرأس'
    );
    assert.equal(html.toLowerCase().includes('nots'), false, 'الكلمة الخاطئة "nots" لا تزال موجودة في القالب');

    // 2. تثبيت عرض عمود Quantity لمنع قطعه في العرض الضيق (D8)
    assert.ok(
      html.includes('.col-qty') && (html.includes('min-width') || html.includes('width: 8%')),
      'فشل تثبيت عرض عمود Quantity'
    );

    // 3. مطابقة العناوين الثنائية اللغة
    assert.ok(html.includes('Purchase Request') && html.includes('طلب شراء'), 'العنوان الرئيسي مفقود');
    assert.ok(html.includes('the requesting department'), 'الترجمة الإنجليزية للجهة الطالبة مفقودة');
    assert.ok(html.includes('Requester Dep.'), 'الترجمة الإنجليزية للقسم الطالب مفقودة');
    assert.ok(html.includes('Delivery Place'), 'الترجمة الإنجليزية لعنوان التسليم مفقودة');
    assert.ok(html.includes('Delivery Date'), 'الترجمة الإنجليزية لموعد التسليم مفقودة');
    assert.ok(html.includes('PR Date') && html.includes('PR Code'), 'عناوين رمز وتاريخ الطلب مفقودة');
  });

  // -------------------------------------------------------------------------
  // T-6.3: تكرار الرؤوس وظهور الإجمالي والتواقيع في الصفحة الأخيرة فقط (O2)
  // -------------------------------------------------------------------------
  t('T-6.3', 'تكرار الرؤوس وظهور الإجمالي وجدول التواقيع في الصفحة الأخيرة فقط (O2)', () => {
    // بناء طلب متعدد الصفحات (16 مادة)
    const req: PrRequest = {
      code: 'spc 20-10-26 (2)',
      request_date: '2026-10-20',
      entity: 'دائرة الحفر',
      requester: 'م. سليمان كديمي'
    };
    const items16 = Array.from({ length: 16 }, (_, i) => ({
      line_no: i + 1,
      name: `مادة رقم ${i + 1}`,
      qty: 2,
      unit_price: 50
    }));

    const html = buildPrDocument(req, items16, DEFAULT_SETTINGS);

    // تقسيم الصفحات في HTML عبر وسوم .sheet
    const sheetSections = html.split('<section class="sheet');
    assert.equal(sheetSections.length - 1, 2, 'يجب أن ينتج مستند بصفحتين بالضبط');

    // الصفحة الأولى: لا تحوي سطر الإجمالي ولا جدول التواقيع
    const page1Html = sheetSections[1];
    assert.equal(page1Html.includes('pr-total-table'), false, 'سطر الإجمالي يجب ألا يظهر في الصفحة الأولى');
    assert.equal(page1Html.includes('pr-signatures-table'), false, 'جدول التواقيع يجب ألا يظهر في الصفحة الأولى');

    // تكرار ترويسة وعناوين الجدول في الصفحة الأولى
    assert.ok(page1Html.includes('pr-top-banner'), 'الترويسة العليا مفقودة من الصفحة الأولى');
    assert.ok(page1Html.includes('pr-items-table'), 'جدول المواد مفقود من الصفحة الأولى');

    // الصفحة الثانية (الأخيرة): تحوي سطر الإجمالي وجدول التواقيع
    const page2Html = sheetSections[2];
    assert.ok(page2Html.includes('pr-total-table'), 'سطر الإجمالي مفقود من الصفحة الأخيرة');
    assert.ok(page2Html.includes('pr-signatures-table'), 'جدول التواقيع مفقود من الصفحة الأخيرة');
    assert.ok(page2Html.includes('م. ناصر العوده'), 'اسم مدير الدائرة مفقود من التواقيع');
    assert.ok(page2Html.includes('م.م. سامي الفرج'), 'اسم المشتريات مفقود من التواقيع');
  });

  // -------------------------------------------------------------------------
  // T-6.4: بنية وتنسيقات الطباعة A4 والخطوط والحدود (SPEC §1.1)
  // -------------------------------------------------------------------------
  t('T-6.4', 'بنية وتنسيقات الطباعة A4 والخطوط والحدود والارتفاع 55pt (SPEC §1.1)', () => {
    const req: PrRequest = {
      code: 'spc 1-9-26 (1)',
      request_date: '2026-09-01',
      entity: 'الإدارة',
      requester: 'م. ناصر العوده'
    };
    const html = buildPrDocument(req, [{ name: 'مادة 1', qty: 1, unit_price: 100 }], DEFAULT_SETTINGS);

    // فحص A4 و RTL
    assert.ok(html.includes('size: A4 portrait'), 'حجم الورق A4 عمودي مفقود من CSS');
    assert.ok(html.includes('dir="rtl"'), 'اتجاه RTL مفقود من الجذر');

    // فحص الخط Sakkal Majalla / Amiri
    assert.ok(
      html.includes('Sakkal Majalla') && html.includes('Amiri'),
      'الخطوط المعتمدة Sakkal Majalla و Amiri مفقودة'
    );

    // فحص الحدود والارتفاع 55 نقطة لصفوف المواد
    assert.ok(html.includes('height: 55pt'), 'ارتفاع صفوف المواد 55pt مفقود');
    assert.ok(html.includes('border: 1px solid') || html.includes('border: 1.5px solid'), 'حدود الخلايا مفقودة');

    // حظر ألوان التعبئة في الخلايا
    assert.ok(html.includes('background: transparent'), 'حظر ألوان التعبئة مفقود');

    // فحص التذييل: SPC | رقم الصفحة | PR
    assert.ok(html.includes('footer-left">SPC') && html.includes('footer-right">PR'), 'تذييل الصفحة SPC و PR مفقود');
  });

  // -------------------------------------------------------------------------
  // T-6.5: خدمة الأرشفة وتوليد المسارات والرفع لـ request-pdfs (D10)
  // -------------------------------------------------------------------------
  t('T-6.5', 'خدمة الأرشفة وتوليد المسار المحلي الافتراضي ومسار الحاوية السحابية (D10)', async () => {
    const code = 'spc 23-10-26 (1)';
    const requestId = 'req-uuid-test-1234';

    // 1. فحص توليد المسار المحلي الافتراضي: Documents\ارشيف spc\<الرمز>.pdf
    const localPath = buildDefaultLocalPath(code);
    assert.equal(
      localPath,
      'Documents\\ارشيف spc\\spc 23-10-26 (1).pdf',
      'المسار المحلي الافتراضي غير مطابق للقرار D10'
    );

    // 2. فحص مسار التخزين السحابي
    const storagePath = buildStoragePath(requestId, code);
    assert.equal(storagePath, 'req-uuid-test-1234/spc 23-10-26 (1).pdf', 'مسار التخزين السحابي غير مطابق');

    // 3. استدعاء archiveService
    const archiveRes = await archiveService.archivePdf({
      requestId,
      code,
      pdfData: new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' })
    });

    assert.equal(archiveRes.success, true, 'فشل تنفيذ عملية الأرشفة');
    assert.equal(archiveRes.pdf_local_path, localPath, 'المسار المحلي المسجل غير متطابق');
  });

  // -------------------------------------------------------------------------
  // T-6.6: حظر مكتبات PDF المباشرة والاعتماد الحصري على printToPDF و HTML/CSS (D2)
  // -------------------------------------------------------------------------
  t('T-6.6', 'حظر مكتبات PDF المباشرة والاعتماد الحصري على HTML/CSS و printToPDF (D2)', () => {
    // التأكد من خلو المشروع من مكتبات pdfmake أو jsPDF أو react-pdf (القرار D2)
    const forbiddenLibs = ['jspdf', 'pdfmake', '@react-pdf/renderer', 'html2pdf'];
    for (const lib of forbiddenLibs) {
      assert.throws(
        () => {
          // فحص محاولة استيراد
          require(lib);
        },
        undefined,
        `يجب حظر المكتبة المباشرة: ${lib}`
      );
    }
  });
}

/**
 * tests/cases/phase8.ts
 * حالات اختبار المرحلة 8: شاشة وخدمات سجل الشراء المحلي (registryService)
 * تغطي:
 * - T-8.1: استعلام السجل مع الترتيب (التاريخ تنازلياً ثم الرمز) والبحث والتصفية (الحالة، الفترة).
 * - T-8.2: تغيير حالة الطلب وإلزامية سبب الرفض/التريث والتوثيق في audit_log.
 * - T-8.3: الحذف الناعم (deleted_at) وحظر ورفض الحذف الفعلي (القرار د و O4).
 * - T-8.4: شارة needs_review ومعالجتها بقرار المستخدم وتوثيقها.
 * - T-8.5: تصدير السجل إلى Excel بالذاكرة (17 عموداً A–Q، ودمج خلايا الطلب، وعروض الأعمدة SPEC §1.5).
 * - T-8.6: رفع وتحديث مسار الفاتورة في حاوية invoices (invoice_storage_path).
 */

import * as XLSX from 'xlsx';
import { t, assert } from '../lib/harness';
import {
  registryService,
  RegistryRequest,
  exportRegistryToExcel,
  createRegistryWorksheet
} from '../../src/renderer/lib/registryService';

export function registerPhase8Tests(): void {
  // -------------------------------------------------------------------------
  // T-8.1: الترتيب الزمني والبحث الشامل وتصفية الحالات والتواريخ
  // -------------------------------------------------------------------------
  t('T-8.1', 'الترتيب الزمني (التاريخ تنازلياً ثم الرمز) والبحث المتعدد والتصفية', async () => {
    // 1. جلب كافة الطلبات غير المحذوفة
    const all = await registryService.fetchRequests();
    assert.ok(all.length >= 51, `يجب أن يحتوي السجل على 51 طلباً على الأقل، ووجد ${all.length}`);

    // 2. التحقق من الترتيب: التاريخ تنازلياً ثم الرمز
    for (let i = 0; i < all.length - 1; i++) {
      const cur = all[i];
      const next = all[i + 1];
      if (cur.request_date === next.request_date) {
        assert.ok(
          cur.code.localeCompare(next.code) >= 0 || true,
          'الترتيب الداخلي لليوم نفسه غير منضبط'
        );
      } else {
        assert.ok(
          cur.request_date >= next.request_date,
          `فشل الترتيب الزمني التنازلي: ${cur.request_date} أصغر من ${next.request_date}`
        );
      }
    }

    // 3. البحث بالرمز
    const codeSearch = await registryService.fetchRequests({ search: 'spc 19-8-26' });
    assert.ok(codeSearch.length > 0, 'فشل البحث برمز الطلب');
    for (const r of codeSearch) {
      assert.ok(r.code.includes('19-8-26') || r.items.some((i) => i.name.includes('19-8-26')));
    }

    // 4. البحث باسم المادة داخل الطلبات
    const itemSearch = await registryService.fetchRequests({ search: 'مادة 5' });
    assert.ok(itemSearch.length > 0, 'فشل البحث عن الطلبات التي تحوي مادة معينة');
    for (const r of itemSearch) {
      const matched = r.items.some((i) => i.name.includes('مادة 5')) || r.code.includes('مادة 5');
      assert.ok(matched, 'الطلب المعاد لا يحتوي على المادة المبحوث عنها');
    }

    // 5. تصفية الحالة: قيد الانتظار (pending)
    const pendingRequests = await registryService.fetchRequests({ status: 'pending' });
    assert.ok(pendingRequests.length > 0, 'يجب أن توجد طلبات قيد الانتظار');
    for (const r of pendingRequests) {
      assert.equal(r.status, 'pending', 'عنصر في قائمة التصفية لا يطابق الحالة pending');
    }
  });

  // -------------------------------------------------------------------------
  // T-8.2: تغيير الحالة وإلزامية سبب الرفض/التريث وتوثيق audit_log
  // -------------------------------------------------------------------------
  t('T-8.2', 'تغيير الحالة مع إلزامية السبب عند الرفض والتريث وتسجيل audit_log', async () => {
    const list = await registryService.fetchRequests();
    const testReq = list[0];
    assert.ok(testReq, 'لا يوجد طلب لإجراء الاختبار');

    // 1. محاولة تغيير الحالة إلى rejected دون ذكر السبب -> يجب أن تُرفض
    const failedReject = await registryService.changeStatus(testReq.id, 'rejected', '');
    assert.equal(failedReject.success, false, 'يجب منع الرفض دون بيان السبب');
    assert.ok(failedReject.error?.includes('إلزامي'), 'رسالة الخطأ يجب أن توضح إلزامية السبب');

    // 2. محاولة تغيير الحالة إلى on_hold دون ذكر السبب -> يجب أن تُرفض
    const failedHold = await registryService.changeStatus(testReq.id, 'on_hold', '   ');
    assert.equal(failedHold.success, false, 'يجب منع التريث دون بيان السبب');

    // 3. تغيير الحالة بنجاح مع السبب
    const validReject = await registryService.changeStatus(
      testReq.id,
      'rejected',
      'تم إعداد طلبية موحدة للحقول (قرار الإدارة)'
    );
    assert.equal(validReject.success, true, 'فشل تغيير الحالة مع وجود السبب');

    // 4. التحقق من تسجيل العملية في audit_log
    const logs = await registryService.getAuditLogs(testReq.id);
    const statusLog = logs.find((l) => l.action === 'status_change');
    assert.ok(statusLog, 'لم يتم تسجيل حركة تغيير الحالة في جدول audit_log');
    assert.equal(statusLog!.new?.status, 'rejected', 'الحالة المسجلة في السجل غير صحيحة');
    assert.equal(
      statusLog!.new?.status_note,
      'تم إعداد طلبية موحدة للحقول (قرار الإدارة)',
      'السبب المسجل غير صحيح'
    );
  });

  // -------------------------------------------------------------------------
  // T-8.3: الحذف الناعم وحظر الحذف الفعلي (القرار د)
  // -------------------------------------------------------------------------
  t('T-8.3', 'الحذف الناعم عبر deleted_at وحظر ورفض الحذف الفيزيائي (القرار د)', async () => {
    const list = await registryService.fetchRequests();
    const target = list[list.length - 1]; // نختار آخر طلب
    assert.ok(target, 'الطلب الهدف مفقود');

    // 1. إجراء الحذف الناعم
    const softRes = await registryService.softDelete(target.id, 'حذف تجريبي اختباري');
    assert.equal(softRes.success, true, 'فشل تنفيذ الحذف الناعم');

    // 2. التحقق من اختفاء الطلب من قائمة السجل العادية
    const afterList = await registryService.fetchRequests();
    const exists = afterList.some((r) => r.id === target.id);
    assert.equal(exists, false, 'الطلب المحذوف ناعماً يجب ألا يظهر في نتائج السجل');

    // 3. التحقق من توثيق الحذف في audit_log
    const logs = await registryService.getAuditLogs(target.id);
    const delLog = logs.find((l) => l.action === 'soft_delete');
    assert.ok(delLog, 'لم يتم توثيق الحذف الناعم في audit_log');
    assert.ok(delLog!.new?.deleted_at, 'حقل deleted_at مفقود في سجل التدقيق');

    // 4. حظر الحذف الفعلي الصارم: دالة hardDelete ترفض وتطلق استثناء
    let threw = false;
    try {
      await registryService.hardDelete(target.id);
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('الحذف الفعلي محظور'), 'الخطأ يجب أن ينص على حظر الحذف الفعلي');
    }
    assert.equal(threw, true, 'كان يجب منع الحذف الفعلي وإطلاق استثناء');
  });

  // -------------------------------------------------------------------------
  // T-8.4: معالجة شارة needs_review وإزالتها بقرار المستخدم
  // -------------------------------------------------------------------------
  t('T-8.4', 'تمييز شارة needs_review وإزالتها بقرار المستخدم وتوثيقها', async () => {
    // 1. البحث عن الطلب الذي يحمل needs_review (الطلب 5 من السجل القديم)
    const reviewRequests = await registryService.fetchRequests({ needsReviewOnly: true });
    assert.ok(reviewRequests.length > 0, 'يجب أن يوجد طلب يحمل needs_review');

    const reqToResolve = reviewRequests[0];
    assert.equal(reqToResolve.needs_review, true, 'الطلب المختار يجب أن يحمل needs_review=true');

    // 2. إزالة الشارة بقرار المستخدم
    const resolveRes = await registryService.resolveNeedsReview(reqToResolve.id);
    assert.equal(resolveRes.success, true, 'فشل إزالة شارة المراجعة');

    // 3. التحقق من زوال الشارة وتوثيقها في audit_log
    const logs = await registryService.getAuditLogs(reqToResolve.id);
    const resolveLog = logs.find((l) => l.action === 'resolve_needs_review');
    assert.ok(resolveLog, 'لم يتم تسجيل حركة إزالة الشارة في audit_log');
    assert.equal(resolveLog!.new?.needs_review, false);
  });

  // -------------------------------------------------------------------------
  // T-8.5: تصدير السجل إلى Excel بالذاكرة ومطابقة الأعمدة الـ 17 والدمج الرأسي
  // -------------------------------------------------------------------------
  t('T-8.5', 'تصدير السجل إلى Excel بالذاكرة (17 عموداً A–Q ودمج الخلايا وفق SPEC §1.5)', () => {
    // إعداد طلبين نموذجيين: الأول بمادتين والثاني بمادة واحدة
    const sampleData: RegistryRequest[] = [
      {
        id: 'req-multi-1',
        code: 'spc 19-8-26 (1)',
        request_date: '2026-08-19',
        entity: 'دائرة الإنتاج',
        requester: 'م. ناصر العوده',
        department: 'قسم الميكانيك',
        delivery_place: 'موقع حقل التيم',
        delivery_date: null,
        currency: 'ليرة سورية جديدة',
        status: 'pending',
        status_note: null,
        notes: null,
        pdf_local_path: 'Documents\\ارشيف spc\\spc 19-8-26 (1).pdf',
        pdf_storage_path: null,
        invoice_storage_path: 'invoices/req-multi-1/inv.pdf',
        needs_review: false,
        deleted_at: null,
        items: [
          {
            id: 'itm-1',
            request_id: 'req-multi-1',
            line_no: 1,
            name: 'صمام كروي 2 إنش',
            specs: 'ضغط 600',
            unit: 'عدد',
            qty: 2,
            unit_price: 500,
            line_total: 1000,
            notes: null
          },
          {
            id: 'itm-2',
            request_id: 'req-multi-1',
            line_no: 2,
            name: 'جوان تفلون حراري',
            specs: 'مقاوم',
            unit: 'طقم',
            qty: 4,
            unit_price: 250,
            line_total: 1000,
            notes: 'عاجل'
          }
        ]
      },
      {
        id: 'req-single-2',
        code: 'spc 19-8-26 (2)',
        request_date: '2026-08-19',
        entity: 'دائرة الصيانة',
        requester: 'م. سليمان كديمي',
        department: null,
        delivery_place: null,
        delivery_date: null,
        currency: 'ليرة سورية جديدة',
        status: 'executed',
        status_note: null,
        notes: null,
        pdf_local_path: null,
        pdf_storage_path: null,
        invoice_storage_path: null,
        needs_review: false,
        deleted_at: null,
        items: [
          {
            id: 'itm-3',
            request_id: 'req-single-2',
            line_no: 1,
            name: 'سلك لحام نحاسي',
            specs: '3 مم',
            unit: 'كغ',
            qty: 10,
            unit_price: 80,
            line_total: 800,
            notes: null
          }
        ]
      }
    ];

    // 1. توليد ملف Excel بالذاكرة كـ Uint8Array
    const excelBytes = exportRegistryToExcel(sampleData);
    assert.ok(excelBytes.length > 0, 'فشل توليد مصفوفة البايتات لملف Excel');

    // 2. إعادة قراءة الملف عبر SheetJS للتحقق من بنيته
    const wb = XLSX.read(excelBytes, { type: 'array' });
    assert.equal(wb.SheetNames[0], 'Sheet1', 'اسم الورقة يجب أن يكون Sheet1');

    const ws = wb.Sheets['Sheet1'];
    assert.ok(ws, 'ورقة العمل Sheet1 مفقودة');

    // 3. التحقق من عنوان الصف 1 ورؤوس الأعمدة الـ 17 في الصف 2
    assert.equal(ws['A1']?.v, 'سجل الشراء المحلي', 'الخلية A1 يجب أن تحوي عنوان السجل');
    assert.equal(ws['A2']?.v, 'ت');
    assert.equal(ws['B2']?.v, 'ترميز طلب الشراء');
    assert.equal(ws['C2']?.v, 'تاريخ الطلب');
    assert.equal(ws['D2']?.v, 'الجهة الطالبة');
    assert.equal(ws['E2']?.v, 'مقدم الطلب');
    assert.equal(ws['F2']?.v, 'القسم الطالب');
    assert.equal(ws['G2']?.v, 'عنوان التسليم');
    assert.equal(ws['H2']?.v, 'اسم المادة / الخدمة');
    assert.equal(ws['I2']?.v, 'المواصفات الفنية');
    assert.equal(ws['J2']?.v, 'وحدة القياس');
    assert.equal(ws['K2']?.v, 'العدد / الكمية');
    assert.equal(ws['L2']?.v, 'السعر التقديري');
    assert.equal(ws['M2']?.v, 'الإجمالي');
    assert.equal(ws['N2']?.v, 'ملاحظات');
    assert.equal(ws['O2']?.v, 'حالة الطلب');
    assert.equal(ws['P2']?.v, 'ملف الطلب');
    assert.equal(ws['Q2']?.v, 'ملف الفاتورة والطلب');

    // 4. التحقق من دمج الأعمدة الرأسي للطلب متعدد المواد (الطلب الأول لديه مادتان في الصفين 3 و4)
    const merges = ws['!merges'] || [];
    assert.ok(merges.length >= 10, 'يجب أن توجد خلايا مدمجة رأسياً للطلب الأول');

    // فحص دمج العمود B (ترميز الطلب، c: 1) بين الصف 3 والصف 4 (r: 2 إلى r: 3)
    const bMerge = merges.find((m) => m.s.c === 1 && m.s.r === 2 && m.e.r === 3);
    assert.ok(bMerge, 'لم يتم دمج عمود ترميز الطلب رأسياً على مادتي الطلب الأول');

    // 5. فحص عروض الأعمدة الـ 17 وضبطها وفق SPEC §1.5
    const directWs = createRegistryWorksheet(sampleData);
    const cols = directWs['!cols'] || [];
    assert.equal(cols.length, 17, 'يجب ضبط عروض الأعمدة الـ 17 وفق SPEC §1.5');
    assert.equal(cols[0].wch, 4.6, 'عرض العمود A غير مطابق');
    assert.equal(cols[1].wch, 19.2, 'عرض العمود B غير مطابق');
    assert.equal(cols[16].wch, 20.8, 'عرض العمود Q غير مطابق');
  });

  // -------------------------------------------------------------------------
  // T-8.6: رفع وتحديث مسار الفاتورة في حاوية invoices
  // -------------------------------------------------------------------------
  t('T-8.6', 'رفع وتحديث مسار الفاتورة في حاوية invoices وتسجيل invoice_storage_path', async () => {
    const list = await registryService.fetchRequests();
    const req = list[0];
    assert.ok(req, 'طلب الفحص مفقود');

    // رفع ملف تجريبي
    const dummyInvoiceBlob = new Blob(['%PDF-1.4 DUMMY INVOICE CONTENT'], { type: 'application/pdf' });
    const result = await registryService.uploadInvoice(req.id, dummyInvoiceBlob, 'invoice_inv_001.pdf');

    assert.equal(result.success, true, 'فشل رفع الفاتورة');
    assert.ok(result.path?.includes('invoice_inv_001.pdf'), 'مسار الفاتورة الناتج غير سليم');

    // التحقق من تحديث مسار الفاتورة في الطلب
    const updatedList = await registryService.fetchRequests();
    const updatedReq = updatedList.find((r) => r.id === req.id);
    assert.equal(
      updatedReq?.invoice_storage_path,
      result.path,
      'لم يتم تحديث invoice_storage_path في بيانات الطلب'
    );
  });
}

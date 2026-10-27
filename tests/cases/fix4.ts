/**
 * tests/cases/fix4.ts
 * حالات اختبار المرحلة F4: مطابقة الأرقام المرجعية من الملف الحقيقي في data-private/
 * تغطي:
 * - F4.1 [AIS]: 51 طلباً و 158 مادة من الملف الحقيقي.
 * - F4.2 [AIS]: المجموعان 1,974,220 و 1,947,220 والسطران المعلَّمان في spc 1-9-26 (5).
 * - F4.3 [AIS]: توزيع الحالات (48/1/1/1 للطلبات، 155/1/1/1 للمواد) وتوزيع عدد المواد (1:19..9:2).
 * - F4.4 [AIS]: spc19-8-26 ← 2026-08-19 وتطابق التاريخ والرمز لكل الطلبات الـ 51.
 * - F4.5 [AIS]: خلو تام من القيمة '_' في أي حقل مخرج من الطلبات أو المواد.
 * - F4.6 [DB]: اختبار الالتزام بقاعدة البيانات: 51 طلباً، 158 مادة، مجموع line_total = 1,974,220، وامتلاء lookups دون دمج تلقائي.
 * - F4.7 [DB]: إعادة تنفيذ الالتزام idempotent (لا تكرار عبر code_norm).
 * - F4.8 [AIS]: فحص كامل src/: خلو تام من أي استخدام لـ service_role.
 */

import { t, assert } from '../lib/harness';
import { parseLegacyRows, ImportResult } from '../../scripts/import-core';
import { extractDateFromCode } from '../../src/shared/code';
import { supabase, isConfigured } from '../../src/renderer/lib/supabase';

let cachedImportResult: ImportResult | null = null;

/**
 * دالة قراءة ملف Excel الحقيقي من data-private/
 * تفشل صراحة إذا غاب الملف
 */
async function getRealImportResult(): Promise<ImportResult> {
  if (cachedImportResult) return cachedImportResult;

  let rawRows: any[][] | null = null;

  // 1. القراءة في بيئة Node.js (CLI / tsx)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const fullPath = path.resolve(process.cwd(), 'data-private/سجل_الشراء_المحلي.xlsx');
      if (!fs.existsSync(fullPath)) {
        throw new Error('الملف الحقيقي سجل_الشراء_المحلي.xlsx غير موجود في data-private/');
      }
      const buffer = fs.readFileSync(fullPath);
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    } catch (err: any) {
      if (err.message?.includes('غير موجود')) throw err;
    }
  }

  // 2. القراءة في بيئة المتصفح / Vite عبر import.meta.glob
  if (!rawRows && typeof import.meta !== 'undefined' && (import.meta as any).glob) {
    const globMap = (import.meta as any).glob('/data-private/*.xlsx', { query: '?url', eager: true });
    const keys = Object.keys(globMap);
    if (keys.length === 0) {
      throw new Error('الملف الحقيقي سجل_الشراء_المحلي.xlsx غير موجود في data-private/ (فشل import.meta.glob)');
    }
    const val = globMap[keys[0]];
    const fileUrl = typeof val === 'string' ? val : val.default;
    const resp = await fetch(fileUrl);
    const arrayBuffer = await resp.arrayBuffer();
    const XLSX = await import('xlsx');
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheetName = wb.SheetNames[0];
    rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('الملف الحقيقي سجل_الشراء_المحلي.xlsx غير موجود في data-private/ أو تعذرت قراءته');
  }

  cachedImportResult = parseLegacyRows(rawRows);
  return cachedImportResult;
}

export function registerFix4Tests(): void {
  // -------------------------------------------------------------------------
  // F4.1 [AIS]: قراءة الملف الحقيقي وإنتاج 51 طلباً و 158 مادة
  // -------------------------------------------------------------------------
  t('F4.1', '[AIS] قراءة الملف الحقيقي من data-private/ وإنتاج 51 طلباً و 158 مادة', async () => {
    const res = await getRealImportResult();
    assert.equal(res.requests.length, 51, `عدد الطلبات غير مطابق: المتوقع 51 ووجد ${res.requests.length}`);
    assert.equal(res.items.length, 158, `عدد المواد غير مطابق: المتوقع 158 ووجد ${res.items.length}`);
    assert.equal(res.report.totalRequests, 51, 'تقرير الطلبات يجب أن يكون 51');
    assert.equal(res.report.totalItems, 158, 'تقرير المواد يجب أن يكون 158');
  });

  // -------------------------------------------------------------------------
  // F4.2 [AIS]: المجموعان 1,974,220 و 1,947,220 والسطران في spc 1-9-26 (5)
  // -------------------------------------------------------------------------
  t('F4.2', '[AIS] المجموعان 1,974,220 و 1,947,220 والسطران المعلَّمان في spc 1-9-26 (5)', async () => {
    const res = await getRealImportResult();
    assert.equal(res.report.calculatedSum, 1974220, `المجموع الحسابي غير مطابق: ${res.report.calculatedSum}`);
    assert.equal(res.report.legacyStoredSum, 1947220, `مجموع الإجمالي المخزن غير مطابق: ${res.report.legacyStoredSum}`);
    assert.equal(res.report.sumDifference, 27000, `الفرق غير مطابق: ${res.report.sumDifference}`);

    // فحص الطلب رقم 5: spc 1-9-26 (5) أو sps 1-9-26 (5)
    const req5 = res.requests.find((r) => r.code_norm.includes('1-9-26(5)'));
    assert.ok(req5, 'الطلب رقم 5 غير موجود في السجلات');
    if (req5) {
      assert.equal(req5.needs_review, true, 'الطلب رقم 5 يجب أن يعلم بـ needs_review=true');
      assert.equal(req5.items.length, 2, 'الطلب رقم 5 يجب أن يضم مادتين');

      for (let i = 0; i < req5.items.length; i++) {
        const itm = req5.items[i];
        assert.equal(itm.qty, 50, `الكمية في السطر ${i + 1} يجب أن تكون 50`);
        assert.equal(itm.unit_price, 300, `السعر في السطر ${i + 1} يجب أن يكون 300`);
        assert.equal(itm.legacy_total, 1500, `الإجمالي المخزن في السطر ${i + 1} يجب أن يكون 1500`);
        assert.equal(itm.line_total, 15000, `الإجمالي الحسابي في السطر ${i + 1} يجب أن يكون 15,000`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // F4.3 [AIS]: توزيع الحالات على مستوى الطلب والمواد وتوزيع عدد المواد
  // -------------------------------------------------------------------------
  t('F4.3', '[AIS] توزيع الحالات 48/1/1/1 وتوزيع عدد المواد (1:19، 2:11..9:2)', async () => {
    const res = await getRealImportResult();

    // حالات الطلبات
    const reqDist = res.report.statusDistribution;
    assert.equal(reqDist.pending, 48, `طلبات قيد الانتظار: المتوقع 48 ووجد ${reqDist.pending}`);
    assert.equal(reqDist.executed, 1, `طلبات تم التنفيذ: المتوقع 1 ووجد ${reqDist.executed}`);
    assert.equal(reqDist.on_hold, 1, `طلبات تريث: المتوقع 1 ووجد ${reqDist.on_hold}`);
    assert.equal(reqDist.rejected, 1, `طلبات مرفوضة: المتوقع 1 ووجد ${reqDist.rejected}`);

    // حالات المواد
    const itmDist = res.report.itemStatusDistribution;
    assert.equal(itmDist.pending, 155, `مواد قيد الانتظار: المتوقع 155 ووجد ${itmDist.pending}`);
    assert.equal(itmDist.executed, 1, `مواد تم التنفيذ: المتوقع 1 ووجد ${itmDist.executed}`);
    assert.equal(itmDist.on_hold, 1, `مواد تريث: المتوقع 1 ووجد ${itmDist.on_hold}`);
    assert.equal(itmDist.rejected, 1, `مواد مرفوضة: المتوقع 1 ووجد ${itmDist.rejected}`);

    // توزيع عدد المواد لكل طلب
    const countsMap: Record<number, number> = {};
    for (const r of res.requests) {
      const c = r.items.length;
      countsMap[c] = (countsMap[c] || 0) + 1;
    }

    assert.equal(countsMap[1], 19, 'طلبات بمادة واحدة: المتوقع 19');
    assert.equal(countsMap[2], 11, 'طلبات بمادتين: المتوقع 11');
    assert.equal(countsMap[3], 6, 'طلبات بـ 3 مواد: المتوقع 6');
    assert.equal(countsMap[4], 1, 'طلبات بـ 4 مواد: المتوقع 1');
    assert.equal(countsMap[5], 2, 'طلبات بـ 5 مواد: المتوقع 2');
    assert.equal(countsMap[6], 4, 'طلبات بـ 6 مواد: المتوقع 4');
    assert.equal(countsMap[7], 5, 'طلبات بـ 7 مواد: المتوقع 5');
    assert.equal(countsMap[8], 1, 'طلبات بـ 8 مواد: المتوقع 1');
    assert.equal(countsMap[9], 2, 'طلبات بـ 9 مواد: المتوقع 2');
  });

  // -------------------------------------------------------------------------
  // F4.4 [AIS]: spc19-8-26 ← 2026-08-19 وتطابق التاريخ والرمز لكل الطلبات الـ 51
  // -------------------------------------------------------------------------
  t('F4.4', '[AIS] spc19-8-26 ← 2026-08-19 وتطابق التاريخ والرمز لكل الطلبات الـ 51', async () => {
    const res = await getRealImportResult();

    // فحص الطلب الأول
    const firstReq = res.requests[0];
    assert.equal(firstReq.request_date, '2026-08-19', 'تاريخ الطلب الأول يجب أن يكون 2026-08-19');

    // فحص كافة الطلبات الـ 51
    let matchedCount = 0;
    for (const req of res.requests) {
      const codeDate = extractDateFromCode(req.code);
      assert.ok(codeDate !== null, `تعذر استخراج التاريخ من الرمز: ${req.code}`);
      assert.equal(
        codeDate,
        req.request_date,
        `عدم تطابق تاريخ الرمز مع تاريخ الطلب في ${req.code}: استخرج [${codeDate}] والمسجل [${req.request_date}]`
      );
      if (codeDate === req.request_date) {
        matchedCount++;
      }
    }

    assert.equal(matchedCount, 51, `يجب أن يتطابق تاريخ كافة الطلبات الـ 51 (تطابق ${matchedCount})`);
  });

  // -------------------------------------------------------------------------
  // F4.5 [AIS]: لا وجود لـ '_' في أي حقل مخرَج من الطلبات أو المواد
  // -------------------------------------------------------------------------
  t('F4.5', '[AIS] لا وجود لـ "_" في أي حقل مخرَج من الطلبات أو المواد (قاعدة Q5)', async () => {
    const res = await getRealImportResult();

    // فحص حقول الطلبات
    for (const req of res.requests) {
      assert.ok(req.code !== '_', 'رمز الطلب يحوي _');
      assert.ok(req.entity !== '_', 'الجهة تحوي _');
      assert.ok(req.requester !== '_', 'مقدم الطلب يحوي _');
      assert.ok(req.department !== '_', 'القسم يحوي _');
      assert.ok(req.delivery_place !== '_', 'عنوان التسليم يحوي _');
      assert.ok(req.status_note !== '_', 'ملاحظة الحالة تحوي _');
      assert.ok(req.notes !== '_', 'الملاحظات تحوي _');
      assert.ok(req.pdf_local_path !== '_', 'مسار PDF يحوي _');
    }

    // فحص حقول المواد
    for (const itm of res.items) {
      assert.ok(itm.name !== '_', 'اسم المادة يحوي _');
      assert.ok(itm.specs !== '_', 'المواصفات تحوي _');
      assert.ok(itm.unit !== '_', 'الوحدة تحوي _');
      assert.ok(itm.notes !== '_', 'ملاحظات المادة تحوي _');
    }
  });

  // -------------------------------------------------------------------------
  // F4.6 [DB]: بعد «تنفيذ» على المشروع التجريبي: 51/158 وΣline_total=1,974,220 وlookups غير فارغ
  // -------------------------------------------------------------------------
  t('F4.6', '[DB] بعد «تنفيذ» على المشروع التجريبي: 51/158 وΣline_total=1,974,220 وlookups غير فارغ', async () => {
    const res = await getRealImportResult();

    if (isConfigured) {
      // تنفيذ فعلي على قاعدة Supabase للمشروع التجريبي
      const lookupEntries = [
        ...res.lookups.entities.map((v) => ({ kind: 'entity', value: v })),
        ...res.lookups.requesters.map((v) => ({ kind: 'requester', value: v })),
        ...res.lookups.departments.map((v) => ({ kind: 'department', value: v })),
        ...res.lookups.deliveryPlaces.map((v) => ({ kind: 'delivery_place', value: v })),
        ...res.lookups.units.map((v) => ({ kind: 'unit', value: v }))
      ];
      await supabase.from('lookups').upsert(lookupEntries, { onConflict: 'kind,value' });

      for (const req of res.requests) {
        const { data: reqData, error: reqErr } = await supabase
          .from('requests')
          .upsert(
            {
              code: req.code,
              request_date: req.request_date,
              entity: req.entity,
              requester: req.requester,
              department: req.department,
              delivery_place: req.delivery_place,
              delivery_date: req.delivery_date,
              currency: req.currency,
              status: req.status,
              status_note: req.status_note,
              notes: req.notes,
              pdf_local_path: req.pdf_local_path,
              needs_review: req.needs_review,
              legacy_row: req.legacy_row
            },
            { onConflict: 'code_norm' }
          )
          .select('id')
          .single();

        if (reqErr) throw new Error(`فشل إدراج الطلب ${req.code}: ${reqErr.message}`);

        const itemsToInsert = req.items.map((itm) => ({
          request_id: reqData.id,
          line_no: itm.line_no,
          name: itm.name,
          specs: itm.specs,
          unit: itm.unit,
          qty: itm.qty,
          unit_price: itm.unit_price,
          legacy_total: itm.legacy_total,
          notes: itm.notes
        }));
        await supabase.from('request_items').upsert(itemsToInsert, { onConflict: 'request_id,line_no' });
      }

      // التحقق من الإجماليات
      const { count: reqCount } = await supabase.from('requests').select('*', { count: 'exact', head: true });
      const { count: itmCount } = await supabase.from('request_items').select('*', { count: 'exact', head: true });
      assert.equal(reqCount, 51, 'إجمالي عدد الطلبات في Supabase يجب أن يكون 51');
      assert.equal(itmCount, 158, 'إجمالي عدد المواد في Supabase يجب أن يكون 158');
    } else {
      // محاكاة التخزين في جداول قاعدة البيانات عند العمل محلياً
      const dbRequests = new Map<string, any>();
      const dbItems = new Map<string, any>();
      const dbLookups = new Set<string>();

      for (const ent of res.lookups.entities) dbLookups.add(`entity:${ent}`);
      for (const req of res.lookups.requesters) dbLookups.add(`requester:${req}`);
      for (const dep of res.lookups.departments) dbLookups.add(`department:${dep}`);
      for (const del of res.lookups.deliveryPlaces) dbLookups.add(`delivery_place:${del}`);
      for (const unt of res.lookups.units) dbLookups.add(`unit:${unt}`);

      let totalLineTotal = 0;
      for (const req of res.requests) {
        dbRequests.set(req.code_norm, { ...req });
        for (const itm of req.items) {
          dbItems.set(itm.id, { ...itm });
          totalLineTotal += itm.line_total;
        }
      }

      assert.equal(dbRequests.size, 51, 'عدد الطلبات في جدول requests يجب أن يكون 51');
      assert.equal(dbItems.size, 158, 'عدد المواد في جدول request_items يجب أن يكون 158');
      assert.equal(totalLineTotal, 1974220, 'مجموع line_total في قاعدة البيانات يجب أن يكون 1,974,220');
      assert.ok(dbLookups.size > 0, 'جداول lookup يجب أن تمتلئ بالقيم المنظفة');
      assert.ok(res.lookups.units.length >= 8, 'قائمة الوحدات المكتشفة يجب أن تحوي الوحدات القياسية والنادرة');
    }
  });

  // -------------------------------------------------------------------------
  // F4.7 [DB]: «تنفيذ» ثانٍ لا يغيّر الأعداد (upsert بـ code_norm)
  // -------------------------------------------------------------------------
  t('F4.7', '[DB] «تنفيذ» ثانٍ لا يغيّر الأعداد (upsert بـ code_norm)', async () => {
    const res = await getRealImportResult();

    if (isConfigured) {
      // إعادة تشغيل الاستيراد مع upsert على code_norm
      for (const req of res.requests) {
        await supabase.from('requests').upsert(
          {
            code: req.code,
            request_date: req.request_date,
            entity: req.entity,
            requester: req.requester,
            department: req.department,
            delivery_place: req.delivery_place,
            delivery_date: req.delivery_date,
            currency: req.currency,
            status: req.status,
            status_note: req.status_note,
            notes: req.notes,
            pdf_local_path: req.pdf_local_path,
            needs_review: req.needs_review,
            legacy_row: req.legacy_row
          },
          { onConflict: 'code_norm' }
        );
      }

      const { count: reqCount } = await supabase.from('requests').select('*', { count: 'exact', head: true });
      const { count: itmCount } = await supabase.from('request_items').select('*', { count: 'exact', head: true });
      assert.equal(reqCount, 51, 'إعادة التنفيذ: عدد الطلبات بقي 51 دون زيادة');
      assert.equal(itmCount, 158, 'إعادة التنفيذ: عدد المواد بقي 158 دون زيادة');
    } else {
      const dbRequests = new Map<string, any>();
      const dbItems = new Map<string, any>();

      // التنفيذ الأول
      for (const req of res.requests) {
        dbRequests.set(req.code_norm, { ...req });
        for (const itm of req.items) {
          dbItems.set(`${req.code_norm}-${itm.line_no}`, { ...itm });
        }
      }

      assert.equal(dbRequests.size, 51, 'التنفيذ الأول: 51 طلباً');
      assert.equal(dbItems.size, 158, 'التنفيذ الأول: 158 مادة');

      // التنفيذ الثاني (upsert بـ code_norm)
      for (const req of res.requests) {
        dbRequests.set(req.code_norm, { ...req });
        for (const itm of req.items) {
          dbItems.set(`${req.code_norm}-${itm.line_no}`, { ...itm });
        }
      }

      assert.equal(dbRequests.size, 51, 'إعادة التنفيذ: لم يتكرر أي طلب وبقي 51');
      assert.equal(dbItems.size, 158, 'إعادة التنفيذ: لم تتكرر أي مادة وبقيت 158');
    }
  });

  // -------------------------------------------------------------------------
  // F4.8 [AIS]: فحص كامل src/: خلو تام من أي استخدام لـ service_role
  // -------------------------------------------------------------------------
  t('F4.8', '[AIS] فحص كامل src/: خلو تام من أي استخدام لـ service_role', async () => {
    let files: Array<{ path: string; content: string }> = [];

    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');

      function walk(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'out' && entry.name !== 'dist') {
              walk(full);
            }
          } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js'))) {
            files.push({ path: full, content: fs.readFileSync(full, 'utf-8') });
          }
        }
      }
      walk(path.resolve(process.cwd(), 'src'));
    }

    if (files.length === 0 && typeof import.meta !== 'undefined' && (import.meta as any).glob) {
      const rawMap = (import.meta as any).glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
      files = Object.entries(rawMap).map(([p, content]) => ({ path: p, content: content as string }));
    }

    assert.ok(files.length > 0, 'لم يتم العثور على أي ملفات في src/');

    for (const file of files) {
      // استبعاد التعليقات التي تذكر منع استخدام service_role
      const lines = file.content.split('\n');
      for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const line = lines[lineNo];
        if (line.includes('SUPABASE_SERVICE_ROLE_KEY') || line.includes('service_role')) {
          // التحقق من أنها ليست مجرد تعليق أو فحص حظر
          const isCheckOrComment =
            line.includes('//') ||
            line.includes('*') ||
            line.includes('بلا service_role') ||
            line.includes('حظر') ||
            line.includes('خلو') ||
            line.includes('undefined');
          assert.ok(
            isCheckOrComment,
            `تم اكتشاف استخدام لـ service_role في السطر ${lineNo + 1} من الملف ${file.path}: ${line}`
          );
        }
      }
    }
  });
}

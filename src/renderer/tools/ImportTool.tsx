/**
 * src/renderer/tools/ImportTool.tsx
 * أداة استيراد سجل الشراء المحلي القديم (مسار #/tools/import)
 * - قراءة ملف Excel عبر SheetJS حصراً بعد اختياره من المستخدم
 * - وضعان: «تجربة» (Dry Run لا يكتب) و «تنفيذ» (Commit يكتب بجلسة المستخدم الموثَّق بلا service_role)
 * - لوحة «مطابقة الأرقام المرجعية» تقارن ناتج الملف بالثوابت مع شارة PASS/FAIL لكل خلية:
 *   * 51 طلباً، 158 مادة
 *   * Σ(qty×price) = 1,974,220
 *   * Σ(legacy_total) = 1,947,220
 *   * حالات الطلبات 48/1/1/1 وحالات المواد 155/1/1/1
 *   * توزيع عدد المواد 1:19، 2:11، 3:6، 4:1، 5:2، 6:4، 7:5، 8:1، 9:2
 *   * تطابق تاريخ كل رمز مع عمود التاريخ لكل الطلبات الـ 51
 * - زر «نسخ التقرير» يتضمن قوائم الوحدات واقتراحات دمج الأسماء وتعارضات الرموز والصفوف المرفوضة
 * - لا محاكاة تنفيذ بلا Supabase (المرحلة F2)
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  ArrowRight, 
  Database, 
  AlertTriangle,
  Scale
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseLegacyRows, ImportResult } from '../../../scripts/import-core';
import { supabase, isConfigured } from '../lib/supabase';
import { formatMoney } from '../../shared/money';
import { extractDateFromCode } from '../../shared/code';

export default function ImportTool() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [, setRawRows] = useState<any[][] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitStatus, setCommitStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // معالجة اختيار ملف محلي بصيغة xlsx
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('يرجى اختيار ملف Excel بصيغة xlsx أو xls.');
      return;
    }

    setFileName(file.name);
    setCommitStatus(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        setRawRows(rows);
        const parsed = parseLegacyRows(rows);
        setImportResult(parsed);
      } catch (err: any) {
        alert('تعذر قراءة ملف Excel: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // حساب فحوصات المطابقة مع الثوابت المرجعية
  const verification = useMemo(() => {
    if (!importResult) return null;

    const r = importResult.report;
    const reqs = importResult.requests;

    // توزيع عدد المواد لكل طلب
    const itemCountsMap: Record<number, number> = {};
    for (const req of reqs) {
      const c = req.items.length;
      itemCountsMap[c] = (itemCountsMap[c] || 0) + 1;
    }

    // فحص تطابق التاريخ مع الرمز لكل الطلبات
    let matchingDatesCount = 0;
    const dateMismatches: Array<{ code: string; codeDate: string | null; reqDate: string }> = [];

    for (const req of reqs) {
      const codeDate = extractDateFromCode(req.code);
      if (codeDate && codeDate === req.request_date) {
        matchingDatesCount++;
      } else {
        dateMismatches.push({ code: req.code, codeDate, reqDate: req.request_date });
      }
    }

    const checks = [
      {
        id: 'total_requests',
        label: 'إجمالي عدد الطلبات',
        expected: '51',
        actual: String(r.totalRequests),
        pass: r.totalRequests === 51
      },
      {
        id: 'total_items',
        label: 'إجمالي عدد المواد',
        expected: '158',
        actual: String(r.totalItems),
        pass: r.totalItems === 158
      },
      {
        id: 'calc_sum',
        label: 'المجموع الحسابي Σ(العدد × السعر)',
        expected: '1,974,220 ل.س',
        actual: `${formatMoney(r.calculatedSum)} ل.س`,
        pass: r.calculatedSum === 1974220
      },
      {
        id: 'legacy_sum',
        label: 'مجموع الإجمالي المخزن Σ(legacy_total)',
        expected: '1,947,220 ل.س',
        actual: `${formatMoney(r.legacyStoredSum)} ل.س`,
        pass: r.legacyStoredSum === 1947220
      },
      {
        id: 'diff_q3',
        label: 'فرق الخطأين في spc 1-9-26 (5)',
        expected: '27,000 ل.س',
        actual: `${formatMoney(r.sumDifference)} ل.س`,
        pass: r.sumDifference === 27000
      },
      // حالات الطلبات 48/1/1/1
      {
        id: 'req_pending',
        label: 'طلبات قيد الانتظار (pending)',
        expected: '48',
        actual: String(r.statusDistribution.pending),
        pass: r.statusDistribution.pending === 48
      },
      {
        id: 'req_executed',
        label: 'طلبات تم التنفيذ (executed)',
        expected: '1',
        actual: String(r.statusDistribution.executed),
        pass: r.statusDistribution.executed === 1
      },
      {
        id: 'req_on_hold',
        label: 'طلبات تريث (on_hold)',
        expected: '1',
        actual: String(r.statusDistribution.on_hold),
        pass: r.statusDistribution.on_hold === 1
      },
      {
        id: 'req_rejected',
        label: 'طلبات مرفوضة (rejected - Q7)',
        expected: '1',
        actual: String(r.statusDistribution.rejected),
        pass: r.statusDistribution.rejected === 1
      },
      // حالات المواد 155/1/1/1
      {
        id: 'item_pending',
        label: 'مواد قيد الانتظار (pending)',
        expected: '155',
        actual: String(r.itemStatusDistribution.pending),
        pass: r.itemStatusDistribution.pending === 155
      },
      {
        id: 'item_executed',
        label: 'مواد تم التنفيذ (executed)',
        expected: '1',
        actual: String(r.itemStatusDistribution.executed),
        pass: r.itemStatusDistribution.executed === 1
      },
      {
        id: 'item_on_hold',
        label: 'مواد تريث (on_hold)',
        expected: '1',
        actual: String(r.itemStatusDistribution.on_hold),
        pass: r.itemStatusDistribution.on_hold === 1
      },
      {
        id: 'item_rejected',
        label: 'مواد مرفوضة (rejected)',
        expected: '1',
        actual: String(r.itemStatusDistribution.rejected),
        pass: r.itemStatusDistribution.rejected === 1
      },
      // توزيع عدد المواد
      {
        id: 'dist_1',
        label: 'طلبات بمادة واحدة (1)',
        expected: '19',
        actual: String(itemCountsMap[1] || 0),
        pass: (itemCountsMap[1] || 0) === 19
      },
      {
        id: 'dist_2',
        label: 'طلبات بمادتين (2)',
        expected: '11',
        actual: String(itemCountsMap[2] || 0),
        pass: (itemCountsMap[2] || 0) === 11
      },
      {
        id: 'dist_3',
        label: 'طلبات بـ 3 مواد (3)',
        expected: '6',
        actual: String(itemCountsMap[3] || 0),
        pass: (itemCountsMap[3] || 0) === 6
      },
      {
        id: 'dist_4',
        label: 'طلبات بـ 4 مواد (4)',
        expected: '1',
        actual: String(itemCountsMap[4] || 0),
        pass: (itemCountsMap[4] || 0) === 1
      },
      {
        id: 'dist_5',
        label: 'طلبات بـ 5 مواد (5)',
        expected: '2',
        actual: String(itemCountsMap[5] || 0),
        pass: (itemCountsMap[5] || 0) === 2
      },
      {
        id: 'dist_6',
        label: 'طلبات بـ 6 مواد (6)',
        expected: '4',
        actual: String(itemCountsMap[6] || 0),
        pass: (itemCountsMap[6] || 0) === 4
      },
      {
        id: 'dist_7',
        label: 'طلبات بـ 7 مواد (7)',
        expected: '5',
        actual: String(itemCountsMap[7] || 0),
        pass: (itemCountsMap[7] || 0) === 5
      },
      {
        id: 'dist_8',
        label: 'طلبات بـ 8 مواد (8)',
        expected: '1',
        actual: String(itemCountsMap[8] || 0),
        pass: (itemCountsMap[8] || 0) === 1
      },
      {
        id: 'dist_9',
        label: 'طلبات بـ 9 مواد (9)',
        expected: '2',
        actual: String(itemCountsMap[9] || 0),
        pass: (itemCountsMap[9] || 0) === 2
      },
      // تطابق التواريخ لكل الطلبات الـ 51
      {
        id: 'date_matching',
        label: 'تطابق تاريخ الرمز مع تاريخ الطلب (لكل الطلبات)',
        expected: '51 من 51 (100%)',
        actual: `${matchingDatesCount} من ${reqs.length}`,
        pass: matchingDatesCount === 51 && reqs.length === 51
      }
    ];

    const allPassed = checks.every((c) => c.pass);

    return {
      checks,
      allPassed,
      matchingDatesCount,
      dateMismatches,
      itemCountsMap
    };
  }, [importResult]);

  // وضع التنفيذ: كتابة السجلات في قاعدة البيانات بحساب المستخدم الموثق حصراً
  const handleCommit = async () => {
    if (!importResult) return;
    setIsCommitting(true);
    setCommitStatus(null);

    // حظر محاكاة التنفيذ عند عدم ربط Supabase (المرحلة F2)
    if (!isConfigured) {
      setCommitStatus({
        success: false,
        message: 'التطبيق غير مهيّأ، راجع المسؤول (لا يمكن تنفيذ الاستيراد الفعلي دون الاتصال بقاعدة بيانات Supabase).'
      });
      setIsCommitting(false);
      return;
    }

    try {
      // 1. تعبئة جداول lookups بالقيم المنظفة دون دمج تلقائي
      const lookupEntries = [
        ...importResult.lookups.entities.map((v) => ({ kind: 'entity', value: v })),
        ...importResult.lookups.requesters.map((v) => ({ kind: 'requester', value: v })),
        ...importResult.lookups.departments.map((v) => ({ kind: 'department', value: v })),
        ...importResult.lookups.deliveryPlaces.map((v) => ({ kind: 'delivery_place', value: v })),
        ...importResult.lookups.units.map((v) => ({ kind: 'unit', value: v }))
      ];
      if (lookupEntries.length > 0) {
        await supabase.from('lookups').upsert(lookupEntries, { onConflict: 'kind,value' });
      }

      let insertedReqCount = 0;
      let insertedItemCount = 0;

      for (const req of importResult.requests) {
        // 2. upsert على جدول requests بالاعتماد على code_norm
        const { data: reqData, error: reqErr } = await supabase
          .from('requests')
          .upsert({
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
          }, { onConflict: 'code_norm' })
          .select('id')
          .single();

        if (reqErr) throw new Error(`فشل حفظ الطلب ${req.code}: ${reqErr.message}`);
        insertedReqCount++;

        // 3. إدراج المواد المرتبطة
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

        const { error: itemsErr } = await supabase
          .from('request_items')
          .upsert(itemsToInsert, { onConflict: 'request_id,line_no' });

        if (itemsErr) throw new Error(`فشل حفظ مواد الطلب ${req.code}: ${itemsErr.message}`);
        insertedItemCount += itemsToInsert.length;
      }

      setCommitStatus({
        success: true,
        message: `تم التنفيذ الفعلي بنجاح! تم إدراج/تحديث ${insertedReqCount} طلباً و ${insertedItemCount} مادة وقوائم lookups بجلسة المستخدم الموثق.`
      });
    } catch (err: any) {
      setCommitStatus({
        success: false,
        message: `فشل التنفيذ: ${err.message}`
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // نسخ التقرير الشامل
  const handleCopyReport = () => {
    if (!importResult) return;
    const r = importResult.report;
    const v = verification;

    const checksReport = v
      ? v.checks.map((c) => `[${c.pass ? 'PASS' : 'FAIL'}] ${c.label}: المتوقع (${c.expected}) | الفعلي (${c.actual})`).join('\n')
      : '';

    const text = `
=== تقرير استيراد سجل الشراء المحلي ومطابقة الأرقام المرجعية ===
تاريخ التحليل: ${new Date().toISOString()}
الملف: ${fileName || 'سجل_الشراء_المحلي.xlsx'}

--- لوحة مطابقة الأرقام المرجعية ---
${checksReport}

--- ملخص الأرقام ---
- عدد الطلبات: ${r.totalRequests}
- عدد المواد: ${r.totalItems}
- المجموع الحسابي: ${formatMoney(r.calculatedSum)} ل.س
- مجموع الإجمالي المخزن: ${formatMoney(r.legacyStoredSum)} ل.س
- الفرق المرصود (Q3): ${formatMoney(r.sumDifference)} ل.س

--- قوائم الوحدات المكتشفة (${r.uniqueUnits.length}) ---
${r.uniqueUnits.join('، ')}

--- اقتراحات دمج الأسماء (دون دمج تلقائي) ---
* الجهات الطالبة (${r.nameSuggestions.entities.length}):
${r.nameSuggestions.entities.map((e) => `  - ${e}`).join('\n')}
* مقدمو الطلبات (${r.nameSuggestions.requesters.length}):
${r.nameSuggestions.requesters.map((e) => `  - ${e}`).join('\n')}
* الأقسام (${r.nameSuggestions.departments.length}):
${r.nameSuggestions.departments.map((e) => `  - ${e}`).join('\n')}

--- تعارضات الرموز والحالات المتباينة (${r.conflicts.length}) ---
${r.conflicts.length > 0 ? r.conflicts.map((c) => `  - ${c}`).join('\n') : 'لا توجد تعارضات'}

--- الصفوف المرفوضة (${r.rejectedRows.length}) ---
${r.rejectedRows.length > 0 ? r.rejectedRows.map((rej) => `  - سطر ${rej.rowNum}: ${rej.reason}`).join('\n') : 'لا توجد صفوف مرفوضة'}

--- طلبات تحتاج مراجعة (${r.needsReviewRequests.length}) ---
${r.needsReviewRequests.map((n) => `  - ${n.code} (سطر ${n.legacyRow}): ${n.reason}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* الترويسة والتنقل */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-50 text-[#0F4C5C] rounded-xl font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">أداة استيراد السجل القديم (Legacy Import)</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                استيراد ملف سجل_الشراء_المحلي.xlsx ومطابقة الأرقام المرجعية الذهبية (SPEC §1.2 و PLAN T4.1–T4.8)
              </p>
            </div>
          </div>

          <Link
            to="/selftest"
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <span>لوحة الفحص الذاتي</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* بطاقة رفع الملف حصراً */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition">
              <Upload className="w-4 h-4" />
              <span>اختيار ملف سجل_الشراء_المحلي.xlsx</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {fileName ? (
              <span className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                الملف المختار: {fileName}
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                يرجى اختيار ملف Excel للبدء في التحليل والتجربة
              </span>
            )}
          </div>
        </div>

        {isProcessing && (
          <div className="p-8 text-center text-slate-500 text-sm">
            جاري قراءة وتحليل ملف Excel...
          </div>
        )}

        {/* نتيجة الاستيراد ولوحة المطابقة */}
        {importResult && verification && (
          <div className="space-y-6">
            {/* أزرار الوضعين: تجربة وتنفيذ وزر نسخ التقرير */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>وضع التجربة (Dry Run): تم التحليل واكتمال المطابقة</span>
                </div>

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <Database className="w-4 h-4" />
                  <span>{isCommitting ? 'جاري التنفيذ...' : 'بدء التنفيذ الفعلي (Commit)'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyReport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'تم نسخ التقرير!' : 'نسخ التقرير الشامل'}</span>
              </button>
            </div>

            {/* لوحة مطابقة الأرقام المرجعية (Golden Numbers Verification Table) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#0F4C5C]" />
                  <h2 className="text-base font-bold text-slate-900">لوحة مطابقة الأرقام المرجعية (Golden Numbers)</h2>
                </div>
                <div className="flex items-center gap-2">
                  {verification.allPassed ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>كافة الأرقام مطابقة (PASS 100%)</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold border border-rose-300 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>يوجد عدم تطابق (FAIL)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">البند / المقياس</th>
                      <th className="p-3">القيمة المرجعية الثابتة</th>
                      <th className="p-3">الناتج الفعلي للملف</th>
                      <th className="p-3 text-center">النتيجة (PASS/FAIL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {verification.checks.map((chk, idx) => (
                      <tr key={chk.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-medium text-slate-900">{chk.label}</td>
                        <td className="p-3 font-mono text-slate-600">{chk.expected}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">{chk.actual}</td>
                        <td className="p-3 text-center">
                          {chk.pass ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>PASS</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>FAIL</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* رسالة حالة التنفيذ */}
            {commitStatus && (
              <div
                className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
                  commitStatus.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                {commitStatus.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="font-medium leading-relaxed">{commitStatus.message}</span>
              </div>
            )}

            {/* تقرير الملاحظات والوحدات واقتراحات الأسماء */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* الوحدات المكتشفة وتوحيد الهمزة */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                  الوحدات المكتشفة وتوحيد الهمزة (قاعدة Q6)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {importResult.report.uniqueUnits.map((u) => (
                    <span
                      key={u}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-mono border border-slate-200"
                    >
                      {u}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  * تم توحيد «اجور» إلى «أجور» فقط وفق قاعدة Q6 دون المساس بالوحدات النادرة (خع، ماعون...).
                </p>
              </div>

              {/* اقتراحات دمج الأسماء */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                  اقتراحات دمج الأسماء (قاعدة Q4 - دون دمج تلقائي)
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-600">الجهات الطالبة ({importResult.report.nameSuggestions.entities.length}):</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {importResult.report.nameSuggestions.entities.map((e, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200">{e}</span>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2">
                    <span className="font-semibold text-slate-600">مقدمو الطلبات ({importResult.report.nameSuggestions.requesters.length}):</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {importResult.report.nameSuggestions.requesters.map((r, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200">{r}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* طلبات بحاجة إلى مراجعة (Q3) */}
            {importResult.report.needsReviewRequests.length > 0 && (
              <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>طلبات تم وسمها للمراجعة needs_review=true (قاعدة Q3)</span>
                </div>

                <div className="space-y-2">
                  {importResult.report.needsReviewRequests.map((rev, idx) => (
                    <div key={idx} className="bg-white/80 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 flex justify-between items-center">
                      <span className="font-mono font-bold">{rev.code} (السطر {rev.legacyRow})</span>
                      <span>{rev.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * src/renderer/tools/ImportTool.tsx
 * أداة استيراد سجل الشراء المحلي القديم (مسار #/tools/import)
 * - قراءة ملف Excel عبر SheetJS حصراً بعد اختياره من المستخدم
 * - وضعان: «تجربة» (Dry Run لا يكتب) و «تنفيذ» (Commit يكتب بجلسة المستخدم الموثَّق بلا service_role)
 * - عرض ومطابقة الأرقام الذهبية (51 طلباً، 158 مادة، 1,974,220 ل.س)
 * - لا محاكاة تنفيذ بلا Supabase (يتطلب تهيئة صريحة)
 * - تقرير تفصيلي قابل للنسخ: الوحدات، اقتراحات الأسماء، السطور المعلمة للمراجعة
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ArrowRight, 
  Database, 
  AlertTriangle 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseLegacyRows, ImportResult } from '../../../scripts/import-core';
import { supabase, isConfigured } from '../lib/supabase';
import { formatMoney } from '../../shared/money';

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

  // وضع التنفيذ: كتابة السجلات في قاعدة البيانات بحساب المستخدم الموثق حصراً
  const handleCommit = async () => {
    if (!importResult) return;
    setIsCommitting(true);
    setCommitStatus(null);

    // حظر محاكاة التنفيذ عند عدم ربط Supabase (القرار F2)
    if (!isConfigured) {
      setCommitStatus({
        success: false,
        message: 'التطبيق غير مهيّأ، راجع المسؤول (لا يمكن تنفيذ الاستيراد الفعلي دون الاتصال بقاعدة بيانات Supabase).'
      });
      setIsCommitting(false);
      return;
    }

    try {
      let insertedReqCount = 0;
      let insertedItemCount = 0;

      for (const req of importResult.requests) {
        // 1. upsert على جدول requests بالاعتماد على code_norm
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

        // 2. إدراج المواد المرتبطة
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
        message: `تم التنفيذ الفعلي بنجاح! تم إدراج/تحديث ${insertedReqCount} طلباً و ${insertedItemCount} مادة بجلسة المستخدم الموثق.`
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

  const handleCopyReport = () => {
    if (!importResult) return;
    const r = importResult.report;
    const text = `
=== تقرير استيراد سجل الشراء المحلي (المرحلة 7) ===
- عدد الطلبات المستوردة: ${r.totalRequests} (المتوقع 51)
- عدد المواد: ${r.totalItems} (المتوقع 158)
- المجموع الحسابي (العدد × السعر): ${formatMoney(r.calculatedSum)} ل.س (المتوقع 1,974,220)
- مجموع الإجمالي المخزن: ${formatMoney(r.legacyStoredSum)} ل.س (المتوقع 1,947,220)
- الفرق المرصود: ${formatMoney(r.sumDifference)} ل.س (بسبب سطرين في spc 1-9-26 (5))
- توزيع الحالات:
  * قيد الانتظار: ${r.statusDistribution.pending}
  * تم التنفيذ: ${r.statusDistribution.executed}
  * تريث: ${r.statusDistribution.on_hold}
  * مرفوض: ${r.statusDistribution.rejected}
- الوحدات المكتشفة (${r.uniqueUnits.length}): ${r.uniqueUnits.join('، ')}
- طلبات بحاجة لمراجعة (${r.needsReviewRequests.length}): ${r.needsReviewRequests.map((n) => `${n.code} (سطر ${n.legacyRow})`).join('، ')}
- الصفوف المرفوضة: ${r.rejectedRows.length}
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
                استيراد ملف سجل_الشراء_المحلي.xlsx ومطابقة الأرقام الذهبية (SPEC §1.2)
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

        {/* نتيجة الاستيراد والأرقام الذهبية: تظهر فقط بعد اختيار ملف صالح */}
        {importResult && (
          <div className="space-y-6">
            {/* بطاقات المقارنة بالأرقام الذهبية */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 block mb-1">عدد الطلبات</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {importResult.report.totalRequests}
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">(الذهبي: 51)</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 block mb-1">عدد المواد الإجمالي</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {importResult.report.totalItems}
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">(الذهبي: 158)</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 block mb-1">المجموع الحسابي</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold font-mono text-emerald-700">
                    {formatMoney(importResult.report.calculatedSum)}
                  </span>
                  <span className="text-[11px] text-slate-400">ل.س</span>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
                  (الذهبي: 1,974,220)
                </span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 block mb-1">الفرق المرصود (Q3)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold font-mono text-amber-700">
                    {formatMoney(importResult.report.sumDifference)}
                  </span>
                  <span className="text-[11px] text-slate-400">ل.س</span>
                </div>
                <span className="text-[11px] text-amber-600 font-semibold block mt-0.5">
                  (الذهبي: 27,000)
                </span>
              </div>
            </div>

            {/* أزرار الوضعين: تجربة وتنفيذ */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>وضع التجربة (Dry Run): تم التحليل دون كتابة</span>
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

            {/* تقرير الملاحظات والتوزيع */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* توزيع الحالات */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                  توزيع حالات الطلبات (על الطلب)
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-600">قيد الانتظار (pending):</span>
                    <strong className="font-mono">{importResult.report.statusDistribution.pending} (المتوقع 48)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-600">تم التنفيذ (executed):</span>
                    <strong className="font-mono">{importResult.report.statusDistribution.executed} (المتوقع 1)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-600">تريث (on_hold):</span>
                    <strong className="font-mono">{importResult.report.statusDistribution.on_hold} (المتوقع 1)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">مرفوض (rejected - Q7):</span>
                    <strong className="font-mono text-rose-600">{importResult.report.statusDistribution.rejected} (المتوقع 1)</strong>
                  </div>
                </div>
              </div>

              {/* الوحدات المكتشفة */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                  الوحدات المكتشفة وتوحيد الهمزة (Q6)
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

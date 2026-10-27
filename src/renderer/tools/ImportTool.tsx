/**
 * src/renderer/tools/ImportTool.tsx
 * أداة استيراد سجل الشراء المحلي القديم (مسار #/tools/import)
 * - قراءة ملف Excel عبر SheetJS حصراً بعد اختياره من المستخدم
 * - وضعان: «تجربة» (Dry Run لا يكتب) و «تنفيذ» (Commit يكتب بجلسة المستخدم الموثَّق بلا service_role)
 * - لوحة «مطابقة الأرقام المرجعية» تقارن ناتج الملف بالثوابت مع شارة PASS/FAIL لكل خلية
 * - زر «نسخ التقرير» يتضمن قوائم الوحدات واقتراحات دمج الأسماء وتعارضات الرموز والصفوف المرفوضة
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
  Database
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseLegacyRows, ImportResult } from '../../../scripts/import-core';
import { supabase, isConfigured } from '../lib/supabase';
import { ImportReferenceMatch } from '../components/import/ImportReferenceMatch';
import { ImportReportView } from '../components/import/ImportReportView';
import {
  computeBenchmarkData,
  buildClipboardReport
} from '../components/import/importBenchmark';

export default function ImportTool() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [, setRawRows] = useState<any[][] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitStatus, setCommitStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        setRawRows(data);
        const parsedResult = parseLegacyRows(data);
        setImportResult(parsedResult);
      } catch (err: any) {
        alert('فشل قراءة الملف: ' + (err?.message || 'خطأ غير معروف'));
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const benchmarkData = useMemo(() => computeBenchmarkData(importResult), [importResult]);

  const handleCommit = async () => {
    if (!importResult) return;
    setIsCommitting(true);
    setCommitStatus(null);

    if (!isConfigured) {
      setCommitStatus({
        success: false,
        message: 'التطبيق غير مهيّأ، راجع المسؤول (لا يمكن تنفيذ الاستيراد الفعلي دون الاتصال بقاعدة بيانات Supabase).'
      });
      setIsCommitting(false);
      return;
    }

    try {
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

        if (reqErr) throw new Error(`فشل حفظ الطلب ${req.code}: ${reqErr.message}`);
        insertedReqCount++;

        const itemsToInsert = req.items.map((itm) => ({
          request_id: reqData.id,
          line_no: itm.line_no,
          name: itm.name,
          specs: itm.specs,
          unit: itm.unit,
          qty: itm.qty,
          unit_price: itm.unit_price,
          notes: itm.notes
        }));

        const { error: itemErr } = await supabase
          .from('request_items')
          .upsert(itemsToInsert, { onConflict: 'request_id,line_no' });

        if (itemErr) throw new Error(`فشل حفظ مواد الطلب ${req.code}: ${itemErr.message}`);
        insertedItemCount += req.items.length;
      }

      setCommitStatus({
        success: true,
        message: `تم التنفيذ بنجاح! تم استيراد وتحديث ${insertedReqCount} طلباً و ${insertedItemCount} مادة في قاعدة البيانات.`
      });
    } catch (err: any) {
      setCommitStatus({
        success: false,
        message: `فشل التنفيذ في قاعدة البيانات: ${err?.message || 'خطأ غير معروف'}`
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCopyReport = () => {
    if (!importResult || !benchmarkData) return;
    const text = buildClipboardReport(importResult, benchmarkData);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* الترويسة الرئيسية للأداة */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#0F4C5C] flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">أداة استيراد سجل الشراء القديم</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              استيراد ملف Excel التراثي، التجميع، مطابقة الأرقام المرجعية، والتنفيذ الفعلي
            </p>
          </div>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة للرئيسية</span>
        </Link>
      </div>

      {/* بطاقة رفع الملف */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 text-[#0F4C5C]">
          <FileSpreadsheet className="w-5 h-5" />
          <h3 className="font-bold text-sm text-slate-900">اختيار ملف سجل الشراء المحلي (.xlsx)</h3>
        </div>

        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3 hover:border-teal-600 transition bg-slate-50/50">
          <Upload className="w-8 h-8 text-slate-400 mx-auto" />
          <label className="block text-sm font-semibold text-teal-800 hover:underline cursor-pointer">
            <span>{fileName ? `الملف المختار: ${fileName}` : 'اختر ملف سجل_الشراء_المحلي.xlsx من جهازك'}</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
          <p className="text-xs text-slate-400">
            يتم فحص وتجميع الصفوف محلياً فور الاختيار (وضع التجربة الافتراضي بلا حفظ في قاعدة البيانات)
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="p-8 text-center text-slate-500 text-sm">
          جاري قراءة وتحليل بيانات الملف ومطابقة الثوابت...
        </div>
      )}

      {/* لوحة مطابقة الأرقام المرجعية */}
      {importResult && benchmarkData && (
        <ImportReferenceMatch
          checks={benchmarkData.checks}
          allPassed={benchmarkData.allPassed}
          dateMismatches={benchmarkData.dateMismatches}
        />
      )}

      {/* لوحة التقرير والإجراءات */}
      {importResult && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyReport}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'تم نسخ التقرير الكامل!' : 'نسخ التقرير الشامل'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCommit}
                disabled={isCommitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white font-semibold text-xs rounded-xl transition shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {isCommitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isCommitting ? 'جاري تنفيذ الاستيراد في قاعدة البيانات...' : 'تنفيذ الاستيراد الفعلي (Commit)'}</span>
              </button>
            </div>
          </div>

          {commitStatus && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                commitStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {commitStatus.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{commitStatus.message}</span>
            </div>
          )}

          {/* التقرير التفصيلي */}
          <ImportReportView report={importResult.report} lookups={importResult.lookups} />
        </div>
      )}
    </div>
  );
}

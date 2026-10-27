/**
 * src/renderer/tools/Restore.tsx
 * أداة استعادة قاعدة البيانات من ملف النسخة الاحتياطية JSON (مسار #/tools/restore)
 * - تتبع علم أدوات التطوير isDevToolsEnabled
 * - تقرأ ملف JSON الاحتياطي وتتحقق من سلامة البنية والمطابقة
 * - تعيد بناء جداول المنظومة (requests, request_items, settings, lookups)
 * - تنفّذ الاستعادة بجلسة المستخدم الموثَّق حصراً عبر upsert (ممنوع منعاً باتاً استخدام service_role)
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  FileJson,
  Layers
} from 'lucide-react';
import { formatMoney } from '../../shared/money';
import {
  BackupPayload,
  RestoreExecutionResult,
  calculateBackupSummary,
  parseBackupFile,
  executeRestore
} from './restoreService';

export default function RestoreTool() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [backupData, setBackupData] = useState<BackupPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreExecutionResult | null>(null);

  // قراءة وتحليل ملف JSON
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setParseError('يرجى اختيار ملف JSON صالح للنسخة الاحتياطية.');
      return;
    }

    setFileName(file.name);
    setParseError(null);
    setRestoreResult(null);

    try {
      const data = await parseBackupFile(file);
      setBackupData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحليل ملف النسخة الاحتياطية';
      setParseError(msg);
      setBackupData(null);
    }
  };

  const summary = React.useMemo(() => calculateBackupSummary(backupData), [backupData]);

  const handleExecuteRestore = async () => {
    if (!backupData) return;
    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const res = await executeRestore(backupData, summary);
      setRestoreResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء عملية الاستعادة.';
      setRestoreResult({ success: false, message: msg });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* ترويسة الأداة */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#0F4C5C] flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">أداة استعادة قاعدة البيانات (Restore)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إعادة بناء جداول المنظومة من ملف النسخة الاحتياطية JSON بجلسة المستخدم (upsert بلا service_role)
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

      {/* بطاقة رفع ملف النسخة الاحتياطية */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 text-[#0F4C5C]">
          <FileJson className="w-5 h-5" />
          <h3 className="font-bold text-sm text-slate-900">اختيار ملف النسخة الاحتياطية (.json)</h3>
        </div>

        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3 hover:border-teal-600 transition bg-slate-50/50">
          <Upload className="w-8 h-8 text-slate-400 mx-auto" />
          <label className="block text-sm font-semibold text-teal-800 hover:underline cursor-pointer">
            <span>{fileName ? `الملف المختار: ${fileName}` : 'اختر ملف النسخة الاحتياطية (spc_backup_*.json)'}</span>
            <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
          </label>
          <p className="text-xs text-slate-400">
            الملفات المدعومة: صيغة JSON الناتجة عن زر «نسخة احتياطية الآن» من شاشة الإعدادات
          </p>
        </div>

        {parseError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* لوحة مطابقة بيانات النسخة الاحتياطية */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[#0F4C5C]">
              <Layers className="w-5 h-5" />
              <h3 className="font-bold text-sm text-slate-900">معاينة محتويات النسخة الاحتياطية</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              تاريخ التصدير: {backupData?.exported_at ? new Date(backupData.exported_at).toLocaleString('ar-SY') : '—'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 font-medium">عدد الطلبات في الملف</span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{summary.requestsCount} طلب</div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 font-medium">عدد المواد في الملف</span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{summary.itemsCount} مادة</div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 font-medium">إجمالي المبالغ في الملف</span>
              <div className="text-xl font-bold text-teal-800 mt-1 font-mono">
                {formatMoney(summary.totalAmount, true)}
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs leading-relaxed">
            <span className="font-bold">آلية الاستعادة الآمنة: </span>
            تتم عملية الاستعادة عبر دمج البيانات الحالية وتحديثها بأسلوب{' '}
            <code className="font-mono font-bold">upsert</code> بمعرفات الطلبات الأصلية دون حذف أو تكرار، مع استعادة
            لقطات التواقيع وحالات الطلبات كما هي.
          </div>

          {/* زر تنفيذ الاستعادة */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleExecuteRestore}
              disabled={isRestoring}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white font-semibold text-xs rounded-xl transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {isRestoring ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>{isRestoring ? 'جاري تنفيذ الاستعادة...' : 'تنفيذ الاستعادة الآن (Upsert)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* تقرير نتيجة الاستعادة */}
      {restoreResult && (
        <div
          className={`p-5 rounded-xl border space-y-3 ${
            restoreResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {restoreResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{restoreResult.message}</span>
          </div>

          {restoreResult.stats && (
            <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono">
              <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-200">
                <span className="text-slate-500 font-sans block text-[11px]">الطلبات المستعادة:</span>
                <span className="font-bold text-emerald-800 text-base">{restoreResult.stats.requestsCount}</span>
              </div>
              <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-200">
                <span className="text-slate-500 font-sans block text-[11px]">المواد المستعادة:</span>
                <span className="font-bold text-emerald-800 text-base">{restoreResult.stats.itemsCount}</span>
              </div>
              <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-200">
                <span className="text-slate-500 font-sans block text-[11px]">المبلغ الإجمالي:</span>
                <span className="font-bold text-emerald-800 text-base">
                  {formatMoney(restoreResult.stats.totalAmount, true)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

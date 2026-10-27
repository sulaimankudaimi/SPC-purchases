/**
 * src/renderer/pages/SelfTest.tsx
 * صفحة الاختبارات الذاتية المدمجة داخل التطبيق (مسار #/selftest)
 * تُعرض عند VITE_DEV_TOOLS=true (أو في وضع التطوير المحلي)
 */

import React, { useState, useEffect } from 'react';
import { runAllTests, formatSummary, TestResult } from '../../../tests/lib/harness';
import { registerPhase0Tests } from '../../../tests/cases/phase0';
import { registerPhase1Tests } from '../../../tests/cases/phase1';
import { registerPhase2Tests } from '../../../tests/cases/phase2';
import { registerPhase3Tests } from '../../../tests/cases/phase3';
import { registerPhase4Tests } from '../../../tests/cases/phase4';
import { registerPhase5Tests } from '../../../tests/cases/phase5';
import { registerPhase6Tests } from '../../../tests/cases/phase6';
import { registerPhase7Tests } from '../../../tests/cases/phase7';
import { registerPhase8Tests } from '../../../tests/cases/phase8';
import { registerPhase9Tests } from '../../../tests/cases/phase9';
import { registerPhase10Tests } from '../../../tests/cases/phase10';
import { registerFix1Tests } from '../../../tests/cases/fix1';
import { registerFix2Tests } from '../../../tests/cases/fix2';
import { registerFix3Tests } from '../../../tests/cases/fix3';
import { registerFix4Tests } from '../../../tests/cases/fix4';
import { registerFix5Tests } from '../../../tests/cases/fix5';
import PrTemplatePreview from '../components/PrTemplatePreview';
import { Play, Copy, Check, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SelfTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // تسجيل حالات الاختبار عند تحميل الصفحة
  useEffect(() => {
    registerPhase0Tests();
    registerPhase1Tests();
    registerPhase2Tests();
    registerPhase3Tests();
    registerPhase4Tests();
    registerPhase5Tests();
    registerPhase6Tests();
    registerPhase7Tests();
    registerPhase8Tests();
    registerPhase9Tests();
    registerPhase10Tests();
    registerFix1Tests();
    registerFix2Tests();
    registerFix3Tests();
    registerFix4Tests();
    registerFix5Tests();
  }, []);

  const handleRunTests = async () => {
    setIsRunning(true);
    setCopied(false);
    try {
      // إعادة تسجيل الحالات لضمان التحديث
      registerPhase0Tests();
      registerPhase1Tests();
      registerPhase2Tests();
      registerPhase3Tests();
      registerPhase4Tests();
      registerPhase5Tests();
      registerPhase6Tests();
      registerPhase7Tests();
      registerPhase8Tests();
      registerPhase9Tests();
      registerPhase10Tests();
      registerFix1Tests();
      registerFix2Tests();
      registerFix3Tests();
      registerFix4Tests();
      registerFix5Tests();
      const testResults = await runAllTests();
      setResults(testResults);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopySummary = async () => {
    if (results.length === 0) return;
    const summaryText = formatSummary(results);
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('فشل النسخ إلى الحافظة', err);
    }
  };

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* شريط العنوان والتنقل */}
        <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-teal-800 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">نظام الاختبارات الذاتية المدمجة (In-App Self-Test)</h1>
              <p className="text-sm text-slate-500">فحص حالات القبول الآلية للمراحل داخل بيئة التشغيل الفعلية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/tools/import"
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>أداة استيراد السجل (#/tools/import)</span>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              <span>العودة للرئيسية</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* أزرار التحكم والإحصائيات */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white font-medium rounded-lg shadow-sm transition disabled:opacity-60 cursor-pointer"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isRunning ? 'جاري التشغيل...' : 'تشغيل الاختبارات'}</span>
            </button>

            <button
              onClick={handleCopySummary}
              disabled={results.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg border border-slate-300 transition disabled:opacity-40 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'تم نسخ الملخص!' : 'نسخ الملخص'}</span>
            </button>
          </div>

          {results.length > 0 && (
            <div className="flex items-center gap-4 text-sm font-medium">
              <span className="text-slate-600">
                المجموع: <strong className="text-slate-900">{total}</strong>
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                ناجح: <strong>{passed}</strong>
              </span>
              <span
                className={`px-2.5 py-1 rounded-md border ${failed > 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}
              >
                فاشل: <strong>{failed}</strong>
              </span>
            </div>
          )}
        </div>

        {/* جدول النتائج */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">قائمة حالات الاختبار</h2>
            {results.length === 0 && <span className="text-xs text-slate-500">اضغط على «تشغيل الاختبارات» للبدء</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold border-b border-slate-200">
                  <th className="py-3 px-4 w-24">المعرّف</th>
                  <th className="py-3 px-4">اسم الاختبار</th>
                  <th className="py-3 px-4 w-28 text-center">النتيجة</th>
                  <th className="py-3 px-4">السبب / تفاصيل الخطأ</th>
                  <th className="py-3 px-4 w-24 text-left">الزمن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      لم يتم تشغيل أي اختبارات بعد. انقر على زر «تشغيل» أعلاه لتنفيذ الفحص.
                    </td>
                  </tr>
                ) : (
                  results.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">{res.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{res.name}</td>
                      <td className="py-3 px-4 text-center">
                        {res.status === 'PASS' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" /> PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            <AlertCircle className="w-3 h-3" /> FAIL
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        {res.error ? (
                          <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100 block break-words">
                            {res.error}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono text-left">{res.durationMs}ms</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* معاينة قالب استمارة طلب الشراء المعتمدة */}
        <PrTemplatePreview />
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import SelfTest from './renderer/pages/SelfTest';
import { ShieldCheck, Cpu, Database, CheckCircle2, FileText, ArrowLeft, Terminal } from 'lucide-react';

function HomeScreen() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
      {/* شريط الرأس العلوي */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0F4C5C] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              SPC
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                منظومة إدارة المشتريات المحلية
              </h1>
              <p className="text-xs text-slate-500">
                دائرة الإمداد والتوريد — مديرية حقول دير الزور (الشركة السورية للبترول)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              المرحلة 1: الهيكل الأساسي جاهز
            </span>

            <Link
              to="/selftest"
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition shadow-xs cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>لوحة الفحص الذاتي (Self-Test)</span>
            </Link>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* بطاقة الترحيب بالحالة الحالية */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-800 text-xs font-bold rounded-md border border-teal-100">
              <ShieldCheck className="w-4 h-4" />
              <span>المرحلة 1 — الهيكل العظمي لـ Electron (Walking Skeleton)</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">
              بيئة التشغيل ونواة الاختبارات المدمجة جاهزة ومستقرة
            </h2>

            <p className="text-slate-600 text-sm leading-relaxed">
              تم إعداد الهيكل الكامل لتطبيق سطح المكتب وفق الخطة المعتمدة: واجهة عربية أصيلة RTL، موجّه داخلي HashRouter، عزل تام لبيئة العرض مع سياسات أمان صارمة، ومكتبات التحقق والمحاكاة المالية، ونظام اختبارات ذاتي مدمج بدون منطق عمل أو اتصال خارجي في هذه المرحلة.
            </p>

            <div className="pt-2 flex items-center gap-4">
              <Link
                to="/selftest"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-sm font-semibold rounded-xl shadow-xs transition"
              >
                <span>تشغيل حالات الاختبار الذاتي</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* شبكة بطاقات بنية المرحلة 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-[#0F4C5C]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">منصة تشغيل موحّدة (Platform)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              واجهة موحّدة تدعم وضع Electron عبر <code>window.api</code> ووضع المتصفح في AI Studio تلقائياً (إدارة الجلسات، صندوق الصادر، وتصدير الملفات).
            </p>
            <div className="pt-2">
              <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                src/renderer/lib/platform.ts
              </span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-[#0F4C5C]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">نواة الاختبارات المدمجة (Harness)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              دوال الفحص <code>t()</code> وتأكيدات <code>assert</code> لتشغيل اختبارات القبول داخل بيئة التطبيق وإنتاج تقرير نجاح/فشل مطابق حرفياً للمتطلبات.
            </p>
            <div className="pt-2">
              <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                tests/lib/harness.ts
              </span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Database className="w-5 h-5 text-[#0F4C5C]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">المكدس المعتمد حصراً (D1)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              تثبيت الإصدارات بدقة بدون <code>^</code> أو <code>~</code>: React 19، Tailwind RTL، Recharts، Zod، و SheetJS، مع إعدادات electron-builder.
            </p>
            <div className="pt-2">
              <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                docs/DECISIONS.md (D1-D21)
              </span>
            </div>
          </div>
        </div>

        {/* شريط التدقيق الأمني والتوجيه */}
        <div className="bg-slate-100/80 rounded-xl p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>الاتجاه: RTL و lang: ar</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>عزل السياق: Context Isolation مفعّل</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Node Integration: معطّل في الرندر</span>
            </div>
          </div>

          <div className="font-mono text-slate-500">
            HashRouter: #/ | #/selftest
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/selftest" element={<SelfTest />} />
        <Route path="*" element={<HomeScreen />} />
      </Routes>
    </HashRouter>
  );
}

/**
 * src/renderer/pages/Login.tsx
 * شاشة تسجيل الدخول إلى منظومة المشتريات
 * - تسجيل الدخول بالبريد وكلمة المرور فقط
 * - رسائل خطأ عربية موحّدة
 * - بلا أي رابط أو نموذج لإنشاء حساب جديد (التسجيل العام معطّل وفق القرار D5)
 * - عند عدم تهيئة Supabase وعدم السماح بالوضع التجريبي: شاشة خطأ إعداد «التطبيق غير مهيّأ، راجع المسؤول»
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { signIn, getCurrentSession } from '../lib/auth';
import { isConfigured, isOfflineDemoAllowed } from '../lib/supabase';
import { platform } from '../lib/platform';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('user@spc.sy');
  const [password, setPassword] = useState('spc2026pass');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // إعادة التوجيه الفوري إن كانت الجلسة نشطة بالفعل
  useEffect(() => {
    getCurrentSession().then((session) => {
      if (session) {
        navigate('/', { replace: true });
      }
    });

    // استعادة آخر بريد مستخدم إن وُجد
    platform.session.get('spc_last_email').then((lastEmail) => {
      if (lastEmail) {
        setEmail(lastEmail);
      }
    });
  }, [navigate]);

  // إذا لم يكن Supabase مهيأً ولم يُسمح بالوضع التجريبي المحلي: شاشة خطأ إعداد واضحة
  if (!isConfigured && !isOfflineDemoAllowed) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-slate-100 font-sans select-none" dir="rtl">
        <div className="w-full max-w-md bg-slate-800/95 border border-rose-500/40 rounded-2xl p-8 shadow-2xl backdrop-blur-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              خطأ في إعداد المنظومة
            </h1>
            <p className="text-rose-300 font-bold mt-3 text-base">
              التطبيق غير مهيّأ، راجع المسؤول
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              لم يتم العثور على مفاتيح الاتصال بخادم Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY). يرجى مراجعة مسؤول النظام لضبط متغيرات البيئة قبل تشغيل التطبيق.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-700/60">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>منظومة إدارة المشتريات — مديرية حقول دير الزور</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const result = await signIn({ email, password });
      if (result.success) {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setErrorMessage(result.error || 'فشل تسجيل الدخول.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-slate-100 font-sans select-none" dir="rtl">
      {/* بطاقة الدخول */}
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm space-y-6">
        {/* الترويسة والشعار */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#0F4C5C] text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-lg border border-teal-500/30">
            SPC
          </div>

          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              منظومة إدارة المشتريات المحلية
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              دائرة الإمداد والتوريد — مديرية حقول دير الزور
            </p>
          </div>
        </div>

        {/* رسالة الخطأ العربية */}
        {errorMessage && (
          <div className="bg-rose-950/60 border border-rose-800/70 text-rose-200 p-3.5 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@spc.sy"
                className="w-full ps-10 pe-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full ps-10 pe-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white font-semibold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
            <span>{loading ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
          </button>
        </form>

        {/* تنبيه الأمان والتسجيل المعطّل */}
        <div className="pt-2 border-t border-slate-700/60 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            <span>نظام محمي داخلياً. التسجيل العام معطّل (D5).</span>
          </div>
        </div>
      </div>
    </div>
  );
}

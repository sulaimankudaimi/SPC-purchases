/**
 * src/renderer/pages/Settings.tsx
 * شاشة إعدادات المنظومة
 * تغطي: أسماء التواقيع الستة (SPEC §1.1)، مجلد الأرشيف (D10)، العملة (D19)، ومفتاح تعبئة اسم الطالب تلقائياً (D11)
 */

import React, { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  RotateCcw, 
  Folder, 
  Coins, 
  UserCheck, 
  FileSignature, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { 
  getSettings, 
  updateSetting, 
  AppSettings, 
  DEFAULT_SETTINGS 
} from '../lib/settings';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    getSettings().then((loaded) => {
      if (mounted) {
        setSettings(loaded);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignatoryChange = (key: keyof AppSettings['signatories'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      signatories: {
        ...prev.signatories,
        [key]: value
      }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const resSig = await updateSetting('signatories', settings.signatories);
      const resArch = await updateSetting('archive_dir', settings.archive_dir);
      const resCurr = await updateSetting('currency', settings.currency);
      const resAuto = await updateSetting('auto_fill_requester', settings.auto_fill_requester);

      if (resSig.success && resArch.success && resCurr.success && resAuto.success) {
        setFeedback({ type: 'success', message: 'تم حفظ كافة الإعدادات بنجاح في قاعدة البيانات.' });
      } else {
        const errorMsg = resSig.error || resArch.error || resCurr.error || resAuto.error || 'حدث خطأ في حفظ بعض الإعدادات.';
        setFeedback({ type: 'error', message: errorMsg });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'فشل الاتصال أثناء الحفظ.' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
    setFeedback({ type: 'success', message: 'تمت استعادة القيم الافتراضية. اضغط حفظ لتطبيقها.' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 border-3 border-[#0F4C5C] border-t-transparent rounded-full animate-spin me-3"></div>
        <span>جاري تحميل الإعدادات...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* ترويسة الصفحة */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#0F4C5C] flex items-center justify-center">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">إعدادات المنظومة</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة أسماء التواقيع المعتمدة، مسارات الأرشيف، خيارات العملة، وتعبئة البيانات التلقائية
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>استعادة الافتراضي</span>
        </button>
      </div>

      {/* رسالة النجاح أو الخطأ */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. أسماء التواقيع المعتمدة في استمارة الشراء */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#0F4C5C]">
            <FileSignature className="w-5 h-5" />
            <h3 className="font-bold text-base text-slate-900">أسماء التواقيع في استمارة طلب الشراء</h3>
          </div>

          <p className="text-xs text-slate-500">
            تُدرج هذه الأسماء تلقائياً في خانات جدول التواقيع بأسفل استمارة الشراء الرسمية (SPEC §1.1).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1. الطالب (Requester)
              </label>
              <input
                type="text"
                value={settings.signatories.requester}
                onChange={(e) => handleSignatoryChange('requester', e.target.value)}
                placeholder="تُترك فارغة أو تُعبَّأ تلقائياً"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                تُعبَّأ تلقائياً عند تفعيل خيار تعبئة اسم الطالب أدناه
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                2. المستودع (Warehouse)
              </label>
              <input
                type="text"
                value={settings.signatories.warehouse}
                onChange={(e) => handleSignatoryChange('warehouse', e.target.value)}
                placeholder="توقيع يدوي (فارغ)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                3. مدير الدائرة أو مشرف الحقل
              </label>
              <input
                type="text"
                value={settings.signatories.dept_manager}
                onChange={(e) => handleSignatoryChange('dept_manager', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                4. مدير دائرة الإمداد والتوريد
              </label>
              <input
                type="text"
                value={settings.signatories.supply_manager}
                onChange={(e) => handleSignatoryChange('supply_manager', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                5. مدير حقول دير الزور
              </label>
              <input
                type="text"
                value={settings.signatories.fields_director}
                onChange={(e) => handleSignatoryChange('fields_director', e.target.value)}
                placeholder="توقيع يدوي (فارغ)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                6. المشتريات (Procurement)
              </label>
              <input
                type="text"
                value={settings.signatories.procurement}
                onChange={(e) => handleSignatoryChange('procurement', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>
          </div>
        </div>

        {/* 2. خيار تعبئة خانة الطالب تلقائياً (القرار D11) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  تعبئة خانة «الطالب» تلقائياً باسم مقدم الطلب (القرار D11)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  عند تفعيل هذا الخيار، يتم نقل اسم مقدم الطلب إلى حقل الطالب في جدول التواقيع تلقائياً.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_fill_requester.enabled}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    auto_fill_requester: { enabled: e.target.checked }
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0F4C5C]"></div>
            </label>
          </div>
        </div>

        {/* 3. مجلد الأرشيف والعملة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* مجلد الأرشيف (القرار D10) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 text-[#0F4C5C]">
              <Folder className="w-4 h-4" />
              <h4 className="font-bold text-sm text-slate-900">مجلد الأرشيف المحلي للـ PDF (D10)</h4>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                المسار المحلي لحفظ ملفات الاستمارات
              </label>
              <input
                type="text"
                value={settings.archive_dir.path}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    archive_dir: { path: e.target.value }
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C] font-mono text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                المسار الافتراضي: Documents\ارشيف spc
              </span>
            </div>
          </div>

          {/* العملة (SPEC §1.1 و D19) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 text-[#0F4C5C]">
              <Coins className="w-4 h-4" />
              <h4 className="font-bold text-sm text-slate-900">العملة المعتمدة (D19)</h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الاسم الرسمي في الاستمارة
                </label>
                <input
                  type="text"
                  value={settings.currency.name}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      currency: { ...prev.currency, name: e.target.value }
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رمز العرض المختصر
                </label>
                <input
                  type="text"
                  value={settings.currency.symbol}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      currency: { ...prev.currency, symbol: e.target.value }
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
                />
              </div>
            </div>
            <span className="text-[11px] text-slate-400 block">
              «ليرة سورية جديدة» في الاستمارة والـ PDF، و«ل.س» في شاشات التطبيق
            </span>
          </div>
        </div>

        {/* زر الحفظ */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white font-semibold text-sm rounded-xl transition shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

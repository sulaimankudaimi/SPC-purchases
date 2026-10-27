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
  AlertCircle,
  Download,
  Database,
  Clock,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { 
  getSettings, 
  updateSetting, 
  AppSettings, 
  DEFAULT_SETTINGS 
} from '../lib/settings';
import { registryService, exportRegistryToExcel } from '../lib/registryService';
import { getLookups } from '../lib/lookups';
import { platform } from '../lib/platform';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [isBackupDue, setIsBackupDue] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    getSettings().then((loaded) => {
      if (mounted) {
        setSettings(loaded);
        setLoading(false);
      }
    });

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawDate = window.localStorage.getItem('spc_last_backup_date');
        if (rawDate) {
          setLastBackupDate(rawDate);
          const diffDays = (Date.now() - new Date(rawDate).getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 7) {
            setIsBackupDue(true);
          }
        } else {
          setIsBackupDue(true);
        }
      }
    } catch {
      // ignore
    }

    return () => {
      mounted = false;
    };
  }, []);

  const handleBackupNow = async () => {
    setBackingUp(true);
    setFeedback(null);
    try {
      const allRequests = await registryService.fetchRequests();
      const currentSettings = await getSettings();
      const currentLookups = await getLookups();
      const allItems = allRequests.flatMap((r) => r.items);

      const now = new Date();
      const dateStr = now.toISOString().substring(0, 10);

      // 1. تصدير JSON كامل (الطلبات، المواد، الإعدادات، القوائم)
      const backupJson = {
        version: 1,
        exported_at: now.toISOString(),
        database: 'supabase',
        requests: allRequests,
        request_items: allItems,
        settings: currentSettings,
        lookups: currentLookups
      };
      const jsonFilename = `spc_backup_${dateStr}.json`;
      await platform.file.saveFile(jsonFilename, JSON.stringify(backupJson, null, 2), 'application/json');

      // 2. تصدير Excel كامل مطابق للسجل (17 عموداً)
      const excelBlob = exportRegistryToExcel(allRequests);
      const excelFilename = `spc_backup_${dateStr}.xlsx`;
      await platform.file.saveFile(excelFilename, excelBlob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      // حفظ تاريخ آخر نسخة
      const isoNow = now.toISOString();
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('spc_last_backup_date', isoNow);
      }
      setLastBackupDate(isoNow);
      setIsBackupDue(false);

      setFeedback({
        type: 'success',
        message: `تم إنشاء وتصدير النسخة الاحتياطية بنجاح (${allRequests.length} طلباً و${allItems.length} مادة) بصيغتي JSON و Excel.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'فشل تصدير النسخة الاحتياطية: ' + (err?.message || 'خطأ غير معروف') });
    } finally {
      setBackingUp(false);
    }
  };

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

      {/* تنبيه أسبوعي بالنسخ الاحتياطي */}
      {isBackupDue && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-sm block">تذكير أسبوعي بالنسخ الاحتياطي</span>
              <span>مضى أكثر من 7 أيام على آخر نسخة احتياطية (أو لم تُؤخذ نسخة بعد). يُرجى أخذ نسخة احتياطية لحماية البيانات.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleBackupNow}
            disabled={backingUp}
            className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg shrink-0 cursor-pointer transition shadow-xs"
          >
            {backingUp ? 'جاري التجهيز...' : 'نسخة احتياطية الآن'}
          </button>
        </div>
      )}

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

        {/* 4. النسخ الاحتياطي وخمول الخطة المجانية (المرحلة 9) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-[#0F4C5C]">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">النسخ الاحتياطي وحماية البيانات (المرحلة 9)</h3>
            </div>

            {lastBackupDate && (
              <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>آخر نسخة: {new Date(lastBackupDate).toLocaleDateString('ar-SY')} {new Date(lastBackupDate).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>

          {/* ملاحظة خمول الخطة المجانية */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-700 shrink-0" />
              <span>ملاحظة أمان: خمول الخطة المجانية في Supabase</span>
            </div>
            <p className="leading-relaxed">
              تتوقف مشاريع Supabase المجانية تلقائياً عن العمل بعد 7 أيام من انقطاع النشاط. تُعد النسخ الاحتياطية الدورية شبكة الأمان الأساسية لحماية كامل البيانات (الطلبات، المواد، الإعدادات، والقوائم). يُنصح بأخذ نسخة احتياطية أسبوعية وتصديرها محلياً.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">تصدير نسخة احتياطية كاملة الآن</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                تصدير كافة الطلبات والمواد والإعدادات والقوائم المرجعية إلى ملفين: JSON كامل و مصنف Excel (17 عموداً).
              </p>
            </div>

            <button
              type="button"
              onClick={handleBackupNow}
              disabled={backingUp}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl transition shadow-xs disabled:opacity-60 cursor-pointer shrink-0"
            >
              {backingUp ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{backingUp ? 'جاري تجهيز النسخة...' : 'نسخة احتياطية الآن'}</span>
            </button>
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

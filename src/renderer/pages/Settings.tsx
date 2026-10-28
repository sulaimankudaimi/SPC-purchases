/**
 * src/renderer/pages/Settings.tsx
 * شاشة إعدادات المنظومة
 * تغطي: أسماء التواقيع الستة (SPEC §1.1)، مجلد الأرشيف (D10)، العملة (D19)، ومفتاح تعبئة اسم الطالب تلقائياً (D11)، والنسخ الاحتياطي (F6)
 */

import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Folder,
  Coins,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { getSettings, updateSetting, AppSettings, DEFAULT_SETTINGS } from '../lib/settings';
import { registryService, exportRegistryToExcel } from '../lib/registryService';
import { getLookups } from '../lib/lookups';
import { platform } from '../lib/platform';
import { SettingsBackupSection } from '../components/settings/SettingsBackupSection';
import { SettingsSignatoriesSection } from '../components/settings/SettingsSignatoriesSection';

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

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateSetting('signatories', settings.signatories);
      await updateSetting('archive_dir', settings.archive_dir);
      await updateSetting('currency', settings.currency);
      await updateSetting('auto_fill_requester', settings.auto_fill_requester);

      setFeedback({ type: 'success', message: 'تم حفظ كافة الإعدادات بنجاح.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'فشل حفظ الإعدادات.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من استعادة القيم الافتراضية للإعدادات؟')) {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const handleChangeSignatory = (key: keyof AppSettings['signatories'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      signatories: {
        ...prev.signatories,
        [key]: value
      }
    }));
  };

  const handleToggleAutoFill = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      auto_fill_requester: {
        enabled: checked
      }
    }));
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setFeedback(null);
    try {
      const requests = await registryService.fetchRequests();
      const lookups = await getLookups();
      const currentSettings = await getSettings();

      const backupData = {
        app: 'spc-procurement',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        settings: currentSettings,
        lookups,
        requests_count: requests.length,
        items_count: requests.reduce((sum, r) => sum + (r.items?.length || 0), 0),
        requests
      };

      const dateStr = new Date().toISOString().substring(0, 10);
      const jsonStr = JSON.stringify(backupData, null, 2);
      await platform.file.saveFile(`نسخة_احتياطية_المشتريات_${dateStr}.json`, jsonStr, 'application/json');

      const excelBytes = exportRegistryToExcel(requests);
      await platform.file.saveFile(
        `نسخة_احتياطية_سجل_الشراء_${dateStr}.xlsx`,
        excelBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      const nowIso = new Date().toISOString();
      setLastBackupDate(nowIso);
      setIsBackupDue(false);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('spc_last_backup_date', nowIso);
        }
      } catch {
        // ignore
      }

      setFeedback({
        type: 'success',
        message: 'تم تصدير النسخة الاحتياطية بنجاح بصيغتي JSON و Excel (17 عموداً).'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `فشل إنشاء النسخة الاحتياطية: ${err?.message || 'خطأ غير معروف'}`
      });
    } finally {
      setBackingUp(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">جاري تحميل الإعدادات...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <SettingsIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">إعدادات المنظومة</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">تخصيص أسماء التواقيع، العملة، مجلد الأرشيف، والنسخ الاحتياطي</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* قسم النسخ الاحتياطي */}
      <SettingsBackupSection
        backingUp={backingUp}
        lastBackupDate={lastBackupDate}
        isBackupDue={isBackupDue}
        onBackupNow={handleBackupNow}
      />

      {/* قسم التواقيع */}
      <SettingsSignatoriesSection
        settings={settings}
        onChangeSignatory={handleChangeSignatory}
        onToggleAutoFill={handleToggleAutoFill}
      />

      {/* العملة ومجلد الأرشيف */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Coins className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">العملة الافتراضية (D19)</h2>
              <p className="text-xs text-slate-500">اسم ورمز العملة المعتمدة في طلبات الشراء</p>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">اسم العملة:</label>
              <input
                type="text"
                value={settings.currency.name}
                onChange={(e) => setSettings((p) => ({ ...p, currency: { ...p.currency, name: e.target.value } }))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">رمز / اختصار العملة:</label>
              <input
                type="text"
                value={settings.currency.symbol}
                onChange={(e) => setSettings((p) => ({ ...p, currency: { ...p.currency, symbol: e.target.value } }))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Folder className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">مجلد الأرشيف المحلي (D10)</h2>
              <p className="text-xs text-slate-500">المسار الافتراضي لحفظ ملفات PDF التصديرية</p>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">مسار المجلد:</label>
              <input
                type="text"
                value={settings.archive_dir.path}
                onChange={(e) => setSettings((p) => ({ ...p, archive_dir: { ...p.archive_dir, path: e.target.value } }))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * src/renderer/components/settings/SettingsBackupSection.tsx
 * قسم النسخ الاحتياطي الشامل (JSON و Excel)، التذكير الأسبوعي، وملاحظة خمول الخطة المجانية
 */

import React from 'react';
import { Download, Database, Clock, FileSpreadsheet, AlertTriangle } from 'lucide-react';

interface SettingsBackupSectionProps {
  backingUp: boolean;
  lastBackupDate: string | null;
  isBackupDue: boolean;
  onBackupNow: () => void;
}

export const SettingsBackupSection: React.FC<SettingsBackupSectionProps> = ({
  backingUp,
  lastBackupDate,
  isBackupDue,
  onBackupNow
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-700" />
          <div>
            <h2 className="text-sm font-bold text-slate-800">النسخ الاحتياطي الشامل للبيانات</h2>
            <p className="text-xs text-slate-500">تصدير كامل لقاعدة البيانات (الطلبات، المواد، الإعدادات، والقوائم)</p>
          </div>
        </div>
        <button
          onClick={onBackupNow}
          disabled={backingUp}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
        >
          {backingUp ? <Clock className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{backingUp ? 'جاري تصدير النسخة...' : 'نسخة احتياطية الآن (JSON + Excel)'}</span>
        </button>
      </div>

      {isBackupDue && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            تذكير دوري: مرّ أكثر من 7 أيام منذ آخر نسخة احتياطية (أو لم تُنشأ بعد). يُوصى بتصدير نسخة أسبوعياً لضمان سلامة السجلات.
          </span>
        </div>
      )}

      {lastBackupDate && (
        <p className="text-[11px] text-slate-500 font-mono">
          تاريخ آخر نسخة احتياطية تم تصديرها: {new Date(lastBackupDate).toLocaleString('ar-SY')}
        </p>
      )}

      {/* ملاحظة خمول الخطة المجانية */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>ملاحظة تقنية حول استمرارية قاعدة البيانات:</strong> تتوقف مشاريع Supabase على الخطة المجانية تلقائياً
          (Pause) بعد أسبوع من عدم النشاط. يضمن تحميل النسخة الاحتياطية بصيغتي JSON و Excel (17 عموداً) إمكانية استعادة
          النظام بالكامل في أي وقت عبر أداة الاستعادة (<code className="font-mono text-slate-800">#/tools/restore</code>).
        </p>
      </div>
    </div>
  );
};

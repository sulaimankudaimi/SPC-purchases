/**
 * src/renderer/components/settings/SettingsSignatoriesSection.tsx
 * قسم التواقيع الستة المعتمدة في استمارة طلب الشراء وخيار تعبئة اسم الطالب تلقائياً (D11)
 */

import React from 'react';
import { FileSignature, UserCheck } from 'lucide-react';
import { AppSettings } from '../../lib/settings';

interface SettingsSignatoriesSectionProps {
  settings: AppSettings;
  onChangeSignatory: (key: keyof AppSettings['signatories'], value: string) => void;
  onToggleAutoFill: (checked: boolean) => void;
}

export const SettingsSignatoriesSection: React.FC<SettingsSignatoriesSectionProps> = ({
  settings,
  onChangeSignatory,
  onToggleAutoFill
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <FileSignature className="w-5 h-5 text-emerald-700" />
        <div>
          <h2 className="text-sm font-bold text-slate-800">أسماء التواقيع الستة (جدول التوقيع بالاستمارة)</h2>
          <p className="text-xs text-slate-500">الأسماء الافتراضية التي تظهر في جدول التواقيع في أسفل استمارة طلب الشراء</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">1. مقدم الطلب (الطالب):</label>
          <input
            type="text"
            value={settings.signatories.requester}
            onChange={(e) => onChangeSignatory('requester', e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">2. أمين المستودع المختص:</label>
          <input
            type="text"
            value={settings.signatories.warehouse}
            onChange={(e) => onChangeSignatory('warehouse', e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">3. مدير الدائرة الطالبة:</label>
          <input
            type="text"
            value={settings.signatories.dept_manager}
            onChange={(e) => onChangeSignatory('dept_manager', e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">4. مدير الإمداد والتوريد:</label>
          <input
            type="text"
            value={settings.signatories.supply_manager}
            onChange={(e) => onChangeSignatory('supply_manager', e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">5. مدير حقول دير الزور:</label>
          <input
            type="text"
            value={settings.signatories.fields_director}
            onChange={(e) => onChangeSignatory('fields_director', e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">6. ممثل المشتريات / رئيس الشعبة:</label>
          <input
            type="text"
            value={settings.signatories.procurement}
            onChange={(e) => onChangeSignatory('procurement', e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* خيار تعبئة اسم الطالب تلقائياً (القرار D11) */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-slate-800">التعبئة التلقائية لاسم الطالب (D11)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            تعبئة خانة «الطالب» في جدول التواقيع تلقائياً بالاسم المدخل في حقل «مقدم الطلب» عند إنشاء الطلب
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.auto_fill_requester.enabled}
            onChange={(e) => onToggleAutoFill(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>
    </div>
  );
};

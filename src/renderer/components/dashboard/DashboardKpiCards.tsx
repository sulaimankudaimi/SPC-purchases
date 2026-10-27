/**
 * src/renderer/components/dashboard/DashboardKpiCards.tsx
 * بطاقات المؤشرات الرئيسية (KPIs) للوحة التحكم
 */

import React from 'react';
import { FileText, Boxes, CircleDollarSign } from 'lucide-react';
import { DashboardStats } from '../../lib/dashboardService';
import { formatMoney } from '../../../shared/money';

interface DashboardKpiCardsProps {
  stats: DashboardStats;
}

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* إجمالي الطلبات */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500">إجمالي طلبات الشراء</span>
          <div className="text-2xl font-bold font-mono text-slate-900">{stats.total_requests}</div>
          <span className="text-[11px] text-slate-400">طلب شراء نشط (غير محذوف)</span>
        </div>
        <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
          <FileText className="w-6 h-6" />
        </div>
      </div>

      {/* إجمالي المواد */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500">إجمالي عدد المواد / البنود</span>
          <div className="text-2xl font-bold font-mono text-slate-900">{stats.total_items}</div>
          <span className="text-[11px] text-slate-400">مادة مسجلة في الطلبات</span>
        </div>
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Boxes className="w-6 h-6" />
        </div>
      </div>

      {/* القيمة التقديرية الكلية */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500">القيمة التقديرية الكلية</span>
          <div className="text-2xl font-bold font-mono text-emerald-800">
            {formatMoney(stats.total_amount)} <span className="text-xs font-normal font-sans">ل.س</span>
          </div>
          <span className="text-[11px] text-slate-400">مجموع بنود الطلبات النشطة</span>
        </div>
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CircleDollarSign className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

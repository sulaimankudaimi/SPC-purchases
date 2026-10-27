/**
 * src/renderer/components/dashboard/DashboardTopLists.tsx
 * جداول أعلى الجهات الطالبة وأعلى الأقسام بحسب القيمة والعدد
 */

import React from 'react';
import { Building2 } from 'lucide-react';
import { DashboardStats } from '../../lib/dashboardService';
import { formatMoney } from '../../../shared/money';

interface DashboardTopListsProps {
  stats: DashboardStats;
}

export const DashboardTopLists: React.FC<DashboardTopListsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* أعلى الجهات الطالبة */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-800">أعلى الجهات الطالبة (Top 5)</h2>
          </div>
          <span className="text-[11px] text-slate-400">مرتبة تنازلياً بحسب القيمة</span>
        </div>

        <div className="space-y-3">
          {stats.top_entities.map((ent, idx) => {
            const percent = stats.total_amount > 0 ? Math.round((ent.amount / stats.total_amount) * 100) : 0;
            return (
              <div key={ent.entity} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{ent.entity}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({ent.count} طلبات)</span>
                  </div>
                  <div className="font-bold font-mono text-emerald-800">
                    {formatMoney(ent.amount)} <span className="text-[10px] font-normal font-sans">ل.س</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* أعلى الأقسام */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-800">أعلى الأقسام الطالبة (Top 5)</h2>
          </div>
          <span className="text-[11px] text-slate-400">بحسب إجمالي قيمة الطلبات</span>
        </div>

        <div className="space-y-3">
          {stats.top_departments.map((dept, idx) => {
            const percent = stats.total_amount > 0 ? Math.round((dept.amount / stats.total_amount) * 100) : 0;
            return (
              <div key={dept.department} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{dept.department}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({dept.count} طلبات)</span>
                  </div>
                  <div className="font-bold font-mono text-emerald-800">
                    {formatMoney(dept.amount)} <span className="text-[10px] font-normal font-sans">ل.س</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-sky-600 h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * src/renderer/components/dashboard/DashboardCharts.tsx
 * الرسوم البيانية لتوزيع الحالات والتوزيع الشهري للطلبات
 */

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { DashboardStats } from '../../lib/dashboardService';
import { formatMoney } from '../../../shared/money';

const STATUS_COLORS: Record<string, string> = {
  pending: '#2563eb',
  executed: '#059669',
  on_hold: '#d97706',
  rejected: '#e11d48',
  cancelled: '#64748b'
};

function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[160px] text-right"
        dir="rtl"
      >
        <div className="font-bold text-sm flex items-center justify-between border-b border-slate-700 pb-1">
          <span>{data.label}</span>
          <span className="text-slate-400 font-mono">{data.percentage}%</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span>عدد الطلبات:</span>
          <span className="font-bold text-white font-mono">{data.count}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span>القيمة الإجمالية:</span>
          <span className="font-bold text-emerald-400 font-mono">{formatMoney(data.amount)} ل.س</span>
        </div>
      </div>
    );
  }
  return null;
}

function CustomBarTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[170px] text-right"
        dir="rtl"
      >
        <div className="font-bold text-sm border-b border-slate-700 pb-1">{data.label || label}</div>
        <div className="flex justify-between items-center text-slate-300">
          <span>عدد الطلبات:</span>
          <span className="font-bold text-white font-mono">{data.count}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span>عدد المواد:</span>
          <span className="font-bold text-sky-400 font-mono">{data.items_count}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span>القيمة الإجمالية:</span>
          <span className="font-bold text-emerald-400 font-mono">{formatMoney(data.amount)} ل.س</span>
        </div>
      </div>
    );
  }
  return null;
}

interface DashboardChartsProps {
  stats: DashboardStats;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* التوزيع بحسب الحالة */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-800">توزيع الطلبات بحسب الحالة</h2>
          </div>
          <span className="text-[11px] text-slate-400">الحالات الخمس المعتمدة (D4)</span>
        </div>

        <div className="h-64 w-full">
          {stats.status_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {stats.status_distribution.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">لا توجد بيانات</div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-4 border-t border-slate-100">
          {stats.status_distribution.map((item) => (
            <div key={item.status} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[item.status] || '#94a3b8' }}
              />
              <span className="text-slate-600 truncate">{item.label}:</span>
              <span className="font-bold font-mono text-slate-800">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* التوزيع الشهري */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-800">التوزيع والنشاط الشهري</h2>
          </div>
          <span className="text-[11px] text-slate-400">عدد الطلبات والقيمة حسب الشهر</span>
        </div>

        <div className="h-64 w-full">
          {stats.monthly_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly_distribution} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">لا توجد بيانات شهرية</div>
          )}
        </div>

        <div className="text-[11px] text-slate-500 text-center pt-4 border-t border-slate-100">
          إجمالي الأشهر المسجلة: <span className="font-bold text-slate-700 font-mono">{stats.monthly_distribution.length}</span>
        </div>
      </div>
    </div>
  );
};

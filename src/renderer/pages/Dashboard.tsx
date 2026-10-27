/**
 * src/renderer/pages/Dashboard.tsx
 * شاشة لوحة التحكم والمؤشرات المركزية (المرحلة 9 و F5 و F6)
 * - استدعاء dashboardService (دالة dashboard_stats) حصراً
 * - إحصائيات: عدد الطلبات، عدد المواد، القيمة الإجمالية، التوزيع بالحالة وبالشهر، أعلى الجهات
 * - دعم وضع القراءة فقط دون اتصال مع كاش spc_cache_dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Calendar,
  RefreshCw,
  Filter,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { dashboardService, DashboardStats } from '../lib/dashboardService';
import { DashboardKpiCards } from '../components/dashboard/DashboardKpiCards';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { DashboardTopLists } from '../components/dashboard/DashboardTopLists';

export default function Dashboard() {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getDashboardStats(fromDate || undefined, toDate || undefined);
      setStats(data);
    } catch (err: any) {
      console.error('فشل جلب إحصائيات لوحة التحكم:', err);
      setError(err?.message || 'تعذر تحميل إحصائيات لوحة التحكم من الخادم.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleResetFilter = () => {
    setFromDate('');
    setToDate('');
  };

  const handleQuickRange = (range: 'this_month' | 'this_year' | 'last_month') => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;

    if (range === 'this_month') {
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setFromDate(start);
      setToDate(end);
    } else if (range === 'this_year') {
      setFromDate(`${y}-01-01`);
      setToDate(`${y}-12-31`);
    } else if (range === 'last_month') {
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const start = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      const lastDay = new Date(prevY, prevM, 0).getDate();
      const end = `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setFromDate(start);
      setToDate(end);
    }
  };

  return (
    <div className="space-y-6">
      {/* شارة عدم الاتصال */}
      {stats?._isOfflineCached && (
        <div className="p-3 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <span>وضع القراءة فقط دون اتصال: إحصائيات لوحة التحكم مسترجعة من آخر تخزين مؤقت.</span>
          <button onClick={() => fetchStats()} className="px-3 py-1 bg-amber-600 hover:bg-amber-700 rounded text-[11px]">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* الترويسة وأزرار الإجراءات */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <LayoutDashboard className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">لوحة التحكم والمؤشرات الإحصائية</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مؤشرات أداء طلبات الشراء المحلي والإنفاق التقديري وتوزيع الحالات
          </p>
        </div>

        <button
          onClick={() => fetchStats()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>تحديث الإحصائيات</span>
        </button>
      </div>

      {/* شريط الفلاتر الزمنية */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1 text-slate-500 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>تصفية الفترة:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-400">إلى</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={handleResetFilter}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 px-2 py-1 rounded"
              title="إعادة تعيين الفترة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إلغاء التصفية</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          <span className="text-[11px] text-slate-400 ml-1">فترات سريعة:</span>
          <button
            onClick={() => handleQuickRange('this_month')}
            className="px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            هذا الشهر
          </button>
          <button
            onClick={() => handleQuickRange('last_month')}
            className="px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            الشهر الماضي
          </button>
          <button
            onClick={() => handleQuickRange('this_year')}
            className="px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            هذا العام
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {stats && (
        <>
          <DashboardKpiCards stats={stats} />
          <DashboardCharts stats={stats} />
          <DashboardTopLists stats={stats} />
        </>
      )}
    </div>
  );
}

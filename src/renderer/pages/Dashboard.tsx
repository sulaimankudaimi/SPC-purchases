/**
 * src/renderer/pages/Dashboard.tsx
 * شاشة لوحة التحكم والمؤشرات (المرحلة 9)
 * - استخدام Recharts و dashboardService (دالة dashboard_stats) حصراً
 * - إحصائيات: عدد الطلبات، عدد المواد، القيمة الإجمالية، التوزيع بالحالة وبالشهر، أعلى الجهات
 * - مرشح الفترة الزمنية (من / إلى) مع أزرار سريعة
 * - بالعربية RTL مع التزام صارم: الإحصاءات من دالة الخدمة لا من الواجهة
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  LayoutDashboard,
  FileText,
  Boxes,
  CircleDollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RefreshCw,
  Building2,
  Filter,
  PieChart as PieIcon,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { dashboardService, DashboardStats } from '../lib/dashboardService';
import { formatMoney } from '../../shared/money';

// لوحة ألوان الحالات المعتمدة للرسوم البيانية (القرار D4 وD1)
const STATUS_COLORS: Record<string, string> = {
  pending: '#2563eb',   // أزرق - قيد الانتظار
  executed: '#059669',  // زمردي - منفذ
  on_hold: '#d97706',   // كهرماني - معلق
  rejected: '#e11d48',  // وردي غامق - مرفوض
  cancelled: '#64748b'  // رمادي - ملغى
};

// مكون تلميح مخصص للرسم الدائري (حالات الطلبات)
function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[160px] text-right" dir="rtl">
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
          <span className="font-bold text-emerald-400 font-mono">{formatMoney(data.amount, true)}</span>
        </div>
      </div>
    );
  }
  return null;
}

// مكون تلميح مخصص للرسم البياني الشهري
function CustomBarTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-lg shadow-xl text-xs space-y-2 border border-slate-700 min-w-[200px] text-right" dir="rtl">
        <div className="font-bold text-sm text-slate-100 border-b border-slate-700 pb-1 flex items-center justify-between">
          <span>{item.label || label}</span>
          <span className="text-[11px] font-mono text-slate-400">{item.month}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C5C]" />
            قيمة الإنفاق:
          </span>
          <span className="font-bold text-emerald-400 font-mono">{formatMoney(item.amount, true)}</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            عدد الطلبات:
          </span>
          <span className="font-bold text-white font-mono">{item.count} طلب</span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            عدد المواد:
          </span>
          <span className="font-bold text-white font-mono">{item.items_count} مادة</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [activeFilterLabel, setActiveFilterLabel] = useState<string>('all');

  // جلب الإحصاءات حصراً من دالة dashboardService.getDashboardStats
  const loadStats = useCallback(async (from?: string, to?: string) => {
    setIsLoading(true);
    try {
      const data = await dashboardService.getDashboardStats(from, to);
      setStats(data);
    } catch (err) {
      console.error('فشل جلب إحصائيات لوحة التحكم:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // تطبيق مرشحات التاريخ السريعة
  const handleQuickFilter = (type: 'all' | 'this_year' | 'last_30_days') => {
    setActiveFilterLabel(type);
    if (type === 'all') {
      setFromDate('');
      setToDate('');
      loadStats('', '');
    } else if (type === 'this_year') {
      const currentYear = new Date().getFullYear();
      const from = `${currentYear}-01-01`;
      const to = `${currentYear}-12-31`;
      setFromDate(from);
      setToDate(to);
      loadStats(from, to);
    } else if (type === 'last_30_days') {
      const now = new Date();
      const past = new Date();
      past.setDate(now.getDate() - 30);
      const from = past.toISOString().substring(0, 10);
      const to = now.toISOString().substring(0, 10);
      setFromDate(from);
      setToDate(to);
      loadStats(from, to);
    }
  };

  const handleApplyCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilterLabel('custom');
    loadStats(fromDate || undefined, toDate || undefined);
  };

  const handleResetFilter = () => {
    setActiveFilterLabel('all');
    setFromDate('');
    setToDate('');
    loadStats();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. الترويسة ومرشحات الفترة الزمنية */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-[#0F4C5C] rounded-lg">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">لوحة التحكم والمؤشرات</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                إحصائيات المشتريات المحلية، نسب الحالات، معدلات الإنفاق وأعلى الجهات
              </p>
            </div>
          </div>

          {/* أزرار الفلترة السريعة */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleQuickFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeFilterLabel === 'all'
                  ? 'bg-[#0F4C5C] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              كافة الفترات
            </button>
            <button
              onClick={() => handleQuickFilter('this_year')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeFilterLabel === 'this_year'
                  ? 'bg-[#0F4C5C] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              العام الحالي (2026)
            </button>
            <button
              onClick={() => handleQuickFilter('last_30_days')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeFilterLabel === 'last_30_days'
                  ? 'bg-[#0F4C5C] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              آخر 30 يوماً
            </button>
            <button
              onClick={() => loadStats(fromDate || undefined, toDate || undefined)}
              disabled={isLoading}
              title="تحديث البيانات"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0F4C5C]' : ''}`} />
            </button>
          </div>
        </div>

        {/* مرشح التاريخ المخصص (من / إلى) */}
        <form onSubmit={handleApplyCustomFilter} className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>تصفية بالفترة:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">من:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">إلى:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
            />
          </div>

          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-medium transition cursor-pointer"
          >
            <Filter className="w-3 h-3" />
            <span>تطبيق</span>
          </button>

          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>إلغاء التصفية</span>
            </button>
          )}

          {isLoading && (
            <span className="text-xs text-[#0F4C5C] font-medium mr-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0F4C5C] animate-ping" />
              جاري حساب وتحديث الإحصاءات...
            </span>
          )}
        </form>
      </div>

      {/* 2. بطاقات المؤشرات الرئيسية (4 بطاقات رئيسية) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* إجمالي الطلبات */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-[#0F4C5C]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي طلبات الشراء</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {stats ? stats.total_requests : '—'}
            </span>
            <span className="text-xs text-slate-500">طلب شراء</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-100">
            <span className="text-emerald-700 font-bold font-mono">
              {stats ? stats.executed_count : 0}
            </span>
            <span>منفذ</span>
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-blue-700 font-bold font-mono">
              {stats ? stats.pending_count : 0}
            </span>
            <span>قيد الانتظار</span>
          </div>
        </div>

        {/* عدد المواد الكلي */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-[#0F4C5C]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">عدد المواد الكلي</span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {stats ? stats.total_items : '—'}
            </span>
            <span className="text-xs text-slate-500">بند / مادة</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>معدل {stats && stats.total_requests > 0 ? (stats.total_items / stats.total_requests).toFixed(1) : 0} مواد لكل طلب شراء</span>
          </div>
        </div>

        {/* القيمة التقديرية الكلية */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-[#0F4C5C]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">القيمة التقديرية الكلية</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl font-bold font-mono text-emerald-800">
              {stats ? formatMoney(stats.total_amount) : '—'}
            </span>
            <span className="text-xs font-semibold text-emerald-700">ل.س</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 truncate">
            <span>المبالغ الفعلية والتقديرية وفق المسجل</span>
          </div>
        </div>

        {/* الطلبات قيد الانتظار */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-[#0F4C5C]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">طلبات قيد المتابعة</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-700">
              {stats ? stats.pending_count : '—'}
            </span>
            <span className="text-xs text-slate-500">طلب قيد التدقيق</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 font-mono">
            <span>بقيمة: </span>
            <span className="font-bold text-slate-800">
              {stats ? formatMoney(stats.pending_amount, true) : '0 ل.س'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. الرسوم البيانية التفاعلية Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* الرسم الأول: التوزيع الشهري للإنفاق والطلبات (يشغل عمودين) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0F4C5C]" />
              <h3 className="font-bold text-slate-900 text-sm">التطور الشهري للإنفاق والمشتريات</h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded bg-[#0F4C5C]" />
                القيمة الإجمالية (ل.س)
              </span>
            </div>
          </div>

          {stats && stats.monthly_distribution.length > 0 ? (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.monthly_distribution}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey="amount"
                    fill="#0F4C5C"
                    radius={[6, 6, 0, 0]}
                    name="قيمة الإنفاق"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Calendar className="w-8 h-8 stroke-1 text-slate-300" />
              <p className="text-xs">لا توجد بيانات شهرية للفترة المحددة</p>
            </div>
          )}
        </div>

        {/* الرسم الثاني: توزيع الحالات (Donut Chart) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-[#0F4C5C]" />
              <h3 className="font-bold text-slate-900 text-sm">توزيع حالات طلبات الشراء</h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {stats ? stats.total_requests : 0} طلب
            </span>
          </div>

          {stats && stats.total_requests > 0 ? (
            <div className="space-y-4">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.status_distribution.filter((d) => d.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {stats.status_distribution
                        .filter((d) => d.count > 0)
                        .map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] || '#94a3b8'}
                          />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* قائمة الحالات ونسبها */}
              <div className="space-y-2 text-xs pt-1 border-t border-slate-100">
                {stats.status_distribution.map((st) => (
                  <div key={st.status} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[st.status] || '#94a3b8' }}
                      />
                      <span className="text-slate-700 font-medium">{st.label}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-slate-900">{st.count}</span>
                      <span className="text-slate-400 text-[11px] w-12 text-left">
                        ({st.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 stroke-1 text-slate-300" />
              <p className="text-xs">لا توجد طلبات مسجلة لعرض توزيع الحالات</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. أعلى الجهات الطالبة وأعلى الأقسام */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* أعلى الجهات الطالبة */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#0F4C5C]" />
              <h3 className="font-bold text-slate-900 text-sm">أعلى الجهات الطالبة بالإنفاق</h3>
            </div>
            <span className="text-xs text-slate-500">أعلى 5 جهات</span>
          </div>

          {stats && stats.top_entities.length > 0 ? (
            <div className="space-y-3">
              {stats.top_entities.map((ent, idx) => {
                const percentOfTotal =
                  stats.total_amount > 0
                    ? Math.round((ent.amount / stats.total_amount) * 100)
                    : 0;
                return (
                  <div key={ent.entity} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800">{ent.entity}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-slate-500 text-[11px]">{ent.count} طلبات</span>
                        <span className="font-bold text-emerald-800">
                          {formatMoney(ent.amount, true)}
                        </span>
                      </div>
                    </div>
                    {/* شريط نسبة مئوية مرئي */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#0F4C5C] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${percentOfTotal}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              لا توجد جهات طالبة مسجلة في هذه الفترة
            </div>
          )}
        </div>

        {/* أعلى الأقسام */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-slate-900 text-sm">أعلى الأقسام الطالبة</h3>
            </div>
            <span className="text-xs text-slate-500">أعلى 5 أقسام</span>
          </div>

          {stats && stats.top_departments.length > 0 ? (
            <div className="space-y-3">
              {stats.top_departments.map((dept, idx) => {
                const percentOfTotal =
                  stats.total_amount > 0
                    ? Math.round((dept.amount / stats.total_amount) * 100)
                    : 0;
                return (
                  <div key={dept.department} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-800 font-mono font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800">{dept.department}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-slate-500 text-[11px]">{dept.count} طلبات</span>
                        <span className="font-bold text-slate-800">
                          {formatMoney(dept.amount, true)}
                        </span>
                      </div>
                    </div>
                    {/* شريط نسبة مئوية مرئي */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${percentOfTotal}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              لا توجد أقسام مسجلة في هذه الفترة
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

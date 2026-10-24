/**
 * src/renderer/lib/dashboardService.ts
 * خدمة إحصائيات لوحة التحكم المركزية (المرحلة 9)
 * - استدعاء دالة dashboard_stats(p_from, p_to) في Supabase
 * - توفير محاكاة دقيقة مطابقة لنفس المخطط عند العمل المحلي دون Supabase
 * - حساب: عدد الطلبات، عدد المواد، القيمة الإجمالية، التوزيع بالحالة، التوزيع بالشهور، وأعلى الجهات والأقسام
 * - استثناء الطلبات المحذوفة ناعماً (deleted_at is not null) التزاماً بالقرار (د)
 * - قاعدة صارمة: الإحصاءات تُحسب في هذه الدالة وتُقدَّم جاهزة للواجهة، ولا يتم الحساب داخل مكونات React
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { registryService } from './registryService';
import { RequestStatus, STATUS_ARABIC_LABELS } from '../../shared/schema';

export interface StatusDistributionItem {
  status: RequestStatus;
  label: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface MonthlyDistributionItem {
  month: string;      // YYYY-MM
  label: string;      // اسم أو نص الشهر بالعربية
  count: number;      // عدد الطلبات
  items_count: number;// عدد المواد
  amount: number;     // إجمالي القيمة
}

export interface TopEntityItem {
  entity: string;
  count: number;
  amount: number;
}

export interface TopDepartmentItem {
  department: string;
  count: number;
  amount: number;
}

export interface DashboardStats {
  total_requests: number;
  total_items: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  executed_count: number;
  executed_amount: number;
  on_hold_count: number;
  on_hold_amount: number;
  rejected_count: number;
  rejected_amount: number;
  cancelled_count: number;
  cancelled_amount: number;
  status_distribution: StatusDistributionItem[];
  monthly_distribution: MonthlyDistributionItem[];
  top_entities: TopEntityItem[];
  top_departments: TopDepartmentItem[];
}

const ARABIC_MONTH_NAMES: Record<string, string> = {
  '01': 'كانون الثاني (1)',
  '02': 'شباط (2)',
  '03': 'آذار (3)',
  '04': 'نيسان (4)',
  '05': 'أيار (5)',
  '06': 'حزيران (6)',
  '07': 'تموز (7)',
  '08': 'آب (8)',
  '09': 'أيلول (9)',
  '10': 'تشرين الأول (10)',
  '11': 'تشرين الثاني (11)',
  '12': 'كانون الأول (12)'
};

/**
 * دالة مساعدة لتنسيق اسم الشهر
 */
export function formatMonthLabel(yyyyMm: string): string {
  const parts = yyyyMm.split('-');
  if (parts.length === 2) {
    const year = parts[0];
    const month = parts[1];
    const monthName = ARABIC_MONTH_NAMES[month] || month;
    return `${monthName} ${year}`;
  }
  return yyyyMm;
}

export const dashboardService = {
  /**
   * جلب إحصائيات لوحة التحكم عبر دالة dashboard_stats مع مرشح من/إلى
   */
  async getDashboardStats(fromDate?: string, toDate?: string): Promise<DashboardStats> {
    // 1. في بيئة Supabase المربوطة
    if (isConfigured) {
      try {
        const { data, error } = await supabase.rpc('dashboard_stats', {
          p_from: fromDate || null,
          p_to: toDate || null
        });

        if (!error && data) {
          // التحقق من وجود التوزيع الشهري والمواد وإن كانت ناقصة من الدالة الأساسية نقوم بإثرائها
          const baseStats = data as any;
          const reqs = await registryService.fetchRequests({
            fromDate,
            toDate
          });

          return enrichStatsFromRequests(reqs, baseStats);
        }
      } catch (err) {
        console.warn('فشل استدعاء dashboard_stats في Supabase، الانتقال للحساب الخدمي المحلي:', err);
      }
    }

    // 2. الحساب الخدمي المحلي (المتطابق تماماً مع الدالة ومخططها)
    if (!isOfflineDemoAllowed) {
      return calculateDashboardStatsFromRequests([]);
    }

    const requests = await registryService.fetchRequests({
      fromDate,
      toDate
    });

    return calculateDashboardStatsFromRequests(requests);
  }
};

/**
 * دالة نقية لحساب كامل إحصائيات لوحة التحكم من قائمة الطلبات
 * مع استثناء الطلبات المحذوفة ناعماً وتطبيق الترتيب وحساب التوزيع
 */
export function calculateDashboardStatsFromRequests(requests: any[]): DashboardStats {
  // استثناء المحذوفة ناعماً فقط
  const activeRequests = requests.filter((r) => !r.deleted_at);

  let total_requests = activeRequests.length;
  let total_items = 0;
  let total_amount = 0;

  let pending_count = 0;
  let pending_amount = 0;
  let executed_count = 0;
  let executed_amount = 0;
  let on_hold_count = 0;
  let on_hold_amount = 0;
  let rejected_count = 0;
  let rejected_amount = 0;
  let cancelled_count = 0;
  let cancelled_amount = 0;

  const statusMap = new Map<RequestStatus, { count: number; amount: number }>();
  const monthlyMap = new Map<string, { count: number; items_count: number; amount: number }>();
  const entityMap = new Map<string, { count: number; amount: number }>();
  const deptMap = new Map<string, { count: number; amount: number }>();

  // تهيئة الحالات الخمس المعتمدة وفق القرار D4
  const allStatuses: RequestStatus[] = ['pending', 'executed', 'on_hold', 'rejected', 'cancelled'];
  for (const st of allStatuses) {
    statusMap.set(st, { count: 0, amount: 0 });
  }

  for (const req of activeRequests) {
    const itemsCount = (req.items && req.items.length) || req.items_count || 0;
    const reqAmount = req.total_amount !== undefined
      ? req.total_amount
      : (req.items || []).reduce((sum: number, itm: any) => sum + (itm.line_total || itm.qty * itm.unit_price), 0);

    total_items += itemsCount;
    total_amount += reqAmount;

    // تجميع الحالات
    const st = (req.status as RequestStatus) || 'pending';
    const curStatus = statusMap.get(st) || { count: 0, amount: 0 };
    curStatus.count += 1;
    curStatus.amount += reqAmount;
    statusMap.set(st, curStatus);

    if (st === 'pending') {
      pending_count++;
      pending_amount += reqAmount;
    } else if (st === 'executed') {
      executed_count++;
      executed_amount += reqAmount;
    } else if (st === 'on_hold') {
      on_hold_count++;
      on_hold_amount += reqAmount;
    } else if (st === 'rejected') {
      rejected_count++;
      rejected_amount += reqAmount;
    } else if (st === 'cancelled') {
      cancelled_count++;
      cancelled_amount += reqAmount;
    }

    // تجميع الشهور (YYYY-MM)
    if (req.request_date) {
      const yyyyMm = req.request_date.substring(0, 7);
      const curMonth = monthlyMap.get(yyyyMm) || { count: 0, items_count: 0, amount: 0 };
      curMonth.count += 1;
      curMonth.items_count += itemsCount;
      curMonth.amount += reqAmount;
      monthlyMap.set(yyyyMm, curMonth);
    }

    // تجميع الجهات الطالبة
    const entity = (req.entity && req.entity.trim()) || 'جهة غير محددة';
    const curEntity = entityMap.get(entity) || { count: 0, amount: 0 };
    curEntity.count += 1;
    curEntity.amount += reqAmount;
    entityMap.set(entity, curEntity);

    // تجميع الأقسام
    const dept = (req.department && req.department.trim()) || 'غير محدد';
    const curDept = deptMap.get(dept) || { count: 0, amount: 0 };
    curDept.count += 1;
    curDept.amount += reqAmount;
    deptMap.set(dept, curDept);
  }

  // إعداد مصفوفة توزيع الحالات
  const status_distribution: StatusDistributionItem[] = allStatuses.map((st) => {
    const data = statusMap.get(st) || { count: 0, amount: 0 };
    const percentage = total_requests > 0 ? Math.round((data.count / total_requests) * 1000) / 10 : 0;
    return {
      status: st,
      label: STATUS_ARABIC_LABELS[st] || st,
      count: data.count,
      amount: Math.round(data.amount * 100) / 100,
      percentage
    };
  });

  // إعداد مصفوفة التوزيع الشهري مرتبة تصاعدياً زمنياً
  const sortedMonths = Array.from(monthlyMap.keys()).sort();
  const monthly_distribution: MonthlyDistributionItem[] = sortedMonths.map((m) => {
    const val = monthlyMap.get(m)!;
    return {
      month: m,
      label: formatMonthLabel(m),
      count: val.count,
      items_count: val.items_count,
      amount: Math.round(val.amount * 100) / 100
    };
  });

  // إعداد أعلى الجهات (أعلى 5 بالإنفاق)
  const top_entities: TopEntityItem[] = Array.from(entityMap.entries())
    .map(([entity, val]) => ({
      entity,
      count: val.count,
      amount: Math.round(val.amount * 100) / 100
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // إعداد أعلى الأقسام (أعلى 5 بالإنفاق)
  const top_departments: TopDepartmentItem[] = Array.from(deptMap.entries())
    .map(([department, val]) => ({
      department,
      count: val.count,
      amount: Math.round(val.amount * 100) / 100
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    total_requests,
    total_items,
    total_amount: Math.round(total_amount * 100) / 100,
    pending_count,
    pending_amount: Math.round(pending_amount * 100) / 100,
    executed_count,
    executed_amount: Math.round(executed_amount * 100) / 100,
    on_hold_count,
    on_hold_amount: Math.round(on_hold_amount * 100) / 100,
    rejected_count,
    rejected_amount: Math.round(rejected_amount * 100) / 100,
    cancelled_count,
    cancelled_amount: Math.round(cancelled_amount * 100) / 100,
    status_distribution,
    monthly_distribution,
    top_entities,
    top_departments
  };
}

function enrichStatsFromRequests(requests: any[], baseRpcStats: any): DashboardStats {
  const fullStats = calculateDashboardStatsFromRequests(requests);
  return {
    ...fullStats,
    total_requests: baseRpcStats.total_requests ?? fullStats.total_requests,
    total_amount: baseRpcStats.total_amount ?? fullStats.total_amount,
    pending_count: baseRpcStats.pending_count ?? fullStats.pending_count,
    pending_amount: baseRpcStats.pending_amount ?? fullStats.pending_amount,
    executed_count: baseRpcStats.executed_count ?? fullStats.executed_count,
    executed_amount: baseRpcStats.executed_amount ?? fullStats.executed_amount,
    on_hold_count: baseRpcStats.on_hold_count ?? fullStats.on_hold_count,
    rejected_count: baseRpcStats.rejected_count ?? fullStats.rejected_count,
    cancelled_count: baseRpcStats.cancelled_count ?? fullStats.cancelled_count
  };
}

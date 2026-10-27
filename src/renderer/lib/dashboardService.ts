/**
 * src/renderer/lib/dashboardService.ts
 * خدمة إحصائيات لوحة التحكم المركزية (المرحلة 9 والمرحلة F5)
 * - استدعاء دالة dashboard_stats(p_from, p_to) عبر RPC حصراً من Supabase
 * - خلو تام من أي تجميع في الواجهة (لا reduce ولا Map)
 * - عند فشل الاستدعاء تُلقى رسالة خطأ عربية لعرضها في الواجهة
 * - الوضع التجريبي للمطور محكوم بـ isOfflineDemoAllowed (من F2)
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { platform } from './platform';
import { RequestStatus, STATUS_ARABIC_LABELS } from '../../shared/schema';

export interface StatusDistributionItem {
  status: RequestStatus;
  label: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface MonthlyDistributionItem {
  month: string;       // YYYY-MM
  label: string;       // اسم أو نص الشهر بالعربية
  count: number;       // عدد الطلبات
  items_count: number; // عدد المواد
  amount: number;      // إجمالي القيمة
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

export interface TopRequesterItem {
  requester: string;
  count: number;
  amount: number;
}

export interface DashboardStats {
  totals: {
    requests: number;
    items: number;
    amount: number;
  };
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
  top_requesters?: TopRequesterItem[];
  _isOfflineCached?: boolean;
  _cachedAt?: string;
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

/**
 * تحويل مخرجات دالة RPC الصادرة من قاعدة البيانات إلى واجهة DashboardStats المعتمدة
 */
export function formatRpcDashboardStats(raw: any): DashboardStats {
  const totals = raw?.totals || {
    requests: Number(raw?.total_requests ?? 0),
    items: Number(raw?.total_items ?? 0),
    amount: Number(raw?.total_amount ?? 0)
  };

  const totalReqs = Number(totals.requests ?? raw?.total_requests ?? 0);
  const totalItms = Number(totals.items ?? raw?.total_items ?? 0);
  const totalAmt = Number(totals.amount ?? raw?.total_amount ?? 0);

  const rawStatuses: any[] = raw?.status_distribution || raw?.statuses || [];
  const status_distribution: StatusDistributionItem[] = rawStatuses.map((s: any) => ({
    status: s.status as RequestStatus,
    label: s.label || STATUS_ARABIC_LABELS[s.status as RequestStatus] || s.status,
    count: Number(s.count ?? 0),
    amount: Number(s.amount ?? 0),
    percentage: Number(s.percentage ?? 0)
  }));

  const rawMonthly: any[] = raw?.monthly_distribution || raw?.monthly || [];
  const monthly_distribution: MonthlyDistributionItem[] = rawMonthly.map((m: any) => ({
    month: m.month,
    label: m.label || formatMonthLabel(m.month),
    count: Number(m.count ?? m.requests_count ?? 0),
    items_count: Number(m.items_count ?? 0),
    amount: Number(m.amount ?? m.total_amount ?? 0)
  }));

  const top_entities: TopEntityItem[] = (raw?.top_entities || []).map((e: any) => ({
    entity: e.entity,
    count: Number(e.count ?? 0),
    amount: Number(e.amount ?? 0)
  }));

  const top_departments: TopDepartmentItem[] = (raw?.top_departments || []).map((d: any) => ({
    department: d.department,
    count: Number(d.count ?? 0),
    amount: Number(d.amount ?? 0)
  }));

  const top_requesters: TopRequesterItem[] = (raw?.top_requesters || []).map((q: any) => ({
    requester: q.requester,
    count: Number(q.count ?? 0),
    amount: Number(q.amount ?? 0)
  }));

  return {
    totals: {
      requests: totalReqs,
      items: totalItms,
      amount: totalAmt
    },
    total_requests: totalReqs,
    total_items: totalItms,
    total_amount: totalAmt,
    pending_count: Number(raw?.pending_count ?? 0),
    pending_amount: Number(raw?.pending_amount ?? 0),
    executed_count: Number(raw?.executed_count ?? 0),
    executed_amount: Number(raw?.executed_amount ?? 0),
    on_hold_count: Number(raw?.on_hold_count ?? 0),
    on_hold_amount: Number(raw?.on_hold_amount ?? 0),
    rejected_count: Number(raw?.rejected_count ?? 0),
    rejected_amount: Number(raw?.rejected_amount ?? 0),
    cancelled_count: Number(raw?.cancelled_count ?? 0),
    cancelled_amount: Number(raw?.cancelled_amount ?? 0),
    status_distribution,
    monthly_distribution,
    top_entities,
    top_departments,
    top_requesters
  };
}

export const dashboardService = {
  /**
   * جلب إحصائيات لوحة التحكم عبر استدعاء RPC فقط مع دعم التخزين المؤقت للقراءة دون اتصال
   */
  async getDashboardStats(fromDate?: string, toDate?: string): Promise<DashboardStats> {
    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        throw new Error('التطبيق غير مهيّأ، راجع المسؤول');
      }
      // في وضع العرض التجريبي للمطور
      return formatRpcDashboardStats({
        totals: { requests: 0, items: 0, amount: 0 },
        total_requests: 0,
        total_items: 0,
        total_amount: 0,
        statuses: [],
        monthly: [],
        top_entities: [],
        top_departments: []
      });
    }

    try {
      const { data, error } = await supabase.rpc('dashboard_stats', {
        p_from: fromDate || null,
        p_to: toDate || null
      });

      if (error) {
        throw new Error(`تعذر جلب إحصائيات لوحة التحكم من الخادم: ${error.message}`);
      }

      if (!data) {
        throw new Error('لم يتم استلام أي بيانات إحصائية من الخادم');
      }

      const formatted = formatRpcDashboardStats(data);
      // حفظ آخر قراءة ناجحة مؤقتاً لعرضها عند انقطاع الاتصال (المرحلة 9)
      if (!fromDate && !toDate) {
        platform.session.set('spc_cache_dashboard', JSON.stringify({
          cached_at: new Date().toISOString(),
          stats: formatted
        })).catch(() => {});
      }

      return formatted;
    } catch (err: any) {
      // عند فشل الاتصال، نحاول استرجاع آخر قراءة مخزنة مؤقتاً
      try {
        const cachedRaw = await platform.session.get('spc_cache_dashboard');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed && parsed.stats) {
            return {
              ...parsed.stats,
              _isOfflineCached: true,
              _cachedAt: parsed.cached_at
            };
          }
        }
      } catch {
        // تجاهل
      }
      throw err;
    }
  }
};


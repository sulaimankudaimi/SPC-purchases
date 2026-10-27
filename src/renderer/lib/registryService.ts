/**
 * src/renderer/lib/registryService.ts
 * خدمة سجل طلبات الشراء والمواد (المرحلة 8)
 * - استعلام السجل مع الترتيب بالتاريخ تنازلياً ثم الرمز، والبحث المتعدد والتصفية (الحالة، التاريخ)
 * - تغيير الحالة مع إلزامية سبب الرفض/التريث، وتسجيل audit_log
 * - تعديل الطلب والمواد وتوثيق التعديل في audit_log
 * - الحذف الناعم (deleted_at) فقط، مع حظر قاطع لأي حذف فيزيائي (القرار د و O4)
 * - إزالة شارة needs_review بقرار المستخدم
 * - رفع وحفظ مسار الفاتورة في حاوية invoices (invoice_storage_path)
 * - تصدير السجل إلى Excel (17 عموداً A–Q مع دمج خلايا الطلب رأسياً) وفق SPEC §1.5
 */

import * as XLSX from 'xlsx';
import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { platform } from './platform';
import { RequestStatus, STATUS_ARABIC_LABELS } from '../../shared/schema';
import { formatDateDDMMYYYY } from '../../shared/dates';
import { parseLegacyRows } from '../../../scripts/import-core';
import { generateLegacyExcelRows } from '../../../scripts/generate-legacy-excel';

export interface RegistryItem {
  id: string;
  request_id: string;
  line_no: number;
  name: string;
  specs: string | null;
  unit: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  legacy_total?: number | null;
  notes: string | null;
}

export interface RegistryRequest {
  id: string;
  code: string;
  code_norm?: string;
  request_date: string;
  entity: string;
  requester: string;
  department: string | null;
  delivery_place: string | null;
  delivery_date: string | null;
  currency: string;
  status: RequestStatus;
  status_note: string | null;
  notes: string | null;
  signatories?: Record<string, string>;
  pdf_local_path: string | null;
  pdf_storage_path: string | null;
  invoice_storage_path: string | null;
  needs_review: boolean;
  legacy_row?: number | null;
  created_at?: string;
  updated_at?: string;
  deleted_at: string | null;
  items: RegistryItem[];
  items_count?: number;
  total_amount?: number;
  is_outbox?: boolean;
  needs_sync?: boolean;
  _isOfflineCached?: boolean;
}

export interface RegistryFilter {
  search?: string;
  status?: RequestStatus | 'all';
  fromDate?: string;
  toDate?: string;
  needsReviewOnly?: boolean;
}

export interface AuditLogEntry {
  id: number | string;
  request_id: string;
  action: string;
  old: any;
  new: any;
  at: string;
  by?: string | null;
}

export interface UpdateRequestInput {
  entity?: string;
  requester?: string;
  department?: string | null;
  delivery_place?: string | null;
  delivery_date?: string | null;
  currency?: string;
  notes?: string | null;
  items?: Array<{
    id?: string;
    line_no: number;
    name: string;
    specs?: string | null;
    unit?: string | null;
    qty: number;
    unit_price: number;
    notes?: string | null;
  }>;
}

/**
 * دالة مساعدة لتهيئة وتحميل البيانات المحلية عند العمل دون Supabase
 */
async function getLocalStore(): Promise<{ requests: RegistryRequest[]; auditLogs: AuditLogEntry[] }> {
  try {
    const rawReq = await platform.session.get('spc_registry_requests');
    const rawLogs = await platform.session.get('spc_audit_logs');
    let requests: RegistryRequest[] = rawReq ? JSON.parse(rawReq) : [];
    let auditLogs: AuditLogEntry[] = rawLogs ? JSON.parse(rawLogs) : [];

    // إذا كان التخزين المحلي فارغاً، نقوم بالتهيئة من العينة المعتمدة (51 طلباً و158 مادة)
    if (requests.length === 0) {
      const legacyRows = generateLegacyExcelRows();
      const parsed = parseLegacyRows(legacyRows);
      requests = parsed.requests.map((r, idx) => ({
        id: r.id || `req_legacy_${idx + 1}`,
        code: r.code,
        code_norm: r.code_norm,
        request_date: r.request_date,
        entity: r.entity,
        requester: r.requester,
        department: r.department,
        delivery_place: r.delivery_place,
        delivery_date: r.delivery_date,
        currency: r.currency || 'ليرة سورية جديدة',
        status: r.status as RequestStatus,
        status_note: r.status_note,
        notes: r.notes,
        signatories: {},
        pdf_local_path: r.pdf_local_path,
        pdf_storage_path: null,
        invoice_storage_path: null,
        needs_review: r.needs_review,
        legacy_row: r.legacy_row,
        created_at: new Date(2026, 7, 19).toISOString(),
        updated_at: new Date(2026, 7, 19).toISOString(),
        deleted_at: null,
        items: r.items.map((itm) => ({
          id: itm.id,
          request_id: itm.request_id,
          line_no: itm.line_no,
          name: itm.name,
          specs: itm.specs,
          unit: itm.unit,
          qty: itm.qty,
          unit_price: itm.unit_price,
          line_total: itm.line_total,
          legacy_total: itm.legacy_total,
          notes: itm.notes
        }))
      }));

      // دمج أي طلبات تم حفظها مسبقاً في spc_saved_requests
      const extraRaw = await platform.session.get('spc_saved_requests');
      if (extraRaw) {
        const extra: any[] = JSON.parse(extraRaw);
        for (const er of extra) {
          if (!requests.some((r) => r.code === er.code)) {
            requests.unshift({
              id: er.id,
              code: er.code,
              code_norm: er.code.toLowerCase().replace(/\s+/g, ''),
              request_date: er.request_date,
              entity: er.entity,
              requester: er.requester,
              department: er.department || null,
              delivery_place: er.delivery_place || null,
              delivery_date: er.delivery_date || null,
              currency: er.currency || 'ليرة سورية جديدة',
              status: er.status || 'pending',
              status_note: er.status_note || null,
              notes: er.notes || null,
              signatories: er.signatories || {},
              pdf_local_path: er.pdf_local_path || null,
              pdf_storage_path: er.pdf_storage_path || null,
              invoice_storage_path: er.invoice_storage_path || null,
              needs_review: false,
              deleted_at: null,
              items: (er.items || []).map((itm: any, i: number) => ({
                id: `itm_${er.id}_${i + 1}`,
                request_id: er.id,
                line_no: itm.line_no || (i + 1),
                name: itm.name,
                specs: itm.specs || null,
                unit: itm.unit || null,
                qty: itm.qty,
                unit_price: itm.unit_price,
                line_total: itm.qty * itm.unit_price,
                notes: itm.notes || null
              }))
            });
          }
        }
      }

      await platform.session.set('spc_registry_requests', JSON.stringify(requests));
    }

    return { requests, auditLogs };
  } catch (err) {
    console.warn('تعذر قراءة التخزين المحلي للسجل:', err);
    return { requests: [], auditLogs: [] };
  }
}

async function saveLocalStore(requests: RegistryRequest[], auditLogs?: AuditLogEntry[]): Promise<void> {
  try {
    await platform.session.set('spc_registry_requests', JSON.stringify(requests));
    if (auditLogs) {
      await platform.session.set('spc_audit_logs', JSON.stringify(auditLogs));
    }
  } catch (err) {
    console.warn('تعذر حفظ السجل محلياً:', err);
  }
}

let isLastFetchOffline = false;

/**
 * هل السجل يعمل حالياً في وضع القراءة فقط من التخزين المؤقت دون اتصال
 */
export function isOfflineRegistry(): boolean {
  return isLastFetchOffline;
}

/**
 * هل الطلب مؤهل للتصدير النهائي لـ PDF (القرار D15: يُمنع التصدير النهائي قبل المزامنة)
 */
export function canExportFinalPdf(req: RegistryRequest): boolean {
  if (req.is_outbox || req.needs_sync) return false;
  if (req.code && (req.code.startsWith('مؤقت') || req.code.includes('بانتظار الرمز'))) return false;
  return true;
}

/**
 * دمج طلبات صندوق الصادر المعلّقة في السجل لتبدو مباشرة بوسم «بانتظار المزامنة»
 */
async function mergeOutboxRequests(list: RegistryRequest[]): Promise<RegistryRequest[]> {
  try {
    const queue = await platform.outbox.getQueue();
    if (!queue || queue.length === 0) return list;

    const outboxRequests: RegistryRequest[] = queue.map((item: any) => {
      const items = (item.data?.items || []).map((itm: any, idx: number) => ({
        id: `outbox_${item.id}_${idx + 1}`,
        request_id: item.id,
        line_no: itm.line_no || (idx + 1),
        name: itm.name,
        specs: itm.specs || null,
        unit: itm.unit || null,
        qty: Number(itm.qty || 0),
        unit_price: Number(itm.unit_price || 0),
        line_total: Number(itm.qty || 0) * Number(itm.unit_price || 0),
        notes: itm.notes || null
      }));

      const totalAmount = items.reduce((sum: number, it: any) => sum + it.line_total, 0);

      return {
        id: item.id,
        code: item.temp_code || `مؤقت (${item.id.slice(0, 6)})`,
        code_norm: item.temp_code || `مؤقت (${item.id.slice(0, 6)})`,
        request_date: item.data?.request_date || new Date().toISOString().substring(0, 10),
        entity: item.data?.entity || '',
        requester: item.data?.requester || '',
        department: item.data?.department || null,
        delivery_place: item.data?.delivery_place || null,
        delivery_date: item.data?.delivery_date || null,
        currency: item.data?.currency || 'ليرة سورية جديدة',
        status: 'pending' as RequestStatus,
        status_note: 'بانتظار المزامنة',
        notes: item.data?.notes || null,
        signatories: item.signatories || {},
        pdf_local_path: null,
        pdf_storage_path: null,
        invoice_storage_path: null,
        needs_review: false,
        legacy_row: null,
        created_at: item.enqueued_at || new Date().toISOString(),
        updated_at: item.enqueued_at || new Date().toISOString(),
        deleted_at: null,
        items,
        items_count: items.length,
        total_amount: totalAmount,
        is_outbox: true,
        needs_sync: true
      };
    });

    const existingIds = new Set(list.map((r) => r.id));
    const newOutbox = outboxRequests.filter((r) => !existingIds.has(r.id));
    return [...newOutbox, ...list];
  } catch {
    return list;
  }
}

export const registryService = {
  /**
   * 1. جلب الطلبات مع الترتيب والبحث والتصفية (باستثناء المحذوفة ناعماً)
   * الترتيب: التاريخ تنازلياً ثم الرمز تنازلياً
   */
  async fetchRequests(filter?: RegistryFilter): Promise<RegistryRequest[]> {
    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        return [];
      }
      const { requests } = await getLocalStore();

      // تصفية المحذوفة ناعماً (deleted_at != null)
      let list = requests.filter((r) => !r.deleted_at);

      // تصفية الحالة
      if (filter?.status && filter.status !== 'all') {
        list = list.filter((r) => r.status === filter.status);
      }

      // تصفية يحتاج مراجعة
      if (filter?.needsReviewOnly) {
        list = list.filter((r) => r.needs_review === true);
      }

      // تصفية التاريخ
      if (filter?.fromDate) {
        list = list.filter((r) => r.request_date >= filter.fromDate!);
      }
      if (filter?.toDate) {
        list = list.filter((r) => r.request_date <= filter.toDate!);
      }

      // تصفية البحث النصي (الرمز، الجهة، مقدم الطلب، اسم أي مادة في الطلب)
      if (filter?.search && filter.search.trim() !== '') {
        const q = filter.search.trim().toLowerCase();
        list = list.filter((r) => {
          const inCode = r.code.toLowerCase().includes(q);
          const inEntity = r.entity.toLowerCase().includes(q);
          const inRequester = r.requester.toLowerCase().includes(q);
          const inItems = (r.items || []).some((itm) => itm.name.toLowerCase().includes(q));
          return inCode || inEntity || inRequester || inItems;
        });
      }

      // الترتيب: التاريخ تنازلياً ثم الرمز
      list.sort((a, b) => {
        if (a.request_date !== b.request_date) {
          return b.request_date.localeCompare(a.request_date);
        }
        return b.code.localeCompare(a.code);
      });

      // حساب عدد المواد والمجموع الكلي لكل طلب ودمج عناصر الصندوق الصادر المعلّقة
      const mapped = list.map((r) => {
        const items = r.items || [];
        const total = items.reduce((sum, itm) => sum + (itm.line_total || itm.qty * itm.unit_price), 0);
        return {
          ...r,
          items,
          items_count: items.length,
          total_amount: total
        };
      });

      return await mergeOutboxRequests(mapped);
    }

    // التنفيذ الفعلي عبر Supabase عند وجود الاتصال
    try {
      let query = supabase
        .from('requests')
        .select(`
          *,
          items:request_items(*)
        `)
        .is('deleted_at', null)
        .order('request_date', { ascending: false })
        .order('code', { ascending: false });

      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }
      if (filter?.needsReviewOnly) {
        query = query.eq('needs_review', true);
      }
      if (filter?.fromDate) {
        query = query.gte('request_date', filter.fromDate);
      }
      if (filter?.toDate) {
        query = query.lte('request_date', filter.toDate);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let results: RegistryRequest[] = (data || []).map((row: any) => {
        const items: RegistryItem[] = (row.items || []).sort((a: any, b: any) => a.line_no - b.line_no);
        const total = items.reduce((sum, itm) => sum + (itm.line_total || itm.qty * itm.unit_price), 0);
        return {
          id: row.id,
          code: row.code,
          code_norm: row.code_norm,
          request_date: row.request_date,
          entity: row.entity,
          requester: row.requester,
          department: row.department,
          delivery_place: row.delivery_place,
          delivery_date: row.delivery_date,
          currency: row.currency,
          status: row.status,
          status_note: row.status_note,
          notes: row.notes,
          signatories: row.signatories || {},
          pdf_local_path: row.pdf_local_path,
          pdf_storage_path: row.pdf_storage_path,
          invoice_storage_path: row.invoice_storage_path,
          needs_review: row.needs_review,
          legacy_row: row.legacy_row,
          created_at: row.created_at,
          updated_at: row.updated_at,
          deleted_at: row.deleted_at,
          items,
          items_count: items.length,
          total_amount: total
        };
      });

      // البحث في أسماء المواد على مستوى العميل إذا تضمّن البحث
      if (filter?.search && filter.search.trim() !== '') {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((r) => {
          const inCode = r.code.toLowerCase().includes(q);
          const inEntity = r.entity.toLowerCase().includes(q);
          const inRequester = r.requester.toLowerCase().includes(q);
          const inItems = r.items.some((itm) => itm.name.toLowerCase().includes(q));
          return inCode || inEntity || inRequester || inItems;
        });
      }

      // حفظ النتيجة بنجاح في التخزين المؤقت لتمكين القراءة دون اتصال (المرحلة 9)
      if (!filter?.search && (!filter?.status || filter.status === 'all') && !filter?.fromDate && !filter?.toDate && !filter?.needsReviewOnly) {
        platform.session.set('spc_cache_registry', JSON.stringify({
          cached_at: new Date().toISOString(),
          requests: results
        })).catch(() => {});
      }

      isLastFetchOffline = false;
      return await mergeOutboxRequests(results);
    } catch (err: any) {
      console.warn('فشل جلب السجل من Supabase، استخدام التخزين المؤقت للقراءة دون اتصال:', err);
      isLastFetchOffline = true;

      // محاولة قراءة آخر نسخة مخزنة مؤقتاً
      try {
        const cachedRaw = await platform.session.get('spc_cache_registry');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed && Array.isArray(parsed.requests)) {
            let list: RegistryRequest[] = parsed.requests.map((r: any) => ({ ...r, _isOfflineCached: true }));
            if (filter?.status && filter.status !== 'all') {
              list = list.filter((r) => r.status === filter.status);
            }
            if (filter?.needsReviewOnly) {
              list = list.filter((r) => r.needs_review === true);
            }
            if (filter?.fromDate) {
              list = list.filter((r) => r.request_date >= filter.fromDate!);
            }
            if (filter?.toDate) {
              list = list.filter((r) => r.request_date <= filter.toDate!);
            }
            if (filter?.search && filter.search.trim() !== '') {
              const q = filter.search.trim().toLowerCase();
              list = list.filter((r) => {
                const inCode = r.code.toLowerCase().includes(q);
                const inEntity = r.entity.toLowerCase().includes(q);
                const inRequester = r.requester.toLowerCase().includes(q);
                const inItems = r.items.some((itm) => itm.name.toLowerCase().includes(q));
                return inCode || inEntity || inRequester || inItems;
              });
            }
            return await mergeOutboxRequests(list);
          }
        }
      } catch {
        // fallback to local demo store
      }

      const { requests } = await getLocalStore();
      const demoList = requests.map((r) => ({ ...r, _isOfflineCached: true }));
      return await mergeOutboxRequests(demoList);
    }
  },

  /**
   * 2. تغيير حالة الطلب مع إلزامية السبب عند الرفض أو التريث، وتسجيل audit_log
   */
  async changeStatus(
    requestId: string,
    newStatus: RequestStatus,
    statusNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    // إلزامية السبب عند الرفض أو التريث
    if ((newStatus === 'rejected' || newStatus === 'on_hold') && (!statusNote || statusNote.trim() === '')) {
      const statusLabel = STATUS_ARABIC_LABELS[newStatus] || newStatus;
      return { success: false, error: `بيان سبب الحالة (${statusLabel}) إلزامي.` };
    }

    const note = statusNote ? statusNote.trim() : null;

    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
      }
      const { requests, auditLogs } = await getLocalStore();
      const target = requests.find((r) => r.id === requestId);
      if (!target) {
        return { success: false, error: 'الطلب غير موجود بالسجل.' };
      }

      const oldStatus = target.status;
      const oldNote = target.status_note;

      target.status = newStatus;
      target.status_note = note;
      target.updated_at = new Date().toISOString();

      // تسجيل العملية في audit_log
      const logEntry: AuditLogEntry = {
        id: Date.now(),
        request_id: requestId,
        action: 'status_change',
        old: { status: oldStatus, status_note: oldNote },
        new: { status: newStatus, status_note: note },
        at: new Date().toISOString()
      };
      auditLogs.push(logEntry);

      await saveLocalStore(requests, auditLogs);
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('requests')
        .update({
          status: newStatus,
          status_note: note
        })
        .eq('id', requestId);

      if (error) throw new Error(error.message);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل تحديث الحالة' };
    }
  },

  /**
   * 3. تعديل بيانات الطلب ومواده، مع تسجيل التغيير في audit_log
   */
  async updateRequest(
    requestId: string,
    patch: UpdateRequestInput
  ): Promise<{ success: boolean; error?: string }> {
    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
      }
      const { requests, auditLogs } = await getLocalStore();
      const target = requests.find((r) => r.id === requestId);
      if (!target) {
        return { success: false, error: 'الطلب غير موجود بالسجل.' };
      }

      const oldState = {
        entity: target.entity,
        requester: target.requester,
        department: target.department,
        delivery_place: target.delivery_place,
        delivery_date: target.delivery_date,
        currency: target.currency,
        notes: target.notes,
        items: target.items.map((i) => ({ ...i }))
      };

      if (patch.entity !== undefined) target.entity = patch.entity.trim();
      if (patch.requester !== undefined) target.requester = patch.requester.trim();
      if (patch.department !== undefined) target.department = patch.department ? patch.department.trim() : null;
      if (patch.delivery_place !== undefined) target.delivery_place = patch.delivery_place ? patch.delivery_place.trim() : null;
      if (patch.delivery_date !== undefined) target.delivery_date = patch.delivery_date || null;
      if (patch.currency !== undefined) target.currency = patch.currency.trim();
      if (patch.notes !== undefined) target.notes = patch.notes ? patch.notes.trim() : null;

      if (patch.items && patch.items.length > 0) {
        target.items = patch.items.map((item, idx) => ({
          id: item.id || `itm_${requestId}_${idx + 1}`,
          request_id: requestId,
          line_no: item.line_no || (idx + 1),
          name: item.name.trim(),
          specs: item.specs ? item.specs.trim() : null,
          unit: item.unit ? item.unit.trim() : null,
          qty: item.qty,
          unit_price: item.unit_price,
          line_total: item.qty * item.unit_price,
          notes: item.notes ? item.notes.trim() : null
        }));
      }

      target.updated_at = new Date().toISOString();

      const logEntry: AuditLogEntry = {
        id: Date.now(),
        request_id: requestId,
        action: 'update_request',
        old: oldState,
        new: {
          entity: target.entity,
          requester: target.requester,
          department: target.department,
          delivery_place: target.delivery_place,
          delivery_date: target.delivery_date,
          currency: target.currency,
          notes: target.notes,
          items: target.items
        },
        at: new Date().toISOString()
      };
      auditLogs.push(logEntry);

      await saveLocalStore(requests, auditLogs);
      return { success: true };
    }

    try {
      // جلب الحالة القديمة
      const { data: oldReq } = await supabase.from('requests').select('*').eq('id', requestId).single();

      const updateData: any = {};
      if (patch.entity !== undefined) updateData.entity = patch.entity.trim();
      if (patch.requester !== undefined) updateData.requester = patch.requester.trim();
      if (patch.department !== undefined) updateData.department = patch.department ? patch.department.trim() : null;
      if (patch.delivery_place !== undefined) updateData.delivery_place = patch.delivery_place ? patch.delivery_place.trim() : null;
      if (patch.delivery_date !== undefined) updateData.delivery_date = patch.delivery_date || null;
      if (patch.currency !== undefined) updateData.currency = patch.currency.trim();
      if (patch.notes !== undefined) updateData.notes = patch.notes ? patch.notes.trim() : null;

      const { error: reqErr } = await supabase.from('requests').update(updateData).eq('id', requestId);
      if (reqErr) throw new Error(reqErr.message);

      // تحديث المواد إن وجدت
      if (patch.items && patch.items.length > 0) {
        // حذف المواد السابقة ثم إعادة إدراج المواد المحدثة
        await supabase.from('request_items').delete().eq('request_id', requestId);
        const newItems = patch.items.map((itm, idx) => ({
          request_id: requestId,
          line_no: itm.line_no || (idx + 1),
          name: itm.name.trim(),
          specs: itm.specs ? itm.specs.trim() : null,
          unit: itm.unit ? itm.unit.trim() : null,
          qty: itm.qty,
          unit_price: itm.unit_price,
          notes: itm.notes ? itm.notes.trim() : null
        }));
        const { error: itemErr } = await supabase.from('request_items').insert(newItems);
        if (itemErr) throw new Error(itemErr.message);
      }

      // إدراج سجل audit_log يدوياً للتعديل العام
      await supabase.from('audit_log').insert({
        request_id: requestId,
        action: 'update_request',
        old: oldReq,
        new: updateData
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حفظ التعديلات' };
    }
  },

  /**
   * 4. الحذف الناعم فقط عبر deleted_at (القرار د و O4)
   * مع تسجيل العملية في audit_log
   */
  async softDelete(requestId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const timestamp = new Date().toISOString();

    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
      }
      const { requests, auditLogs } = await getLocalStore();
      const target = requests.find((r) => r.id === requestId);
      if (!target) {
        return { success: false, error: 'الطلب غير موجود.' };
      }

      target.deleted_at = timestamp;
      target.updated_at = timestamp;

      const logEntry: AuditLogEntry = {
        id: Date.now(),
        request_id: requestId,
        action: 'soft_delete',
        old: { deleted_at: null },
        new: { deleted_at: timestamp, reason: reason || 'حذف ناعم' },
        at: timestamp
      };
      auditLogs.push(logEntry);

      await saveLocalStore(requests, auditLogs);
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('requests')
        .update({ deleted_at: timestamp })
        .eq('id', requestId);

      if (error) throw new Error(error.message);

      await supabase.from('audit_log').insert({
        request_id: requestId,
        action: 'soft_delete',
        old: { deleted_at: null },
        new: { deleted_at: timestamp, reason: reason || 'حذف ناعم' }
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل الحذف الناعم' };
    }
  },

  /**
   * 5. حظر قاطع لأي حذف فيزيائي من قاعدة البيانات (ممنوع: حذف فعلي)
   */
  async hardDelete(_requestId: string): Promise<never> {
    throw new Error('الحذف الفعلي محظور تماماً وفق دستور المشروع CLAUDE.md والقرار (د). الحذف المسموح به هو الحذف الناعم (softDelete) عبر حقل deleted_at فقط.');
  },

  /**
   * 6. إزالة شارة «يحتاج مراجعة» بقرار المستخدم
   */
  async resolveNeedsReview(requestId: string): Promise<{ success: boolean; error?: string }> {
    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
      }
      const { requests, auditLogs } = await getLocalStore();
      const target = requests.find((r) => r.id === requestId);
      if (!target) {
        return { success: false, error: 'الطلب غير موجود.' };
      }

      target.needs_review = false;
      target.updated_at = new Date().toISOString();

      const logEntry: AuditLogEntry = {
        id: Date.now(),
        request_id: requestId,
        action: 'resolve_needs_review',
        old: { needs_review: true },
        new: { needs_review: false },
        at: new Date().toISOString()
      };
      auditLogs.push(logEntry);

      await saveLocalStore(requests, auditLogs);
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('requests')
        .update({ needs_review: false })
        .eq('id', requestId);

      if (error) throw new Error(error.message);

      await supabase.from('audit_log').insert({
        request_id: requestId,
        action: 'resolve_needs_review',
        old: { needs_review: true },
        new: { needs_review: false }
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل إزالة شارة المراجعة' };
    }
  },

  /**
   * 7. رفع فاتورة إلى حاوية invoices وحفظ invoice_storage_path
   */
  async uploadInvoice(
    requestId: string,
    file: Blob | Uint8Array | string,
    fileName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const cleanFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    const storagePath = `${requestId}/${cleanFileName}`;

    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
      }
      const { requests } = await getLocalStore();
      const target = requests.find((r) => r.id === requestId);
      if (target) {
        target.invoice_storage_path = storagePath;
        target.updated_at = new Date().toISOString();
        await saveLocalStore(requests);
      }
      return { success: true, path: storagePath };
    }

    try {
      let blobToUpload: Blob;
      if (file instanceof Blob) {
        blobToUpload = file;
      } else if (typeof file === 'string') {
        blobToUpload = new Blob([file], { type: 'application/pdf' });
      } else {
        blobToUpload = new Blob([file as BlobPart], { type: 'application/pdf' });
      }

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(storagePath, blobToUpload, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from('requests')
        .update({ invoice_storage_path: storagePath })
        .eq('id', requestId);

      if (updateError) throw new Error(updateError.message);

      return { success: true, path: storagePath };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل رفع الفاتورة' };
    }
  },

  /**
   * 8. استرجاع سجل التدقيق audit_log لطلب محدد
   */
  async getAuditLogs(requestId: string): Promise<AuditLogEntry[]> {
    if (!isConfigured) {
      if (!isOfflineDemoAllowed) {
        return [];
      }
      const { auditLogs } = await getLocalStore();
      return auditLogs.filter((l) => l.request_id === requestId);
    }

    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('request_id', requestId)
        .order('at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    } catch (err) {
      console.warn('تعذر جلب audit_log:', err);
      return [];
    }
  },

  /**
   * 9. تصدير السجل إلى ملف Excel متطابق تماماً مع سجل_الشراء_المحلي.xlsx
   * - ورقة Sheet1، اتجاه RTL
   * - 17 عموداً (A–Q) بالترتيب المعتمد في SPEC §1.5
   * - A1 = «سجل الشراء المحلي»
   * - A2–Q2 = رؤوس الأعمدة
   * - الأعمدة A–G و P و Q مدمجة رأسياً على عدد مواد كل طلب؛ الأعمدة H–O سطر لكل مادة
   * - عروض الأعمدة المحددة بـ SPEC §1.5
   */
  exportRegistry(requests: RegistryRequest[]): Uint8Array {
    return exportRegistryToExcel(requests);
  }
};

/**
 * دالة بناء ورقة العمل Sheet1 ببيانات السجل وتنسيق SPEC §1.5
 */
export function createRegistryWorksheet(requests: RegistryRequest[]): XLSX.WorkSheet {
  // تعريف رؤوس الأعمدة الـ 17 وفق SPEC §1.5
  const headers = [
    'ت', // A: ت
    'ترميز طلب الشراء', // B: ترميز طلب الشراء
    'تاريخ الطلب', // C: تاريخ الطلب
    'الجهة الطالبة', // D: الجهة الطالبة
    'مقدم الطلب', // E: مقدم الطلب
    'القسم الطالب', // F: القسم الطالب
    'عنوان التسليم', // G: عنوان التسليم
    'اسم المادة / الخدمة', // H: اسم المادة / الخدمة
    'المواصفات الفنية', // I: المواصفات الفنية
    'وحدة القياس', // J: وحدة القياس
    'العدد / الكمية', // K: العدد / الكمية
    'السعر التقديري', // L: السعر التقديري
    'الإجمالي', // M: الإجمالي
    'ملاحظات', // N: ملاحظات
    'حالة الطلب', // O: حالة الطلب
    'ملف الطلب', // P: ملف الطلب
    'ملف الفاتورة والطلب' // Q: ملف الفاتورة والطلب
  ];

  const row1 = ['سجل الشراء المحلي'];
  const row2 = headers;
  const dataRows: any[][] = [row1, row2];
  const merges: XLSX.Range[] = [];

  let currentRowIdx = 2; // الصف 3 في Excel (0-indexed = 2)
  let requestSeq = 1;

  for (const req of requests) {
    const items = req.items && req.items.length > 0
      ? req.items
      : [{
          id: '',
          request_id: req.id,
          line_no: 1,
          name: '',
          specs: '',
          unit: '',
          qty: 0,
          unit_price: 0,
          line_total: 0,
          notes: ''
        }];

    const itemCount = items.length;
    const startRow = currentRowIdx;
    const endRow = currentRowIdx + itemCount - 1;

    const dateFormatted = formatDateDDMMYYYY(req.request_date) || req.request_date;
    const statusText = req.status_note
      ? `${STATUS_ARABIC_LABELS[req.status] || req.status} (${req.status_note})`
      : (STATUS_ARABIC_LABELS[req.status] || req.status);

    for (let i = 0; i < itemCount; i++) {
      const itm = items[i];
      const isFirstItemOfRequest = i === 0;

      const rowData = [
        isFirstItemOfRequest ? requestSeq : '',
        isFirstItemOfRequest ? req.code : '',
        isFirstItemOfRequest ? dateFormatted : '',
        isFirstItemOfRequest ? req.entity : '',
        isFirstItemOfRequest ? req.requester : '',
        isFirstItemOfRequest ? (req.department || '') : '',
        isFirstItemOfRequest ? (req.delivery_place || '') : '',
        itm.name || '',
        itm.specs || '',
        itm.unit || '',
        itm.qty || 0,
        itm.unit_price || 0,
        itm.line_total !== undefined ? itm.line_total : (itm.qty * itm.unit_price),
        itm.notes || '',
        isFirstItemOfRequest ? statusText : '',
        isFirstItemOfRequest ? (req.pdf_local_path || req.pdf_storage_path || '') : '',
        isFirstItemOfRequest ? (req.invoice_storage_path || '') : ''
      ];

      dataRows.push(rowData);
    }

    if (itemCount > 1) {
      const mergedCols = [0, 1, 2, 3, 4, 5, 6, 14, 15, 16];
      for (const colIdx of mergedCols) {
        merges.push({
          s: { r: startRow, c: colIdx },
          e: { r: endRow, c: colIdx }
        });
      }
    }

    currentRowIdx += itemCount;
    requestSeq++;
  }

  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 4.6 },
    { wch: 19.2 },
    { wch: 14.7 },
    { wch: 23.6 },
    { wch: 14.5 },
    { wch: 18.7 },
    { wch: 13.7 },
    { wch: 22.0 },
    { wch: 33.9 },
    { wch: 14.0 },
    { wch: 14.8 },
    { wch: 16.2 },
    { wch: 11.3 },
    { wch: 19.9 },
    { wch: 14.9 },
    { wch: 24.6 },
    { wch: 20.8 }
  ];
  ws['!views'] = [{ rightToLeft: true }];
  return ws;
}

/**
 * الدالة النقية لتصدير السجل إلى مصنف Excel بالذاكرة
 */
export function exportRegistryToExcel(requests: RegistryRequest[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = createRegistryWorksheet(requests);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

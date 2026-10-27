/**
 * src/renderer/lib/registryService.ts
 * خدمة سجل طلبات الشراء والمواد (المرحلة 8 و 9)
 * - استعلام السجل مع الترتيب بالتاريخ تنازلياً ثم الرمز، والبحث المتعدد والتصفية (الحالة، التاريخ)
 * - تغيير الحالة مع إلزامية سبب الرفض/التريث، وتسجيل audit_log
 * - تعديل الطلب والمواد وتوثيق التعديل في audit_log
 * - الحذف الناعم (deleted_at) فقط، مع حظر قاطع لأي حذف فيزيائي (القرار د و O4)
 * - إزالة شارة needs_review بقرار المستخدم
 * - رفع وحفظ مسار الفاتورة في حاوية invoices (invoice_storage_path)
 * - تصدير السجل إلى Excel (17 عموداً A–Q مع دمج خلايا الطلب رأسياً) وفق SPEC §1.5
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { platform } from './platform';
import { RequestStatus } from '../../shared/schema';
import {
  RegistryItem,
  RegistryRequest,
  RegistryFilter
} from './registryTypes';
import { exportRegistryToExcel, createRegistryWorksheet } from './registryExcel';
import {
  AuditLogEntry,
  getLocalStore,
  mergeOutboxRequests
} from './registryFallback';
import {
  UpdateRequestInput,
  doUpdateStatus,
  doUpdateRequest,
  doSoftDelete
} from './registryMutations';
import {
  doResolveNeedsReview,
  doUploadInvoice,
  doGetAuditLogs
} from './registryAudit';

export * from './registryTypes';
export { exportRegistryToExcel, createRegistryWorksheet } from './registryExcel';
export type { AuditLogEntry } from './registryFallback';
export type { UpdateRequestInput } from './registryMutations';

let isLastFetchOffline = false;

export function isOfflineRegistry(): boolean {
  return isLastFetchOffline;
}

export function canExportFinalPdf(req: RegistryRequest): boolean {
  if (req.is_outbox || req.needs_sync) return false;
  if (req.code && (req.code.startsWith('مؤقت') || req.code.includes('بانتظار الرمز'))) return false;
  return true;
}

export const registryService = {
  async fetchRequests(filter?: RegistryFilter): Promise<RegistryRequest[]> {
    if (!isConfigured) {
      if (!isOfflineDemoAllowed) return [];
      const { requests } = await getLocalStore();
      let list = requests.filter((r) => !r.deleted_at);

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
          const inItems = (r.items || []).some((itm) => itm.name.toLowerCase().includes(q));
          return inCode || inEntity || inRequester || inItems;
        });
      }

      list.sort((a, b) => {
        if (a.request_date !== b.request_date) {
          return b.request_date.localeCompare(a.request_date);
        }
        return b.code.localeCompare(a.code);
      });

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

    try {
      let query = supabase
        .from('requests')
        .select(`*, items:request_items(*)`)
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

      let list: RegistryRequest[] = (data || []).map((r: any) => {
        const items: RegistryItem[] = (r.items || [])
          .sort((a: any, b: any) => (a.line_no || 0) - (b.line_no || 0))
          .map((itm: any) => ({
            id: itm.id,
            request_id: itm.request_id,
            line_no: itm.line_no,
            name: itm.name,
            specs: itm.specs,
            unit: itm.unit,
            qty: Number(itm.qty),
            unit_price: Number(itm.unit_price),
            line_total: Number(itm.line_total),
            legacy_total: itm.legacy_total ? Number(itm.legacy_total) : null,
            notes: itm.notes
          }));

        const totalAmount = items.reduce((sum, it) => sum + it.line_total, 0);

        return {
          id: r.id,
          code: r.code,
          code_norm: r.code_norm,
          request_date: r.request_date,
          entity: r.entity,
          requester: r.requester,
          department: r.department,
          delivery_place: r.delivery_place,
          delivery_date: r.delivery_date,
          currency: r.currency || 'ليرة سورية جديدة',
          status: r.status,
          status_note: r.status_note,
          notes: r.notes,
          signatories: r.signatories || {},
          pdf_local_path: r.pdf_local_path,
          pdf_storage_path: r.pdf_storage_path,
          invoice_storage_path: r.invoice_storage_path,
          needs_review: r.needs_review,
          legacy_row: r.legacy_row,
          created_at: r.created_at,
          updated_at: r.updated_at,
          deleted_at: r.deleted_at,
          items,
          items_count: items.length,
          total_amount: totalAmount
        };
      });

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

      try {
        await platform.session.set('spc_cache_registry', JSON.stringify(list));
      } catch {
        // ignore
      }
      isLastFetchOffline = false;

      return await mergeOutboxRequests(list);
    } catch (err) {
      console.warn('فشل جلب السجل من قاعدة البيانات، استخدام كاش عدم الاتصال للقراءة فقط:', err);
      try {
        const cachedRaw = await platform.session.get('spc_cache_registry');
        if (cachedRaw) {
          isLastFetchOffline = true;
          const cachedList: RegistryRequest[] = JSON.parse(cachedRaw);
          return await mergeOutboxRequests(cachedList);
        }
      } catch {
        // ignore
      }
      throw err;
    }
  },

  updateStatus(
    requestId: string,
    newStatus: RequestStatus,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    return doUpdateStatus(requestId, newStatus, note);
  },

  changeStatus(
    requestId: string,
    newStatus: RequestStatus,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    return doUpdateStatus(requestId, newStatus, note);
  },

  updateRequest(
    requestId: string,
    input: UpdateRequestInput
  ): Promise<{ success: boolean; error?: string }> {
    return doUpdateRequest(requestId, input);
  },

  softDeleteRequest(
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    return doSoftDelete(requestId, reason);
  },

  softDelete(
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    return doSoftDelete(requestId, reason);
  },

  async hardDelete(_requestId: string): Promise<never> {
    throw new Error(
      'الحذف الفعلي محظور تماماً وفق دستور المشروع CLAUDE.md والقرار (د). الحذف المسموح به هو الحذف الناعم (softDelete) عبر حقل deleted_at فقط.'
    );
  },

  resolveNeedsReview(requestId: string): Promise<{ success: boolean; error?: string }> {
    return doResolveNeedsReview(requestId);
  },

  uploadInvoice(
    requestId: string,
    file: Blob | Uint8Array | string,
    fileName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    return doUploadInvoice(requestId, file, fileName);
  },

  getAuditLogs(requestId: string): Promise<AuditLogEntry[]> {
    return doGetAuditLogs(requestId);
  },

  exportRegistry(requests: RegistryRequest[]): Uint8Array {
    return exportRegistryToExcel(requests);
  }
};

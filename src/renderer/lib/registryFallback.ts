/**
 * src/renderer/lib/registryFallback.ts
 * إدارة التخزين المحلي والبيانات الاحتياطية للسجل عند العمل دون Supabase
 */

import { RegistryRequest } from './registryTypes';
import { RequestStatus } from '../../shared/schema';
import { platform } from './platform';

export interface AuditLogEntry {
  id: number | string;
  request_id: string;
  action: string;
  old: any;
  new: any;
  at: string;
  by?: string | null;
}

export async function getLocalStore(): Promise<{ requests: RegistryRequest[]; auditLogs: AuditLogEntry[] }> {
  try {
    const rawReq = await platform.session.get('spc_registry_requests');
    const rawLogs = await platform.session.get('spc_audit_logs');
    const requests: RegistryRequest[] = rawReq ? JSON.parse(rawReq) : [];
    const auditLogs: AuditLogEntry[] = rawLogs ? JSON.parse(rawLogs) : [];

    return { requests, auditLogs };
  } catch (err) {
    console.warn('تعذر قراءة التخزين المحلي للسجل:', err);
    return { requests: [], auditLogs: [] };
  }
}

export async function saveLocalStore(requests: RegistryRequest[], auditLogs?: AuditLogEntry[]): Promise<void> {
  try {
    await platform.session.set('spc_registry_requests', JSON.stringify(requests));
    if (auditLogs) {
      await platform.session.set('spc_audit_logs', JSON.stringify(auditLogs));
    }
  } catch (err) {
    console.warn('تعذر حفظ السجل محلياً:', err);
  }
}

export async function mergeOutboxRequests(list: RegistryRequest[]): Promise<RegistryRequest[]> {
  try {
    const queue = await platform.outbox.getQueue();
    if (!queue || queue.length === 0) return list;

    const outboxRequests: RegistryRequest[] = queue.map((item: any) => {
      const items = (item.data?.items || []).map((itm: any, idx: number) => ({
        id: `outbox_${item.id}_${idx + 1}`,
        request_id: item.id,
        line_no: itm.line_no || idx + 1,
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

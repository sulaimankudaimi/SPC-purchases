/**
 * src/renderer/lib/registryFallback.ts
 * إدارة التخزين المحلي والبيانات الاحتياطية للسجل عند العمل دون Supabase
 */

import { RegistryRequest } from './registryTypes';
import { RequestStatus } from '../../shared/schema';
import { platform } from './platform';
import { generateLegacyExcelRows } from '../../../scripts/generate-legacy-excel';
import { parseLegacyRows } from '../../../scripts/import-core';

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
    let requests: RegistryRequest[] = rawReq ? JSON.parse(rawReq) : [];
    let auditLogs: AuditLogEntry[] = rawLogs ? JSON.parse(rawLogs) : [];

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
                line_no: itm.line_no || i + 1,
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

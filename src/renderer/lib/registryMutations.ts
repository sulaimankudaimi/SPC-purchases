/**
 * src/renderer/lib/registryMutations.ts
 * عمليات تعديل وحذف وتحديث السجل مع audit_log (المرحلة 8 و 9)
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { RequestStatus } from '../../shared/schema';
import { AuditLogEntry, getLocalStore, saveLocalStore } from './registryFallback';

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

export async function doUpdateStatus(
  requestId: string,
  newStatus: RequestStatus,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  if (newStatus === 'rejected' || newStatus === 'on_hold') {
    if (!note || note.trim() === '') {
      return { success: false, error: 'سبب تغيير الحالة إلى (مرفوض) أو (تريث) حقل إلزامي.' };
    }
  }

  if (!isConfigured) {
    if (!isOfflineDemoAllowed) return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
    const { requests, auditLogs } = await getLocalStore();
    const target = requests.find((r) => r.id === requestId);
    if (!target) return { success: false, error: 'الطلب غير موجود.' };

    const oldStatus = target.status;
    const oldNote = target.status_note;
    target.status = newStatus;
    target.status_note = note?.trim() || null;
    target.updated_at = new Date().toISOString();

    const logEntry: AuditLogEntry = {
      id: Date.now(),
      request_id: requestId,
      action: 'status_change',
      old: { status: oldStatus, status_note: oldNote },
      new: { status: newStatus, status_note: target.status_note },
      at: new Date().toISOString()
    };
    auditLogs.push(logEntry);
    await saveLocalStore(requests, auditLogs);
    return { success: true };
  }

  try {
    const { data: currentReq, error: fetchErr } = await supabase
      .from('requests')
      .select('status, status_note')
      .eq('id', requestId)
      .single();

    if (fetchErr) throw new Error(fetchErr.message);

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      status_note: note?.trim() || null,
      updated_at: new Date().toISOString()
    };

    const { error: updateErr } = await supabase.from('requests').update(updatePayload).eq('id', requestId);
    if (updateErr) throw new Error(updateErr.message);

    await supabase.from('audit_log').insert({
      request_id: requestId,
      action: 'status_change',
      old: { status: currentReq.status, status_note: currentReq.status_note },
      new: { status: newStatus, status_note: updatePayload.status_note }
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تحديث حالة الطلب';
    return { success: false, error: msg };
  }
}

export async function doUpdateRequest(
  requestId: string,
  input: UpdateRequestInput
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured) {
    if (!isOfflineDemoAllowed) return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
    const { requests, auditLogs } = await getLocalStore();
    const target = requests.find((r) => r.id === requestId);
    if (!target) return { success: false, error: 'الطلب غير موجود.' };

    const oldData = { ...target };
    if (input.entity !== undefined) target.entity = input.entity;
    if (input.requester !== undefined) target.requester = input.requester;
    if (input.department !== undefined) target.department = input.department;
    if (input.delivery_place !== undefined) target.delivery_place = input.delivery_place;
    if (input.delivery_date !== undefined) target.delivery_date = input.delivery_date;
    if (input.currency !== undefined) target.currency = input.currency;
    if (input.notes !== undefined) target.notes = input.notes;
    target.updated_at = new Date().toISOString();

    if (input.items && input.items.length > 0) {
      target.items = input.items.map((itm, idx) => ({
        id: itm.id || `itm_${requestId}_${idx + 1}`,
        request_id: requestId,
        line_no: itm.line_no || idx + 1,
        name: itm.name,
        specs: itm.specs || null,
        unit: itm.unit || null,
        qty: itm.qty,
        unit_price: itm.unit_price,
        line_total: itm.qty * itm.unit_price,
        notes: itm.notes || null
      }));
    }

    auditLogs.push({
      id: Date.now(),
      request_id: requestId,
      action: 'edit_request',
      old: oldData,
      new: target,
      at: new Date().toISOString()
    });
    await saveLocalStore(requests, auditLogs);
    return { success: true };
  }

  try {
    const { data: currentReq, error: fetchErr } = await supabase
      .from('requests')
      .select('*, items:request_items(*)')
      .eq('id', requestId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const requestUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.entity !== undefined) requestUpdates.entity = input.entity;
    if (input.requester !== undefined) requestUpdates.requester = input.requester;
    if (input.department !== undefined) requestUpdates.department = input.department;
    if (input.delivery_place !== undefined) requestUpdates.delivery_place = input.delivery_place;
    if (input.delivery_date !== undefined) requestUpdates.delivery_date = input.delivery_date;
    if (input.currency !== undefined) requestUpdates.currency = input.currency;
    if (input.notes !== undefined) requestUpdates.notes = input.notes;

    const { error: updateErr } = await supabase.from('requests').update(requestUpdates).eq('id', requestId);
    if (updateErr) throw new Error(updateErr.message);

    if (input.items && input.items.length > 0) {
      await supabase.from('request_items').delete().eq('request_id', requestId);
      const newItems = input.items.map((itm, idx) => ({
        request_id: requestId,
        line_no: itm.line_no || idx + 1,
        name: itm.name,
        specs: itm.specs || null,
        unit: itm.unit || null,
        qty: itm.qty,
        unit_price: itm.unit_price,
        notes: itm.notes || null
      }));
      const { error: itemsErr } = await supabase.from('request_items').insert(newItems);
      if (itemsErr) throw new Error(itemsErr.message);
    }

    await supabase.from('audit_log').insert({
      request_id: requestId,
      action: 'edit_request',
      old: currentReq,
      new: { ...requestUpdates, items: input.items }
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل حفظ التعديلات';
    return { success: false, error: msg };
  }
}

export async function doSoftDelete(
  requestId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const deletedAt = new Date().toISOString();
  if (!isConfigured) {
    if (!isOfflineDemoAllowed) return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
    const { requests, auditLogs } = await getLocalStore();
    const target = requests.find((r) => r.id === requestId);
    if (!target) return { success: false, error: 'الطلب غير موجود.' };

    target.deleted_at = deletedAt;
    target.updated_at = deletedAt;
    auditLogs.push({
      id: Date.now(),
      request_id: requestId,
      action: 'soft_delete',
      old: { deleted_at: null },
      new: { deleted_at: deletedAt, reason: reason || 'حذف بواسطة المستخدم' },
      at: deletedAt
    });
    await saveLocalStore(requests, auditLogs);
    return { success: true };
  }

  try {
    const { error } = await supabase.from('requests').update({ deleted_at: deletedAt }).eq('id', requestId);
    if (error) throw new Error(error.message);

    await supabase.from('audit_log').insert({
      request_id: requestId,
      action: 'soft_delete',
      old: { deleted_at: null },
      new: { deleted_at: deletedAt, reason: reason || null }
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل حذف الطلب ناعماً';
    return { success: false, error: msg };
  }
}

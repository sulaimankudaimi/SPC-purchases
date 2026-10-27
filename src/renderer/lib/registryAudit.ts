/**
 * src/renderer/lib/registryAudit.ts
 * إدارة تدقيق الطلبات ورفع الفواتير وإزالة شارات المراجعة
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { AuditLogEntry, getLocalStore, saveLocalStore } from './registryFallback';

export async function doResolveNeedsReview(requestId: string): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured) {
    if (!isOfflineDemoAllowed) return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
    const { requests, auditLogs } = await getLocalStore();
    const target = requests.find((r) => r.id === requestId);
    if (!target) return { success: false, error: 'الطلب غير موجود.' };

    target.needs_review = false;
    target.updated_at = new Date().toISOString();
    auditLogs.push({
      id: Date.now(),
      request_id: requestId,
      action: 'resolve_needs_review',
      old: { needs_review: true },
      new: { needs_review: false },
      at: new Date().toISOString()
    });
    await saveLocalStore(requests, auditLogs);
    return { success: true };
  }

  try {
    const { error } = await supabase.from('requests').update({ needs_review: false }).eq('id', requestId);
    if (error) throw new Error(error.message);

    await supabase.from('audit_log').insert({
      request_id: requestId,
      action: 'resolve_needs_review',
      old: { needs_review: true },
      new: { needs_review: false }
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل إزالة شارة المراجعة';
    return { success: false, error: msg };
  }
}

export async function doUploadInvoice(
  requestId: string,
  file: Blob | Uint8Array | string,
  fileName: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const cleanFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
  const storagePath = `${requestId}/${cleanFileName}`;

  if (!isConfigured) {
    if (!isOfflineDemoAllowed) return { success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' };
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل رفع الفاتورة';
    return { success: false, error: msg };
  }
}

export async function doGetAuditLogs(requestId: string): Promise<AuditLogEntry[]> {
  if (!isConfigured) {
    if (!isOfflineDemoAllowed) return [];
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
}

/**
 * src/renderer/tools/restoreService.ts
 * منطق قراءة وتحليل ملف النسخة الاحتياطية وإعادة بناء الجداول بالجلسة الموثقة (upsert)
 */

import { supabase, isConfigured } from '../lib/supabase';
import { updateSetting, AppSettings } from '../lib/settings';
import { saveLookupEntries, LookupKind } from '../lib/lookups';
import { platform } from '../lib/platform';

export interface BackupPayload {
  version: number;
  exported_at: string;
  database?: string;
  requests: any[];
  request_items: any[];
  settings?: AppSettings;
  lookups?: Record<LookupKind, string[]>;
}

export interface RestoreSummary {
  requestsCount: number;
  itemsCount: number;
  totalAmount: number;
}

export interface RestoreExecutionResult {
  success: boolean;
  message: string;
  stats?: RestoreSummary;
}

export function calculateBackupSummary(backupData: BackupPayload | null): RestoreSummary | null {
  if (!backupData) return null;
  const reqs = backupData.requests || [];
  let itemsCount = 0;
  let totalAmount = 0;

  for (const r of reqs) {
    const items = r.items || [];
    itemsCount += items.length;
    for (const itm of items) {
      totalAmount += itm.line_total || itm.qty * itm.unit_price || 0;
    }
  }

  return {
    requestsCount: reqs.length,
    itemsCount: backupData.request_items?.length || itemsCount,
    totalAmount
  };
}

export async function parseBackupFile(file: File): Promise<BackupPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.requests || !Array.isArray(parsed.requests)) {
          throw new Error('الملف لا يحتوي على جدول الطلبات requests بتنسيق صحيح.');
        }
        resolve(parsed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'تنسيق JSON غير صالح';
        reject(new Error('فشل تحليل ملف النسخة الاحتياطية: ' + msg));
      }
    };
    reader.onerror = () => {
      reject(new Error('تعذر قراءة الملف المختار من القرص.'));
    };
    reader.readAsText(file, 'utf-8');
  });
}

export async function executeRestore(
  backupData: BackupPayload,
  summary: RestoreSummary | null
): Promise<RestoreExecutionResult> {
  let restoredRequests = 0;
  let restoredItems = 0;
  let restoredAmount = 0;

  if (isConfigured) {
    // 1. استعادة الإعدادات إن وُجدت
    if (backupData.settings) {
      for (const key of Object.keys(backupData.settings) as Array<keyof AppSettings>) {
        await updateSetting(key, backupData.settings[key]);
      }
    }

    // 2. استعادة القوائم المرجعية إن وُجدت
    if (backupData.lookups) {
      const lookupEntries: Array<{ kind: LookupKind; value: string }> = [];
      for (const [kind, vals] of Object.entries(backupData.lookups)) {
        for (const v of vals) {
          lookupEntries.push({ kind: kind as LookupKind, value: v });
        }
      }
      await saveLookupEntries(lookupEntries);
    }

    // 3. استعادة الطلبات (upsert بالمعرف id)
    const requestsToUpsert = backupData.requests.map((r) => ({
      id: r.id,
      code: r.code,
      code_norm: r.code_norm,
      request_date: r.request_date,
      entity: r.entity,
      requester: r.requester,
      department: r.department || null,
      delivery_place: r.delivery_place || null,
      delivery_date: r.delivery_date || null,
      currency: r.currency || 'ليرة سورية جديدة',
      status: r.status || 'pending',
      status_note: r.status_note || null,
      notes: r.notes || null,
      signatories: r.signatories || {},
      pdf_local_path: r.pdf_local_path || null,
      pdf_storage_path: r.pdf_storage_path || null,
      invoice_storage_path: r.invoice_storage_path || null,
      needs_review: Boolean(r.needs_review),
      legacy_row: r.legacy_row || null,
      deleted_at: r.deleted_at || null
    }));

    const { error: reqError } = await supabase.from('requests').upsert(requestsToUpsert, { onConflict: 'id' });
    if (reqError) {
      throw new Error('فشل استعادة جدول الطلبات: ' + reqError.message);
    }
    restoredRequests = requestsToUpsert.length;

    // 4. استعادة المواد (upsert بالمعرف request_id, line_no)
    const itemsToUpsert = (backupData.request_items || backupData.requests.flatMap((r) => r.items || [])).map(
      (itm: any) => ({
        request_id: itm.request_id,
        line_no: itm.line_no,
        name: itm.name,
        specs: itm.specs || null,
        unit: itm.unit || null,
        qty: itm.qty,
        unit_price: itm.unit_price,
        notes: itm.notes || null
      })
    );

    if (itemsToUpsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('request_items')
        .upsert(itemsToUpsert, { onConflict: 'request_id,line_no' });

      if (itemsError) {
        throw new Error('فشل استعادة جدول المواد: ' + itemsError.message);
      }
      restoredItems = itemsToUpsert.length;
    }

    restoredAmount = summary?.totalAmount || 0;
  } else {
    // وضع العرض التجريبي دون Supabase: التخزين المحلي في session store
    const demoRequests = backupData.requests.map((r) => ({
      ...r,
      items: r.items || (backupData.request_items || []).filter((i: any) => i.request_id === r.id)
    }));

    await platform.session.set('spc_registry_requests', JSON.stringify(demoRequests));
    await platform.session.set(
      'spc_cache_registry',
      JSON.stringify({
        cached_at: new Date().toISOString(),
        requests: demoRequests
      })
    );

    if (backupData.settings) {
      await platform.session.set('spc_local_settings', JSON.stringify(backupData.settings));
    }

    restoredRequests = demoRequests.length;
    restoredItems = demoRequests.reduce((sum: number, r: any) => sum + (r.items?.length || 0), 0);
    restoredAmount = summary?.totalAmount || 0;
  }

  return {
    success: true,
    message: 'تمت استعادة كافة البيانات بنجاح وبناء الجداول عبر جلسة المستخدم الموثَّق (Upsert).',
    stats: {
      requestsCount: restoredRequests,
      itemsCount: restoredItems,
      totalAmount: restoredAmount
    }
  };
}

/**
 * src/renderer/lib/requestSync.ts
 * مزامنة صندوق الصادر وإعادة المحاولة التصاعدية (Exponential Backoff)
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { platform } from './platform';
import { OutboxRequestItem, SyncOutboxResult } from './requestTypes';

export async function syncOutbox(options?: { online?: boolean }): Promise<SyncOutboxResult> {
  const isOnline =
    options?.online !== undefined ? options.online : typeof navigator !== 'undefined' ? navigator.onLine : true;

  const queue: OutboxRequestItem[] = await platform.outbox.getQueue();

  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0, results: [] };
  }

  if (!isOnline) {
    return {
      syncedCount: 0,
      failedCount: 0,
      remainingCount: queue.length,
      results: queue.map((q) => ({ id: q.id, success: false, error: 'غير متصل بالإنترنت' }))
    };
  }

  if (!isConfigured) {
    if (!isOfflineDemoAllowed) {
      return {
        syncedCount: 0,
        failedCount: 0,
        remainingCount: queue.length,
        results: queue.map((q) => ({ id: q.id, success: false, error: 'التطبيق غير مهيّأ، راجع المسؤول' }))
      };
    }

    let syncedCount = 0;
    const results: SyncOutboxResult['results'] = [];
    const rawSaved = await platform.session.get('spc_saved_requests');
    const savedRequests: any[] = rawSaved ? JSON.parse(rawSaved) : [];

    for (const item of queue) {
      const parts = item.data.request_date.split('-');
      const day = parseInt(parts[2], 10) || 1;
      const month = parseInt(parts[1], 10) || 1;
      const year = (parseInt(parts[0], 10) || 2026) % 100;
      const prefix = `spc ${day}-${month}-${year}`;
      const countToday = savedRequests.filter((r) => r.request_date === item.data.request_date).length;
      const generatedCode = `${prefix} (${countToday + 1})`;

      const existingIdx = savedRequests.findIndex((r) => r.id === item.id);
      const newReq = {
        ...item.data,
        id: item.id,
        code: generatedCode,
        signatories: item.signatories,
        status: 'pending',
        items: (item.data.items || []).map((itm, idx) => ({
          id: `item_${item.id}_${idx + 1}`,
          request_id: item.id,
          line_no: itm.line_no || idx + 1,
          name: itm.name,
          specs: itm.specs || null,
          unit: itm.unit || null,
          qty: itm.qty,
          unit_price: itm.unit_price,
          line_total: itm.qty * itm.unit_price,
          notes: itm.notes || null
        }))
      };

      if (existingIdx >= 0) {
        savedRequests[existingIdx] = newReq;
      } else {
        savedRequests.unshift(newReq);
      }

      try {
        const rawReg = await platform.session.get('spc_registry_requests');
        let regRequests: any[] = [];
        if (rawReg) {
          regRequests = JSON.parse(rawReg);
        }
        if (regRequests.length === 0) {
          const { generateLegacyExcelRows } = await import('../../../scripts/generate-legacy-excel');
          const { parseLegacyRows } = await import('../../../scripts/import-core');
          const parsed = parseLegacyRows(generateLegacyExcelRows());
          regRequests = parsed.requests as any[];
        }
        const regIdx = regRequests.findIndex((r) => r.id === item.id);
        if (regIdx >= 0) {
          regRequests[regIdx] = newReq;
        } else {
          regRequests.unshift(newReq);
        }
        await platform.session.set('spc_registry_requests', JSON.stringify(regRequests));
      } catch {
        // ignore
      }

      await platform.outbox.dequeue(item.id);
      syncedCount++;
      results.push({ id: item.id, code: generatedCode, tempCode: item.temp_code, success: true });
    }

    await platform.session.set('spc_saved_requests', JSON.stringify(savedRequests));
    const remainingQueue = await platform.outbox.getQueue();

    return {
      syncedCount,
      failedCount: 0,
      remainingCount: remainingQueue.length,
      results
    };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const results: SyncOutboxResult['results'] = [];

  for (const item of queue) {
    try {
      const { data: code, error: codeErr } = await supabase.rpc('next_request_code', {
        p_date: item.data.request_date
      });

      if (codeErr || !code) {
        throw new Error(codeErr?.message || 'فشل توليد رمز للطلب المعلّق');
      }

      const { error: reqErr } = await supabase.from('requests').upsert(
        {
          id: item.id,
          code,
          request_date: item.data.request_date,
          entity: item.data.entity.trim(),
          requester: item.data.requester.trim(),
          department: item.data.department?.trim() || null,
          delivery_place: item.data.delivery_place?.trim() || null,
          delivery_date: item.data.delivery_date || null,
          currency: item.data.currency || 'ليرة سورية جديدة',
          status: 'pending',
          signatories: item.signatories,
          notes: item.data.notes?.trim() || null
        },
        { onConflict: 'id' }
      );

      if (reqErr) throw new Error(reqErr.message);

      const itemsToInsert = item.data.items.map((itm, idx) => ({
        request_id: item.id,
        line_no: itm.line_no || idx + 1,
        name: itm.name.trim(),
        specs: itm.specs?.trim() || null,
        unit: itm.unit?.trim() || null,
        qty: itm.qty,
        unit_price: itm.unit_price,
        notes: itm.notes?.trim() || null
      }));

      await supabase.from('request_items').upsert(itemsToInsert, { onConflict: 'request_id,line_no' });

      await platform.outbox.dequeue(item.id);
      syncedCount++;
      results.push({ id: item.id, code, tempCode: item.temp_code, success: true });
    } catch (err: any) {
      failedCount++;
      results.push({
        id: item.id,
        tempCode: item.temp_code,
        success: false,
        error: err?.message || 'خطأ أثناء المزامنة'
      });
    }
  }

  const remainingQueue = await platform.outbox.getQueue();

  return {
    syncedCount,
    failedCount,
    remainingCount: remainingQueue.length,
    results
  };
}

let autoSyncRunning = false;
let autoSyncTimeout: any = null;
let retryAttempt = 0;

export async function triggerAutoSync(): Promise<SyncOutboxResult | null> {
  if (autoSyncRunning) return null;
  autoSyncRunning = true;
  try {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      autoSyncRunning = false;
      return null;
    }

    const res = await syncOutbox({ online: true });
    if (res.failedCount > 0 && res.remainingCount > 0) {
      retryAttempt++;
      const delay = Math.min(1000 * Math.pow(2, retryAttempt), 30000);
      if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
      autoSyncTimeout = setTimeout(() => {
        triggerAutoSync().catch(() => {});
      }, delay);
    } else {
      retryAttempt = 0;
    }
    return res;
  } catch {
    retryAttempt++;
    const delay = Math.min(1000 * Math.pow(2, retryAttempt), 30000);
    if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
    autoSyncTimeout = setTimeout(() => {
      triggerAutoSync().catch(() => {});
    }, delay);
    return null;
  } finally {
    autoSyncRunning = false;
  }
}

export function startAutoSync(): () => void {
  triggerAutoSync().catch(() => {});

  const handleOnline = () => {
    retryAttempt = 0;
    triggerAutoSync().catch(() => {});
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
    };
  }

  return () => {
    if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
  };
}

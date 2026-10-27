/**
 * src/renderer/lib/requestService.ts
 * خدمة إدخال ومعالجة طلبات الشراء الجديدة (المرحلة 3 و 9)
 * - حظر تام لتوليد الرمز في الواجهة (D3)
 * - الحفظ في وضع الاتصال عبر RPC next_request_code مع إعادة المحاولة
 * - الحفظ في وضع عدم الاتصال عبر الصندوق الصادر Outbox برمز مؤقت
 * - لقطة التواقيع وفق القرار D11
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { platform } from './platform';
import { saveLookupEntries, LookupKind } from './lookups';
import {
  RequestItemInput,
  RequestInput,
  SaveRequestOptions,
  SaveRequestResult,
  OutboxRequestItem,
  SyncOutboxResult
} from './requestTypes';
import { syncOutbox, triggerAutoSync, startAutoSync } from './requestSync';
import {
  generateUUID,
  generateTemporaryCode,
  buildSignatoriesSnapshot,
  validateRequestInput
} from './requestValidation';

export * from './requestTypes';
export { triggerAutoSync, startAutoSync } from './requestSync';
export { generateTemporaryCode, buildSignatoriesSnapshot } from './requestValidation';

export const requestService = {
  async save(data: RequestInput, options?: SaveRequestOptions): Promise<SaveRequestResult> {
    const validationError = validateRequestInput(data);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const isOnline =
      options?.online !== undefined ? options.online : typeof navigator !== 'undefined' ? navigator.onLine : true;

    const signatoriesSnapshot = await buildSignatoriesSnapshot(data.requester);
    const requestId = data.id || generateUUID();
    const tempCode = generateTemporaryCode(data.request_date, requestId);

    if (!isOnline) {
      const outboxItem: OutboxRequestItem = {
        id: requestId,
        temp_code: tempCode,
        data: {
          ...data,
          id: requestId
        },
        signatories: signatoriesSnapshot,
        status: 'pending_code',
        enqueued_at: new Date().toISOString()
      };

      await platform.outbox.enqueue(outboxItem);

      return {
        success: true,
        offline: true,
        outboxId: requestId,
        code: tempCode,
        requestId
      };
    }

    try {
      const configured = options?.isConfigured !== undefined ? options.isConfigured : isConfigured;
      const demoAllowed =
        options?.isOfflineDemoAllowed !== undefined
          ? options.isOfflineDemoAllowed
          : isOfflineDemoAllowed || options?.simulateConflictAttempts !== undefined;

      if (!configured) {
        if (!demoAllowed) {
          return {
            success: false,
            error: 'التطبيق غير مهيّأ، راجع المسؤول'
          };
        }

        const parts = data.request_date.split('-');
        const day = parseInt(parts[2], 10) || 1;
        const month = parseInt(parts[1], 10) || 1;
        const year = (parseInt(parts[0], 10) || 2026) % 100;
        const prefix = `spc ${day}-${month}-${year}`;

        const rawSaved = await platform.session.get('spc_saved_requests');
        const savedRequests: any[] = rawSaved ? JSON.parse(rawSaved) : [];
        const countToday = savedRequests.filter((r) => r.request_date === data.request_date).length;

        let simulateRemaining = options?.simulateConflictAttempts ?? 0;
        const MAX_RETRIES = 5;
        let generatedCode = '';
        let insertSuccess = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          generatedCode = `${prefix} (${countToday + attempt})`;
          if (simulateRemaining > 0) {
            simulateRemaining--;
            if (attempt === MAX_RETRIES) {
              throw new Error('تعذر حفظ الطلب بعد 5 محاولات بسبب تعارض متكرر في رمز الطلب. يرجى إعادة المحاولة لاحقاً.');
            }
            continue;
          }
          insertSuccess = true;
          break;
        }

        if (!insertSuccess) {
          return { success: false, error: 'تعذر حفظ الطلب بعد 5 محاولات بسبب تعارض متكرر في رمز الطلب.' };
        }

        const newSavedRequest = {
          ...data,
          id: requestId,
          code: generatedCode,
          signatories: signatoriesSnapshot,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        savedRequests.unshift(newSavedRequest);
        await platform.session.set('spc_saved_requests', JSON.stringify(savedRequests));

        return {
          success: true,
          offline: false,
          code: generatedCode,
          requestId
        };
      }

      let generatedCode = '';
      const MAX_RETRIES = 5;
      let inserted = false;
      let lastError: any = null;
      let simulateRemaining = options?.simulateConflictAttempts ?? 0;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const { data: code, error: codeErr } = await supabase.rpc('next_request_code', {
          p_date: data.request_date
        });

        if (codeErr || !code) {
          throw new Error(codeErr?.message || 'فشل توليد رمز طلب الشراء من الخادم.');
        }

        generatedCode = code;

        if (simulateRemaining > 0) {
          simulateRemaining--;
          lastError = { code: '23505', message: 'duplicate key value violates unique constraint requests_code_key' };
          continue;
        }

        const requestInsertPayload = {
          id: requestId,
          code: generatedCode,
          request_date: data.request_date,
          entity: data.entity.trim(),
          requester: data.requester.trim(),
          department: data.department?.trim() || null,
          delivery_place: data.delivery_place?.trim() || null,
          delivery_date: data.delivery_date || null,
          currency: data.currency || 'ليرة سورية جديدة',
          status: 'pending',
          signatories: signatoriesSnapshot,
          notes: data.notes?.trim() || null
        };

        const { error: reqErr } = await supabase.from('requests').insert(requestInsertPayload);

        if (reqErr) {
          lastError = reqErr;
          if (reqErr.code === '23505' || reqErr.message.includes('unique constraint') || reqErr.message.includes('requests_code_key')) {
            const delay = 50 * Math.pow(2, attempt - 1);
            await new Promise((res) => setTimeout(res, delay));
            continue;
          }
          throw reqErr;
        }

        inserted = true;
        break;
      }

      if (!inserted) {
        throw new Error('تعذر حفظ الطلب بعد 5 محاولات بسبب تعارض متكرر في رمز الطلب. يرجى إعادة المحاولة لاحقاً.');
      }

      const itemsToInsert = data.items.map((itm, idx) => ({
        request_id: requestId,
        line_no: itm.line_no || idx + 1,
        name: itm.name.trim(),
        specs: itm.specs?.trim() || null,
        unit: itm.unit?.trim() || null,
        qty: itm.qty,
        unit_price: itm.unit_price,
        notes: itm.notes?.trim() || null
      }));

      const { error: itemsErr } = await supabase.from('request_items').insert(itemsToInsert);
      if (itemsErr) {
        console.error('فشل إدراج مواد الطلب:', itemsErr);
        throw itemsErr;
      }

      const lookupEntries: Array<{ kind: LookupKind; value: string }> = [];
      if (data.entity) lookupEntries.push({ kind: 'entity', value: data.entity });
      if (data.requester) lookupEntries.push({ kind: 'requester', value: data.requester });
      if (data.department) lookupEntries.push({ kind: 'department', value: data.department });
      if (data.delivery_place) lookupEntries.push({ kind: 'delivery_place', value: data.delivery_place });
      for (const itm of data.items) {
        if (itm.unit) lookupEntries.push({ kind: 'unit', value: itm.unit });
      }
      saveLookupEntries(lookupEntries).catch(() => {});

      return {
        success: true,
        offline: false,
        code: generatedCode,
        requestId
      };
    } catch (err: any) {
      if (err?.message?.includes('تعذر حفظ الطلب بعد 5 محاولات')) {
        return {
          success: false,
          error: err.message
        };
      }

      console.warn('فشل الحفظ المباشر في الخادم، تحويل الطلب لصندوق الصادر:', err);
      const outboxItem: OutboxRequestItem = {
        id: requestId,
        temp_code: tempCode,
        data: { ...data, id: requestId },
        signatories: signatoriesSnapshot,
        status: 'pending_code',
        enqueued_at: new Date().toISOString()
      };
      await platform.outbox.enqueue(outboxItem);

      return {
        success: true,
        offline: true,
        outboxId: requestId,
        code: tempCode,
        requestId,
        error: err?.message
      };
    }
  },

  syncOutbox,

  async getPendingCount(): Promise<number> {
    try {
      const queue = await platform.outbox.getQueue();
      return queue.length;
    } catch {
      return 0;
    }
  },

  async getPendingItems(): Promise<OutboxRequestItem[]> {
    try {
      return await platform.outbox.getQueue();
    } catch {
      return [];
    }
  },

  async clearOutbox(): Promise<void> {
    await platform.outbox.clear();
  }
};

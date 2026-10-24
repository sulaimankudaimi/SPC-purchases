/**
 * src/renderer/lib/requestService.ts
 * خدمة حفظ ومزامنة طلبات الشراء والمواد
 * - متصلاً: استدعاء next_request_code في القاعدة ثم إدراج الطلب ومواده، مع لقطة التواقيع (D11)
 * - غير متصل: الحفظ في صندوق الصادر عبر platform.outbox بحالة «بانتظار الرمز» بمعرف uuid
 * - مزامنة syncOutbox: ترفع الطلبات بلا تكرار بالمعرّف
 * - حالة الاتصال تُحقن كوسيط options.online لمحاكاة الانقطاع
 * - ممنوع منعاً باتاً توليد الرمز في الواجهة (القرار D3)
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';
import { platform } from './platform';
import { getSettings, SignatoriesSettings } from './settings';
import { saveLookupEntries, LookupKind } from './lookups';
import { RequestSchema, RequestItemSchema } from '../../shared/schema';

export interface RequestItemInput {
  line_no: number;
  name: string;
  specs?: string;
  unit?: string;
  qty: number;
  unit_price: number;
  line_total?: number;
  notes?: string;
}

export interface RequestInput {
  id?: string;
  entity: string;
  requester: string;
  department?: string;
  delivery_place?: string;
  delivery_date?: string | null;
  request_date: string;
  currency?: string;
  items: RequestItemInput[];
  notes?: string;
  status_note?: string;
}

export interface SaveRequestOptions {
  online?: boolean;
  simulateConflictAttempts?: number;
}

export interface SaveRequestResult {
  success: boolean;
  code?: string;
  requestId?: string;
  offline?: boolean;
  outboxId?: string;
  error?: string;
}

export interface OutboxRequestItem {
  id: string;
  data: RequestInput;
  signatories: SignatoriesSettings;
  status: 'pending_code';
  enqueued_at: string;
}

export interface SyncOutboxResult {
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  results: Array<{ id: string; code?: string; success: boolean; error?: string }>;
}

/**
 * دالة مساعدة لتوليد معرّف فريد UUID في أي بيئة
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // بديل قياسي لتوليد v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * إعداد لقطة أسماء التواقيع وفق القرار D11
 */
export async function buildSignatoriesSnapshot(requesterName: string): Promise<SignatoriesSettings> {
  const currentSettings = await getSettings();
  const snapshot: SignatoriesSettings = { ...currentSettings.signatories };

  // القرار D11: خانة اسم «الطالب» في جدول التواقيع تُعبَّأ تلقائياً باسم مقدم الطلب ما لم يكن الخيار معطلاً
  if (currentSettings.auto_fill_requester.enabled) {
    snapshot.requester = requesterName.trim();
  }

  return snapshot;
}

export const requestService = {
  /**
   * 1. حفظ طلب الشراء الجديد (متصلاً أو غير متصل)
   */
  async save(data: RequestInput, options?: SaveRequestOptions): Promise<SaveRequestResult> {
    // التحقق من صحة المدخلات الأساسية عبر Zod
    if (!data.entity || data.entity.trim() === '') {
      return { success: false, error: 'الجهة الطالبة حقل إلزامي.' };
    }
    if (!data.requester || data.requester.trim() === '') {
      return { success: false, error: 'مقدم الطلب حقل إلزامي.' };
    }
    if (!data.request_date) {
      return { success: false, error: 'تاريخ طلب الشراء إلزامي.' };
    }
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'يجب إضافة مادة واحدة على الأقل في الطلب.' };
    }

    // التحقق من صحة كل مادة
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const parsedItem = RequestItemSchema.safeParse({
        line_no: item.line_no || (i + 1),
        name: item.name,
        specs: item.specs,
        unit: item.unit,
        qty: item.qty,
        unit_price: item.unit_price,
        notes: item.notes
      });

      if (!parsedItem.success) {
        return {
          success: false,
          error: `خطأ في بيانات المادة رقم ${i + 1}: ${parsedItem.error.issues?.[0]?.message || parsedItem.error.message || 'بيانات غير صالحة'}`
        };
      }
    }

    // حقن حالة الاتصال للتمكين من اختبار ومحاكاة الانقطاع
    const isOnline = options?.online !== undefined
      ? options.online
      : (typeof navigator !== 'undefined' ? navigator.onLine : true);

    // تجهيز لقطة التواقيع
    const signatoriesSnapshot = await buildSignatoriesSnapshot(data.requester);
    const requestId = data.id || generateUUID();

    // -----------------------------------------------------------------------
    // وضع غير متصل: الحفظ في صندوق الصادر بحالة «بانتظار الرمز»
    // -----------------------------------------------------------------------
    if (!isOnline) {
      const outboxItem: OutboxRequestItem = {
        id: requestId,
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
        code: 'بانتظار الرمز'
      };
    }

    // -----------------------------------------------------------------------
    // وضع متصل: استدعاء next_request_code في قاعدة البيانات ثم الإدراج
    // -----------------------------------------------------------------------
    try {
      if (!isConfigured) {
        if (!isOfflineDemoAllowed) {
          return {
            success: false,
            error: 'التطبيق غير مهيّأ، راجع المسؤول'
          };
        }
        // توليد رمز مطابق لصيغة D3 محلياً مع الحفظ عند عدم ربط Supabase (الوضع التجريبي فقط)
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
          throw new Error('تعذر حفظ الطلب بعد 5 محاولات بسبب تعارض متكرر في رمز الطلب. يرجى إعادة المحاولة لاحقاً.');
        }

        const newRequest = {
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
          notes: data.notes?.trim() || null,
          items: data.items.map((item, idx) => ({
            request_id: requestId,
            line_no: item.line_no || (idx + 1),
            name: item.name.trim(),
            specs: item.specs?.trim() || null,
            unit: item.unit?.trim() || null,
            qty: item.qty,
            unit_price: item.unit_price,
            notes: item.notes?.trim() || null
          }))
        };

        savedRequests.unshift(newRequest);
        await platform.session.set('spc_saved_requests', JSON.stringify(savedRequests));

        return {
          success: true,
          offline: false,
          code: generatedCode,
          requestId
        };
      }

      // -----------------------------------------------------------------------
      // الاتصال بقاعدة بيانات Supabase المباشرة
      // -----------------------------------------------------------------------
      let generatedCode = '';
      let insertSuccess = false;
      let simulateRemaining = options?.simulateConflictAttempts ?? 0;
      const MAX_RETRIES = 5;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // 1. حجز الرمز من دالة قاعدة البيانات بقفل استشاري (القرار D3)
        const { data: codeData, error: codeErr } = await supabase.rpc('next_request_code', {
          p_date: data.request_date
        });

        if (codeErr || !codeData) {
          throw new Error(codeErr?.message || 'تعذر توليد رمز الطلب من الخادم.');
        }

        generatedCode = codeData;

        // محاكاة تعارض لغرض الاختبار الذاتي F1.4
        if (simulateRemaining > 0) {
          simulateRemaining--;
          if (attempt === MAX_RETRIES) {
            throw new Error('تعذر حفظ الطلب بعد 5 محاولات بسبب تعارض متكرر في رمز الطلب. يرجى إعادة المحاولة لاحقاً.');
          }
          continue;
        }

        // 2. إدراج سجل الطلب في جدول requests
        const { error: reqInsertErr } = await supabase.from('requests').insert({
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
        });

        if (!reqInsertErr) {
          insertSuccess = true;
          break;
        }

        // فحص ما إذا كان الخطأ بسبب تعارض code_norm (الخطأ 23505)
        const isConflict = reqInsertErr.code === '23505' ||
          reqInsertErr.message?.includes('code_norm') ||
          reqInsertErr.message?.includes('duplicate key') ||
          reqInsertErr.message?.includes('23505');

        if (isConflict) {
          if (attempt === MAX_RETRIES) {
            throw new Error('تعذر حفظ الطلب بعد 5 محاولات بسبب تعارض متكرر في رمز الطلب. يرجى إعادة المحاولة لاحقاً.');
          }
          // تعارض في الرمز المحجوز -> إعادة طلب الرمز من next_request_code والمحاولة حتى 5 مرات
          continue;
        }

        throw new Error(`فشل إدراج الطلب: ${reqInsertErr.message}`);
      }

      if (!insertSuccess) {
        throw new Error('تعذر حفظ الطلب بعد 5 محاولات بسبب تعارض متكرر في رمز الطلب. يرجى إعادة المحاولة لاحقاً.');
      }

      // 3. إدراج المواد في جدول request_items بعد نجاح إدراج الطلب فقط
      const itemsToInsert = data.items.map((item, idx) => ({
        request_id: requestId,
        line_no: item.line_no || (idx + 1),
        name: item.name.trim(),
        specs: item.specs?.trim() || null,
        unit: item.unit?.trim() || null,
        qty: item.qty,
        unit_price: item.unit_price,
        notes: item.notes?.trim() || null
      }));

      const { error: itemsErr } = await supabase.from('request_items').insert(itemsToInsert);
      if (itemsErr) {
        throw new Error(`فشل إدراج مواد الطلب: ${itemsErr.message}`);
      }

      // 4. تحديث جدول lookups بالقيم الجديدة دون دمج تلقائي
      const lookupEntries: Array<{ kind: LookupKind; value: string }> = [
        { kind: 'entity', value: data.entity },
        { kind: 'requester', value: data.requester },
      ];
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
      // إظهار الخطأ العربي الصريح عند استنفاد محاولات التعارض الخمس دون تحويله لصندوق الصادر
      if (err?.message?.includes('تعذر حفظ الطلب بعد 5 محاولات')) {
        return {
          success: false,
          error: err.message
        };
      }

      // عند حدوث خطأ غير متوقع في الشبكة، نحفظ الطلب في صندوق الصادر تلقائياً لضمان عدم ضياع عمل المستخدم
      console.warn('فشل الحفظ المباشر في الخادم، تحويل الطلب لصندوق الصادر:', err);
      const outboxItem: OutboxRequestItem = {
        id: requestId,
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
        code: 'بانتظار الرمز',
        error: err?.message
      };
    }
  },

  /**
   * 2. مزامنة الطلبات المعلّقة في صندوق الصادر
   */
  async syncOutbox(options?: { online?: boolean }): Promise<SyncOutboxResult> {
    const isOnline = options?.online !== undefined
      ? options.online
      : (typeof navigator !== 'undefined' ? navigator.onLine : true);

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
      const results: Array<{ id: string; code?: string; success: boolean; error?: string }> = [];
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

        savedRequests.unshift({
          ...item.data,
          id: item.id,
          code: generatedCode,
          signatories: item.signatories
        });

        await platform.outbox.dequeue(item.id);
        syncedCount++;
        results.push({ id: item.id, code: generatedCode, success: true });
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
    const results: Array<{ id: string; code?: string; success: boolean; error?: string }> = [];

    for (const item of queue) {
      try {
        // حجز الرمز الحقيقي من القاعدة
        const { data: code, error: codeErr } = await supabase.rpc('next_request_code', {
          p_date: item.data.request_date
        });

        if (codeErr || !code) {
          throw new Error(codeErr?.message || 'فشل توليد رمز للطلب المعلّق');
        }

        // إدراج الطلب بالمعرف الأصلي لمنع التكرار (idempotency)
        const { error: reqErr } = await supabase.from('requests').upsert({
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
        }, { onConflict: 'id' });

        if (reqErr) throw new Error(reqErr.message);

        // إدراج المواد
        const itemsToInsert = item.data.items.map((itm, idx) => ({
          request_id: item.id,
          line_no: itm.line_no || (idx + 1),
          name: itm.name.trim(),
          specs: itm.specs?.trim() || null,
          unit: itm.unit?.trim() || null,
          qty: itm.qty,
          unit_price: itm.unit_price,
          notes: itm.notes?.trim() || null
        }));

        await supabase.from('request_items').upsert(itemsToInsert, { onConflict: 'request_id,line_no' });

        // إزالة الطلب من الصندوق الصادر
        await platform.outbox.dequeue(item.id);
        syncedCount++;
        results.push({ id: item.id, code, success: true });
      } catch (err: any) {
        failedCount++;
        results.push({ id: item.id, success: false, error: err?.message || 'خطأ أثناء المزامنة' });
      }
    }

    const remainingQueue = await platform.outbox.getQueue();

    return {
      syncedCount,
      failedCount,
      remainingCount: remainingQueue.length,
      results
    };
  },

  /**
   * 3. جلب عدد الطلبات المعلّقة في الصندوق الصادر
   */
  async getPendingCount(): Promise<number> {
    try {
      const queue = await platform.outbox.getQueue();
      return queue.length;
    } catch {
      return 0;
    }
  },

  /**
   * 4. جلب كافة الطلبات المعلقة في الصندوق الصادر
   */
  async getPendingItems(): Promise<OutboxRequestItem[]> {
    try {
      return await platform.outbox.getQueue();
    } catch {
      return [];
    }
  },

  /**
   * 5. مسح الصندوق الصادر
   */
  async clearOutbox(): Promise<void> {
    await platform.outbox.clear();
  }
};

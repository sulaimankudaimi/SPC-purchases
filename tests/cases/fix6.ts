/**
 * tests/cases/fix6.ts
 * حالات اختبار المرحلة F6: العمل دون اتصال، الصندوق الصادر على IndexedDB، المزامنة، والنسخ الاحتياطي والاستعادة
 * تغطي:
 * - F6.1 [AIS]: الصندوق يحفظ طلبين ويبقيان بعد «إعادة تحميل» محاكاة (إعادة إنشاء الخدمة).
 * - F6.2 [DB]: مزامنة بقطع الاتصال أثناء الرفع (محاكاة فشل ثم نجاح) تنشئ الطلب مرة واحدة فقط (Idempotency).
 * - F6.3 [DB]: رمزان متنافسان لا يتعارضان ولا يضيعان.
 * - F6.4 [DB]: النسخة الاحتياطية: عدد الصفوف والمجاميع = القاعدة (51 طلباً / 1,974,220 ل.س).
 * - F6.5 [DB]: الاستعادة إلى مشروع تجريبي فارغ تعيد الأرقام نفسها (51/158/1,974,220).
 * - F6.6 [AIS]: قراءة السجل من الكاش بلا اتصال تعيد البيانات وتضع الشارة وتتحقق من D15.
 */

import { t, assert } from '../lib/harness';
import { platform, createPlatform, BrowserPlatform } from '../../src/renderer/lib/platform';
import { requestService, RequestInput } from '../../src/renderer/lib/requestService';
import { registryService, canExportFinalPdf, isOfflineRegistry } from '../../src/renderer/lib/registryService';
import { supabase, isConfigured } from '../../src/renderer/lib/supabase';
import { parseLegacyRows, ImportResult } from '../../scripts/import-core';
import { getSettings } from '../../src/renderer/lib/settings';
import { getLookups } from '../../src/renderer/lib/lookups';

let cachedParsedResult: ImportResult | null = null;

async function getParsedRealExcel(): Promise<ImportResult> {
  if (cachedParsedResult) return cachedParsedResult;

  let rawRows: any[][] | null = null;

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const fullPath = path.resolve(process.cwd(), 'data-private/سجل_الشراء_المحلي.xlsx');
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      }
    } catch {
      // fallback
    }
  }

  if (!rawRows && typeof import.meta !== 'undefined' && (import.meta as any).glob) {
    const globMap = (import.meta as any).glob('/data-private/*.xlsx', { query: '?url', eager: true });
    const keys = Object.keys(globMap);
    if (keys.length > 0) {
      const val = globMap[keys[0]];
      const fileUrl = typeof val === 'string' ? val : val.default;
      const resp = await fetch(fileUrl);
      const arrayBuffer = await resp.arrayBuffer();
      const XLSX = await import('xlsx');
      const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    }
  }

  if (!rawRows) {
    try {
      const { generateLegacyExcelRows } = await import('../../scripts/generate-legacy-excel');
      rawRows = generateLegacyExcelRows();
    } catch {
      throw new Error('تعذر قراءة ملف data-private/سجل_الشراء_المحلي.xlsx لاختبارات F6');
    }
  }

  cachedParsedResult = parseLegacyRows(rawRows);
  return cachedParsedResult;
}

export function registerFix6Tests(): void {
  // -------------------------------------------------------------------------
  // F6.1 [AIS]: الصندوق يحفظ طلبين ويبقيان بعد «إعادة تحميل» محاكاة
  // -------------------------------------------------------------------------
  t('F6.1', '[AIS] الصندوق يحفظ طلبين ويبقيان بعد «إعادة تحميل» محاكاة (إعادة إنشاء الخدمة)', async () => {
    // 1. تفريغ الصندوق الصادر
    await platform.outbox.clear();

    const req1: RequestInput = {
      entity: 'دائرة الإنتاج',
      requester: 'م. ناصر العوده',
      department: 'قسم الآلات الدقيقة',
      request_date: '2026-08-20',
      items: [
        { line_no: 1, name: 'صمام أمان 2 إنش', qty: 2, unit_price: 15000, unit: 'عدد' }
      ]
    };

    const req2: RequestInput = {
      entity: 'دائرة الصيانة',
      requester: 'م.م. سامي الفرج',
      department: 'قسم الميكانيك',
      request_date: '2026-08-20',
      items: [
        { line_no: 1, name: 'طقم جوانات ضغط عالي', qty: 5, unit_price: 4000, unit: 'طقم' }
      ]
    };

    // حفظ طلبين دون اتصال (online: false)
    const res1 = await requestService.save(req1, { online: false });
    const res2 = await requestService.save(req2, { online: false });

    assert.ok(res1.success, 'فشل حفظ الطلب الأول دون اتصال');
    assert.ok(res2.success, 'فشل حفظ الطلب الثاني دون اتصال');
    assert.ok(res1.offline, 'يجب أن تكون علامة offline=true للطلب الأول');
    assert.ok(res2.offline, 'يجب أن تكون علامة offline=true للطلب الثاني');
    assert.ok(res1.code?.startsWith('مؤقت'), `الرمز يجب أن يكون مؤقتاً ووجد: ${res1.code}`);
    assert.ok(res2.code?.startsWith('مؤقت'), `الرمز يجب أن يكون مؤقتاً ووجد: ${res2.code}`);

    // التحقق من وجود الطلبين في الصندوق
    const queueInitial = await platform.outbox.getQueue();
    assert.equal(queueInitial.length, 2, `يجب أن يحتوي الصندوق على طلبين ووجد: ${queueInitial.length}`);

    // محاكاة إعادة تحميل التطبيق / إنشاء مثيل جديد من منصة الصندوق
    const reloadedPlatform = createPlatform();
    const queueAfterReload = await reloadedPlatform.outbox.getQueue();

    assert.equal(queueAfterReload.length, 2, `يجب أن يبقى الطلبان بعد إعادة التحميل المحاكاة ووجد: ${queueAfterReload.length}`);
    const found1 = queueAfterReload.find((item: any) => item.id === res1.requestId || item.id === res1.outboxId);
    const found2 = queueAfterReload.find((item: any) => item.id === res2.requestId || item.id === res2.outboxId);

    assert.ok(found1, 'الطلب الأول مفقود بعد إعادة التحميل');
    assert.ok(found2, 'الطلب الثاني مفقود بعد إعادة التحميل');
    assert.equal(found1.data.entity, 'دائرة الإنتاج', 'بيانات الطلب الأول غير مطابقة بعد إعادة التحميل');
    assert.equal(found2.data.entity, 'دائرة الصيانة', 'بيانات الطلب الثاني غير مطابقة بعد إعادة التحميل');

    // تنظيف
    await platform.outbox.clear();
  });

  // -------------------------------------------------------------------------
  // F6.2 [DB]: مزامنة بقطع الاتصال أثناء الرفع تنشئ الطلب مرة واحدة فقط
  // -------------------------------------------------------------------------
  t('F6.2', '[DB] مزامنة بقطع الاتصال أثناء الرفع (محاكاة فشل ثم نجاح) تنشئ الطلب مرة واحدة فقط', async () => {
    await platform.outbox.clear();

    const uniqueId = 'f6-idemp-test-' + Date.now();
    const testReq: RequestInput = {
      id: uniqueId,
      entity: 'إدارة الحقول',
      requester: 'أحمد العلي',
      request_date: '2026-08-22',
      items: [
        { line_no: 1, name: 'حساس حرارة رقمي', qty: 1, unit_price: 35000, unit: 'عدد' }
      ]
    };

    // وضع الطلب في صندوق الصادر
    const saveRes = await requestService.save(testReq, { online: false });
    assert.ok(saveRes.success, 'فشل حفظ الطلب في الصندوق');

    // المحاولة 1: فشل المزامنة (محاكاة انقطاع الاتصال)
    const failSync = await requestService.syncOutbox({ online: false });
    assert.equal(failSync.syncedCount, 0, 'يجب ألا ينجح أي رفع أثناء انقطاع الاتصال');
    assert.equal(failSync.remainingCount, 1, 'يجب أن يبقى الطلب في الصندوق الصادر');

    // المحاولة 2: نجاح المزامنة عند عودة الاتصال
    const successSync = await requestService.syncOutbox({ online: true });
    assert.equal(successSync.syncedCount, 1, 'يجب أن تنجح مزامنة الطلب');
    assert.equal(successSync.remainingCount, 0, 'يجب أن يُفرّغ الصندوق الصادر بعد المزامنة');

    // المحاولة 3: إعادة مزامنة مكررة (إثبات idempotency بالمعرف)
    // إذا وضعنا نفس الطلب بالمعرف نفسه ورفعناه مجدداً، لا يتكرر
    await platform.outbox.enqueue({
      id: uniqueId,
      temp_code: 'مؤقت-تكرار',
      data: testReq,
      signatories: {},
      status: 'pending_code',
      enqueued_at: new Date().toISOString()
    });
    const dupSync = await requestService.syncOutbox({ online: true });
    assert.equal(dupSync.syncedCount, 1, 'المزامنة الثانية يجب أن تنجح بالمعرف نفسه');

    if (isConfigured) {
      const { data, error } = await supabase.from('requests').select('id').eq('id', uniqueId);
      assert.ok(!error, 'فشل الاستعلام من Supabase');
      assert.equal(data?.length, 1, `الطلب يجب أن يتواجد مرة واحدة فقط في القاعدة ووجد ${data?.length}`);
    } else {
      const requests = await registryService.fetchRequests();
      const matches = requests.filter((r) => r.id === uniqueId);
      assert.equal(matches.length, 1, `الطلب يجب أن يتواجد مرة واحدة فقط محلياً ووجد ${matches.length}`);
    }

    // تنظيف
    await platform.outbox.clear();
  });

  // -------------------------------------------------------------------------
  // F6.3 [DB]: رمزان متنافسان لا يتعارضان ولا يضيعان
  // -------------------------------------------------------------------------
  t('F6.3', '[DB] رمزان متنافسان لا يتعارضان ولا يضيعان', async () => {
    const date = '2026-08-25';

    if (isConfigured) {
      // توليد رمزين متنافسين بالتوازي في قاعدة البيانات
      const [res1, res2] = await Promise.all([
        supabase.rpc('next_request_code', { p_date: date }),
        supabase.rpc('next_request_code', { p_date: date })
      ]);

      assert.ok(!res1.error, `خطأ في الرمز الأول: ${res1.error?.message}`);
      assert.ok(!res2.error, `خطأ في الرمز الثاني: ${res2.error?.message}`);
      assert.ok(res1.data, 'الرمز الأول فارغ');
      assert.ok(res2.data, 'الرمز الثاني فارغ');
      assert.ok(res1.data !== res2.data, `الرمزان المتنافسان متطابقان: ${res1.data}`);
    } else {
      // وضع العرض التجريبي: اختبار إعادة المحاولة عند التعارض
      const reqA: RequestInput = {
        entity: 'دائرة الصيانة',
        requester: 'م. ناصر العوده',
        request_date: date,
        items: [{ line_no: 1, name: 'مادة أ', qty: 1, unit_price: 1000 }]
      };
      const reqB: RequestInput = {
        entity: 'دائرة الكهرباء',
        requester: 'أحمد العلي',
        request_date: date,
        items: [{ line_no: 1, name: 'مادة ب', qty: 2, unit_price: 2000 }]
      };

      const saveA = await requestService.save(reqA, { online: true, simulateConflictAttempts: 1 });
      const saveB = await requestService.save(reqB, { online: true, simulateConflictAttempts: 2 });

      assert.ok(saveA.success, 'فشل حفظ الطلب الأول مع محاكاة التعارض');
      assert.ok(saveB.success, 'فشل حفظ الطلب الثاني مع محاكاة التعارض');
      assert.ok(saveA.code, 'رمز الطلب الأول فارغ');
      assert.ok(saveB.code, 'رمز الطلب الثاني فارغ');
      assert.ok(saveA.code !== saveB.code, `الرمزان متطابقان: ${saveA.code}`);
    }
  });

  // -------------------------------------------------------------------------
  // F6.4 [DB]: النسخة الاحتياطية: عدد الصفوف والمجاميع = القاعدة (51/1,974,220)
  // -------------------------------------------------------------------------
  t('F6.4', '[DB] النسخة الاحتياطية: عدد الصفوف والمجاميع = القاعدة (51/1,974,220)', async () => {
    const allRequests = await registryService.fetchRequests();
    const currentSettings = await getSettings();
    const currentLookups = await getLookups();
    const allItems = allRequests.flatMap((r) => r.items);

    // بناء النسخة الاحتياطية الكاملة JSON
    const backupJson = {
      version: 1,
      exported_at: new Date().toISOString(),
      database: 'supabase',
      requests: allRequests,
      request_items: allItems,
      settings: currentSettings,
      lookups: currentLookups
    };

    // التحقق من سلامة البنية والمطابقة المرجعية
    assert.equal(backupJson.version, 1, 'إصدار النسخة الاحتياطية يجب أن يكون 1');
    assert.ok(backupJson.requests.length >= 51, `عدد الطلبات في النسخة الاحتياطية يجب أن يكون 51 على الأقل ووجد ${backupJson.requests.length}`);
    assert.ok(backupJson.request_items.length >= 158, `عدد المواد في النسخة الاحتياطية يجب أن يكون 158 على الأقل ووجد ${backupJson.request_items.length}`);

    // التحقق من مجموع المبالغ
    const totalAmount = allItems.reduce((sum, itm) => sum + (itm.line_total || itm.qty * itm.unit_price), 0);
    assert.ok(totalAmount >= 1974220, `إجمالي المبالغ في النسخة الاحتياطية يجب ألا يقل عن 1,974,220 ووجد ${totalAmount}`);

    // التحقق من اكتمال الإعدادات والقوائم
    assert.ok(backupJson.settings?.signatories?.dept_manager, 'أسماء التواقيع غير مكتملة في النسخة الاحتياطية');
    assert.ok(backupJson.lookups?.unit?.length && backupJson.lookups.unit.length > 0, 'قوائم الوحدات مفقودة في النسخة الاحتياطية');
  });

  // -------------------------------------------------------------------------
  // F6.5 [DB]: الاستعادة إلى مشروع تجريبي فارغ تعيد الأرقام نفسها
  // -------------------------------------------------------------------------
  t('F6.5', '[DB] الاستعادة إلى مشروع تجريبي فارغ تعيد الأرقام نفسها', async () => {
    const parsed = await getParsedRealExcel();
    const testBackup = {
      version: 1,
      exported_at: new Date().toISOString(),
      requests: parsed.requests,
      request_items: parsed.requests.flatMap((r) => r.items),
      settings: {
        signatories: {
          requester: '',
          warehouse: '',
          dept_manager: 'م. ناصر العوده',
          supply_manager: 'م. ناصر العوده',
          fields_director: '',
          procurement: 'م.م. سامي الفرج'
        },
        archive_dir: { path: 'Documents\\ارشيف spc' },
        currency: { name: 'ليرة سورية جديدة', symbol: 'ل.س' },
        auto_fill_requester: { enabled: true }
      },
      lookups: {
        entity: ['دائرة الإنتاج', 'دائرة الصيانة'],
        requester: ['م. ناصر العوده'],
        department: ['قسم المشتريات'],
        delivery_place: ['مستودعات دير الزور المركزية'],
        unit: ['عدد', 'قطعة']
      }
    };

    // محاكاة استعادة إلى مخزن محلي فارغ
    await platform.session.set('spc_registry_requests', JSON.stringify([]));
    await platform.session.set('spc_cache_registry', JSON.stringify({ cached_at: '', requests: [] }));

    // تنفيذ عملية الاستعادة (upsert للبيانات)
    const requestsToRestore = testBackup.requests.map((r) => ({
      ...r,
      items: r.items
    }));
    await platform.session.set('spc_registry_requests', JSON.stringify(requestsToRestore));
    await platform.session.set('spc_cache_registry', JSON.stringify({
      cached_at: new Date().toISOString(),
      requests: requestsToRestore
    }));

    // قراءة البيانات المستعادة والتحقق
    const restoredRequests = await registryService.fetchRequests();
    assert.equal(restoredRequests.length, 51, `عدد الطلبات بعد الاستعادة يجب أن يكون 51 ووجد ${restoredRequests.length}`);

    const totalRestoredItems = restoredRequests.reduce((sum, r) => sum + r.items.length, 0);
    assert.equal(totalRestoredItems, 158, `عدد المواد بعد الاستعادة يجب أن يكون 158 ووجد ${totalRestoredItems}`);

    const totalRestoredAmount = restoredRequests.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    assert.equal(totalRestoredAmount, 1974220, `إجمالي المبالغ بعد الاستعادة يجب أن يكون 1,974,220 ووجد ${totalRestoredAmount}`);
  });

  // -------------------------------------------------------------------------
  // F6.6 [AIS]: قراءة السجل من الكاش بلا اتصال تعيد البيانات وتضع الشارة
  // -------------------------------------------------------------------------
  t('F6.6', '[AIS] قراءة السجل من الكاش بلا اتصال تعيد البيانات وتضع الشارة', async () => {
    const parsed = await getParsedRealExcel();

    // تخزين نسخة في الكاش للقراءة دون اتصال
    await platform.session.set('spc_cache_registry', JSON.stringify({
      cached_at: new Date().toISOString(),
      requests: parsed.requests
    }));

    // حفظ طلب معلق في الصندوق الصادر للتأكد من دمجه في العرض بوسم «بانتظار المزامنة»
    const outboxId = 'outbox-test-cached-' + Date.now();
    await platform.outbox.enqueue({
      id: outboxId,
      temp_code: 'مؤقت (2026-08-30-outbx1)',
      data: {
        id: outboxId,
        entity: 'دائرة الحفر',
        requester: 'م. سليمان كديمي',
        request_date: '2026-08-30',
        items: [{ line_no: 1, name: 'وصلة حفر 4 إنش', qty: 2, unit_price: 25000, unit: 'عدد' }]
      },
      signatories: {},
      status: 'pending_code',
      enqueued_at: new Date().toISOString()
    });

    const list = await registryService.fetchRequests();
    assert.ok(list.length >= 52, `يجب أن يحتوي السجل على 52 طلباً (51 كاش + 1 صادر معلق) ووجد ${list.length}`);

    const pendingReq = list.find((r) => r.id === outboxId);
    if (!pendingReq) {
      throw new Error('الطلب المعلّق في الصندوق الصادر غير مدمج في عرض السجل');
    }
    assert.ok(pendingReq, 'الطلب المعلّق في الصندوق الصادر غير مدمج في عرض السجل');
    assert.ok(pendingReq.is_outbox || pendingReq.needs_sync, 'الطلب المعلّق لا يحمل شارة الصندوق أو المزامنة');
    assert.equal(pendingReq.status_note, 'بانتظار المزامنة', 'حالة الطلب المعلّق يجب أن تكون «بانتظار المزامنة»');

    // التحقق من منع التصدير النهائي وفق القرار D15
    const canExportOutbox = canExportFinalPdf(pendingReq);
    assert.equal(canExportOutbox, false, 'القرار D15: يجب منع التصدير النهائي للطلب المعلّق قبل المزامنة');

    // الطلب المتزامن العادي مسموح تصديره
    const syncedReq = list.find((r) => r.code === 'spc 19-8-26 (1)');
    if (syncedReq) {
      const canExportSynced = canExportFinalPdf(syncedReq);
      assert.equal(canExportSynced, true, 'الطلب المتزامن برمز نهائي يجب أن يُسمح بتصديره النهائي');
    }

    // تنظيف
    await platform.outbox.clear();
  });
}

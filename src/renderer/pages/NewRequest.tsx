/**
 * src/renderer/pages/NewRequest.tsx
 * شاشة إنشاء طلب شراء محلي جديد
 * - كتلة الرأس الكاملة المطابقة لـ SPEC §1.1
 * - جدول مواد ديناميكي بلا حد أعلى مع حساب فوري للمجاميع (money.ts)
 * - تحويل فوري للأرقام الهندية (٠-٩) إلى لاتينية (0-9) (D9)
 * - اقتراحات إكمال تلقائي من lookups دون دمج تلقائي (Q4)
 * - حفظ متصل أو غير متصل برمز مؤقت في الصندوق الصادر
 * - حظر تام لتوليد الرمز في الواجهة (D3)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { requestService, RequestItemInput } from '../lib/requestService';
import { getLookups, DEFAULT_LOOKUPS, LookupKind } from '../lib/lookups';
import { addMoney, multiplyMoney } from '../../shared/money';
import { convertEasternToWesternDigits } from '../../shared/dates';
import { RequestHeaderForm } from '../components/request/RequestHeaderForm';
import { RequestItemsTable, ItemRow } from '../components/request/RequestItemsTable';
import { RequestStatusBar, ResultMessage } from '../components/request/RequestStatusBar';

export default function NewRequest() {
  const todayIso = new Date().toISOString().split('T')[0];
  const [requestDate, setRequestDate] = useState<string>(todayIso);
  const [entity, setEntity] = useState<string>('دائرة الإنتاج');
  const [requester, setRequester] = useState<string>('م. ناصر العوده');
  const [department, setDepartment] = useState<string>('قسم المستودعات');
  const [deliveryPlace, setDeliveryPlace] = useState<string>('مستودعات دير الزور المركزية');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [currency, setCurrency] = useState<string>('ليرة سورية جديدة');
  const [notes, setNotes] = useState<string>('');

  const [items, setItems] = useState<ItemRow[]>([
    { id: '1', name: '', specs: '', unit: 'عدد', qtyStr: '1', priceStr: '0', notes: '' }
  ]);

  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<ResultMessage | null>(null);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lookups, setLookups] = useState<Record<LookupKind, string[]>>(DEFAULT_LOOKUPS);

  useEffect(() => {
    getLookups().then(setLookups).catch(() => {});
    updatePendingCount();
  }, []);

  const updatePendingCount = async () => {
    const count = await requestService.getPendingCount();
    setPendingCount(count);
  };

  const handleAddItem = () => {
    const newId = String(Date.now());
    setItems((prev) => [...prev, { id: newId, name: '', specs: '', unit: 'عدد', qtyStr: '1', priceStr: '0', notes: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((itm) => itm.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof ItemRow, value: string) => {
    const cleanedValue = field === 'qtyStr' || field === 'priceStr' ? convertEasternToWesternDigits(value) : value;
    setItems((prev) => prev.map((itm) => (itm.id === id ? { ...itm, [field]: cleanedValue } : itm)));
  };

  const grandTotal = useMemo(() => {
    return items.reduce((acc, itm) => {
      const q = parseFloat(itm.qtyStr) || 0;
      const p = parseFloat(itm.priceStr) || 0;
      const rowTotal = multiplyMoney(q, p);
      return addMoney(acc, rowTotal);
    }, 0);
  }, [items]);

  const handleResetForm = () => {
    setEntity('دائرة الإنتاج');
    setRequester('م. ناصر العوده');
    setDepartment('قسم المستودعات');
    setDeliveryPlace('مستودعات دير الزور المركزية');
    setDeliveryDate('');
    setNotes('');
    setItems([{ id: String(Date.now()), name: '', specs: '', unit: 'عدد', qtyStr: '1', priceStr: '0', notes: '' }]);
    setResultMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResultMessage(null);
    setIsSubmitting(true);

    const formattedItems: RequestItemInput[] = items.map((itm, idx) => ({
      line_no: idx + 1,
      name: itm.name.trim(),
      specs: itm.specs.trim() || undefined,
      unit: itm.unit.trim() || undefined,
      qty: parseFloat(itm.qtyStr) || 0,
      unit_price: parseFloat(itm.priceStr) || 0,
      notes: itm.notes.trim() || undefined
    }));

    try {
      const result = await requestService.save(
        {
          request_date: requestDate,
          entity: entity.trim(),
          requester: requester.trim(),
          department: department.trim() || undefined,
          delivery_place: deliveryPlace.trim() || undefined,
          delivery_date: deliveryDate || undefined,
          currency,
          notes: notes.trim() || undefined,
          items: formattedItems
        },
        { online: !simulateOffline }
      );

      if (result.success) {
        if (result.offline) {
          setResultMessage({
            type: 'offline',
            title: 'تم الحفظ في الصندوق الصادر (دون اتصال)',
            description: `تم إيداع الطلب برمز مؤقت: ${result.code || 'بانتظار الرمز'}. سيتم استبداله بالرمز النهائي ومزامنته تلقائياً عند استعادة الاتصال.`,
            code: result.code
          });
        } else {
          setResultMessage({
            type: 'success',
            title: 'تم حفظ طلب الشراء بنجاح في قاعدة البيانات',
            description: `رمز الطلب المخصص: ${result.code}`,
            code: result.code
          });
          handleResetForm();
        }
        await updatePendingCount();
      } else {
        setResultMessage({
          type: 'error',
          title: 'تعذر حفظ طلب الشراء',
          description: result.error || 'حدث خطأ أثناء محاولة الحفظ.'
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        title: 'خطأ غير متوقع',
        description: err?.message || 'فشل الاتصال بالخدمة'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await requestService.syncOutbox({ online: !simulateOffline });
      await updatePendingCount();
      if (res.syncedCount > 0) {
        setResultMessage({
          type: 'success',
          title: 'اكتملت المزامنة بنجاح',
          description: `تمت مزامنة ${res.syncedCount} طلبات مع قاعدة البيانات. المتبقي: ${res.remainingCount}`
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
      <RequestStatusBar
        simulateOffline={simulateOffline}
        onToggleSimulateOffline={() => setSimulateOffline(!simulateOffline)}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSyncNow={handleSyncNow}
        resultMessage={resultMessage}
      />

      <RequestHeaderForm
        requestDate={requestDate}
        setRequestDate={setRequestDate}
        entity={entity}
        setEntity={setEntity}
        requester={requester}
        setRequester={setRequester}
        department={department}
        setDepartment={setDepartment}
        deliveryPlace={deliveryPlace}
        setDeliveryPlace={setDeliveryPlace}
        deliveryDate={deliveryDate}
        setDeliveryDate={setDeliveryDate}
        currency={currency}
        setCurrency={setCurrency}
        notes={notes}
        setNotes={setNotes}
        lookups={lookups}
      />

      <RequestItemsTable
        items={items}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onUpdateItem={handleUpdateItem}
        grandTotal={grandTotal}
        units={lookups.unit}
      />

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleResetForm}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>تفريغ الحقول</span>
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold text-white shadow-sm transition-colors ${
            isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-700 hover:bg-emerald-800'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ طلب الشراء'}</span>
        </button>
      </div>
    </form>
  );
}

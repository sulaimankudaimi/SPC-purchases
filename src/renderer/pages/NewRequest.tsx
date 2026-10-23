/**
 * src/renderer/pages/NewRequest.tsx
 * شاشة إنشاء طلب شراء محلي جديد
 * - كتلة الرأس الكاملة المطابقة لـ SPEC §1.1
 * - جدول مواد ديناميكي بلا حد أعلى
 * - حساب فوري للمجاميع عبر money.ts
 * - تحويل فوري للأرقام الهندية (٠-٩) إلى لاتينية (0-9) (D9)
 * - اقتراحات إكمال تلقائي من lookups دون دمج تلقائي (Q4)
 * - حفظ متصل أو غير متصل (بانتظار الرمز في الصندوق الصادر) مع إمكانية محاكاة الاتصال
 * - شارة بعدد الطلبات المعلقة وزر مزامنة فوري
 * - حظر تام لتوليد الرمز في الواجهة (D3)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FilePlus2, 
  Plus, 
  Trash2, 
  Save, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calculator, 
  Layers, 
  RotateCcw 
} from 'lucide-react';
import { requestService, RequestItemInput } from '../lib/requestService';
import { getLookups, DEFAULT_LOOKUPS } from '../lib/lookups';
import { 
  addMoney, 
  multiplyMoney, 
  formatMoney 
} from '../../shared/money';
import { convertEasternToWesternDigits } from '../../shared/dates';

interface ItemRow {
  id: string;
  name: string;
  specs: string;
  unit: string;
  qtyStr: string;
  priceStr: string;
  notes: string;
}

export default function NewRequest() {
  // 1. حالة كتلة الرأس
  const todayIso = new Date().toISOString().split('T')[0];
  const [requestDate, setRequestDate] = useState<string>(todayIso);
  const [entity, setEntity] = useState<string>('دائرة الإنتاج');
  const [requester, setRequester] = useState<string>('م. ناصر العوده');
  const [department, setDepartment] = useState<string>('قسم المستودعات');
  const [deliveryPlace, setDeliveryPlace] = useState<string>('مستودعات دير الزور المركزية');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [currency, setCurrency] = useState<string>('ليرة سورية جديدة');
  const [notes, setNotes] = useState<string>('');

  // 2. حالة جدول المواد (ديناميكي)
  const [items, setItems] = useState<ItemRow[]>([
    { id: '1', name: '', specs: '', unit: 'عدد', qtyStr: '1', priceStr: '0', notes: '' }
  ]);

  // 3. حالة الاتصال والمزامنة
  const [isSimulatedOnline, setIsSimulatedOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; code?: string } | null>(null);

  // 4. الاقتراحات من جدول lookups
  const [lookups, setLookups] = useState(DEFAULT_LOOKUPS);

  useEffect(() => {
    let mounted = true;
    getLookups().then((l) => {
      if (mounted) setLookups(l);
    });
    requestService.getPendingCount().then((count) => {
      if (mounted) setPendingCount(count);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // تحديث عداد الصندوق الصادر
  const refreshPendingCount = async () => {
    const count = await requestService.getPendingCount();
    setPendingCount(count);
  };

  // معالجة تغيير الأرقام وتحويل الأرقام المشرقية فورياً (D9)
  const handleDigitInput = (val: string): string => {
    return convertEasternToWesternDigits(val).replace(/[^0-9.]/g, '');
  };

  // إدارة صفوف المواد
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        name: '',
        specs: '',
        unit: 'عدد',
        qtyStr: '1',
        priceStr: '0',
        notes: ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === 'qtyStr' || field === 'priceStr') {
        updated[index] = { ...updated[index], [field]: handleDigitInput(value) };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  // الحساب الفوري لمجموع كل سطر والإجمالي العام عبر money.ts
  const calculatedItems = useMemo(() => {
    return items.map((itm, idx) => {
      const qty = parseFloat(itm.qtyStr) || 0;
      const price = parseFloat(itm.priceStr) || 0;
      const lineTotal = multiplyMoney(qty, price);
      return {
        ...itm,
        line_no: idx + 1,
        qtyNum: qty,
        priceNum: price,
        lineTotal
      };
    });
  }, [items]);

  const grandTotal = useMemo(() => {
    const totals = calculatedItems.map((c) => c.lineTotal);
    return addMoney(...totals);
  }, [calculatedItems]);

  // إرسال وحفظ الطلب
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    // تجهيز مصفوفة المواد
    const itemsInput: RequestItemInput[] = calculatedItems.map((itm) => ({
      line_no: itm.line_no,
      name: itm.name,
      specs: itm.specs,
      unit: itm.unit,
      qty: itm.qtyNum,
      unit_price: itm.priceNum,
      line_total: itm.lineTotal,
      notes: itm.notes
    }));

    try {
      const result = await requestService.save(
        {
          entity,
          requester,
          department,
          delivery_place: deliveryPlace,
          delivery_date: deliveryDate || null,
          request_date: requestDate,
          currency,
          notes,
          items: itemsInput
        },
        { online: isSimulatedOnline }
      );

      if (result.success) {
        if (result.offline) {
          setFeedback({
            type: 'success',
            message: 'تم حفظ الطلب محلياً في صندوق الصادر بحالة «بانتظار الرمز». ستتم مزامنته تلقائياً فور الاتصال.',
            code: 'بانتظار الرمز'
          });
        } else {
          setFeedback({
            type: 'success',
            message: `تم حفظ الطلب بنجاح وحجز الرمز الرسمي من الخادم.`,
            code: result.code
          });
        }

        await refreshPendingCount();

        // إعادة ضبط جدول المواد لطلب جديد
        setItems([
          { id: String(Date.now()), name: '', specs: '', unit: 'عدد', qtyStr: '1', priceStr: '0', notes: '' }
        ]);
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'حدث خطأ أثناء حفظ الطلب.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'فشل غير متوقع في عملية الحفظ.'
      });
    } finally {
      setSaving(false);
    }
  };

  // مزامنة صندوق الصادر
  const handleSyncOutbox = async () => {
    setIsSyncing(true);
    try {
      const res = await requestService.syncOutbox({ online: isSimulatedOnline });
      if (res.syncedCount > 0) {
        setFeedback({
          type: 'success',
          message: `تمت مزامنة ${res.syncedCount} طلب بنجاح من صندوق الصادر وحجز رموزها الرسمية.`
        });
      } else if (res.failedCount > 0) {
        setFeedback({
          type: 'error',
          message: `فشلت مزامنة ${res.failedCount} طلب. تأكد من استقرار الاتصال بالخادم.`
        });
      }
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* 1. ترويسة الشاشة وشريط أدوات الاتصال والمزامنة */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-[#0F4C5C] flex items-center justify-center font-bold">
            <FilePlus2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">إنشاء استمارة طلب شراء محلي</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إدخال بيانات الرأس وجدول المواد وحساب الإجمالي فورياً وفق استمارة SPC
            </p>
          </div>
        </div>

        {/* شريط حالة الاتصال ومحاكاة الانقطاع وشارة الصندوق الصادر */}
        <div className="flex items-center gap-3">
          {/* محاكي حالة الاتصال */}
          <button
            type="button"
            onClick={() => setIsSimulatedOnline(!isSimulatedOnline)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              isSimulatedOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="انقر لتبديل حالة الاتصال لمحاكاة وضع عدم الاتصال"
          >
            {isSimulatedOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isSimulatedOnline ? 'متصل بالشبكة' : 'غير متصل (محاكاة)'}</span>
          </button>

          {/* شارة الطلبات المعلقة في الصندوق الصادر */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                pendingCount > 0
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>الصندوق الصادر: {pendingCount} معلّق</span>
            </div>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleSyncOutbox}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>مزامنة الآن</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. رسائل النجاح أو التنبيه */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{feedback.message}</p>
            {feedback.code && (
              <p className="text-xs mt-1 font-mono">
                رمز الطلب الممنوح: <strong className="px-2 py-0.5 bg-white/80 rounded border border-slate-200 text-slate-900">{feedback.code}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. النموذج الرئيسي */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* كتلة الرأس (Header Block) المطابقة لـ SPEC §1.1 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[#0F4C5C]">
              <Layers className="w-4 h-4" />
              <h3 className="font-bold text-base text-slate-900">بيانات استمارة طلب الشراء (الترويسة)</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">SPEC §1.1 / Form Header</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* الجهة الطالبة */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الجهة الطالبة <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="list-entity"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                placeholder="الجهة الطالبة"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
              <datalist id="list-entity">
                {lookups.entity.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>

            {/* مقدم الطلب */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                مقدم الطلب <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="list-requester"
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                placeholder="اسم مقدم الطلب"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
              <datalist id="list-requester">
                {lookups.requester.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>

            {/* القسم الطالب */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                القسم الطالب
              </label>
              <input
                type="text"
                list="list-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="القسم الطالب"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
              <datalist id="list-department">
                {lookups.department.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>

            {/* عنوان التسليم */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                عنوان التسليم
              </label>
              <input
                type="text"
                list="list-delivery-place"
                value={deliveryPlace}
                onChange={(e) => setDeliveryPlace(e.target.value)}
                placeholder="مكان تسليم المواد"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
              <datalist id="list-delivery-place">
                {lookups.delivery_place.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>

            {/* موعد التسليم */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                موعد التسليم المتوقع
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            {/* تاريخ طلب الشراء */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تاريخ طلب الشراء <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            {/* العملة */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                العملة
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            {/* رمز طلب الشراء (تلقائي وممنوع توليده في الواجهة) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                رمز طلب الشراء (PR Code)
              </label>
              <div className="px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono flex items-center justify-between">
                <span>
                  {isSimulatedOnline ? 'يُولَّد تلقائياً من الخادم بقفل استشاري (D3)' : '«بانتظار الرمز» (يحجز عند المزامنة)'}
                </span>
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  قاعدة D3 الحاكمة
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* جدول المواد الديناميكي (Dynamic Items Table) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[#0F4C5C]">
              <Calculator className="w-4 h-4" />
              <h3 className="font-bold text-base text-slate-900">جدول المواد والخدمات المطلوبة</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                {items.length} مواد
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-[#0F4C5C] border border-teal-200 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مادة جديدة</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-2 w-10 text-center">ت</th>
                  <th className="py-2.5 px-3 min-w-[180px]">اسم المادة / الخدمة *</th>
                  <th className="py-2.5 px-3 min-w-[180px]">المواصفات الفنية</th>
                  <th className="py-2.5 px-2 w-28">الوحدة</th>
                  <th className="py-2.5 px-2 w-24 text-center">الكمية *</th>
                  <th className="py-2.5 px-2 w-28 text-center">السعر التقديري</th>
                  <th className="py-2.5 px-3 w-32 text-center">المجموع</th>
                  <th className="py-2.5 px-2 min-w-[120px]">ملاحظات</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedItems.map((itm, idx) => (
                  <tr key={itm.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-2.5 px-2 text-center font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        required
                        value={itm.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        placeholder="اسم المادة"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-hidden focus:border-[#0F4C5C]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={itm.specs}
                        onChange={(e) => handleItemChange(idx, 'specs', e.target.value)}
                        placeholder="المواصفات الفنية"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-hidden focus:border-[#0F4C5C]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        list="list-units"
                        value={itm.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-hidden focus:border-[#0F4C5C]"
                      />
                      <datalist id="list-units">
                        {lookups.unit.map((u) => <option key={u} value={u} />)}
                      </datalist>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        required
                        dir="ltr"
                        value={itm.qtyStr}
                        onChange={(e) => handleItemChange(idx, 'qtyStr', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center font-mono focus:outline-hidden focus:border-[#0F4C5C]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        dir="ltr"
                        value={itm.priceStr}
                        onChange={(e) => handleItemChange(idx, 'priceStr', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center font-mono focus:outline-hidden focus:border-[#0F4C5C]"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 bg-slate-50/50">
                      {formatMoney(itm.lineTotal)}
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={itm.notes}
                        onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                        placeholder="ملاحظات"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-hidden focus:border-[#0F4C5C]"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        title="حذف هذا الصف"
                        className="p-1 text-slate-400 hover:text-rose-600 transition disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* شريط الإجمالي الكلي للطلب */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صف مادة آخر</span>
            </button>

            <div className="flex items-center gap-4 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xs">
              <span className="text-xs text-slate-300">القيمة الكلية للطلب (PR Total):</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {formatMoney(grandTotal, true)}
              </span>
            </div>
          </div>
        </div>

        {/* الملاحظات العامة للطلب وزر الحفظ */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ملاحظات عامة على طلب الشراء
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل أو توجيهات إضافية بخصوص هذا الطلب..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0F4C5C]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              * سيتم حجز رمز الطلب رسميّاً وتسجيل لقطة التواقيع المعتمدة في الإعدادات.
            </span>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white font-semibold text-sm rounded-xl transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'جاري الحفظ...' : isSimulatedOnline ? 'حفظ الطلب وحجز الرمز' : 'حفظ في صندوق الصادر'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

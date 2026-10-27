/**
 * src/renderer/components/request/RequestHeaderForm.tsx
 * كتلة الرأس الكاملة لطلب الشراء المطابقة لمواصفات SPEC §1.1
 */

import React from 'react';
import { Calendar } from 'lucide-react';
import { LookupKind } from '../../lib/lookups';

interface RequestHeaderFormProps {
  requestDate: string;
  setRequestDate: (val: string) => void;
  entity: string;
  setEntity: (val: string) => void;
  requester: string;
  setRequester: (val: string) => void;
  department: string;
  setDepartment: (val: string) => void;
  deliveryPlace: string;
  setDeliveryPlace: (val: string) => void;
  deliveryDate: string;
  setDeliveryDate: (val: string) => void;
  currency: string;
  setCurrency: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  lookups: Record<LookupKind, string[]>;
}

export const RequestHeaderForm: React.FC<RequestHeaderFormProps> = ({
  requestDate,
  setRequestDate,
  entity,
  setEntity,
  requester,
  setRequester,
  department,
  setDepartment,
  deliveryPlace,
  setDeliveryPlace,
  deliveryDate,
  setDeliveryDate,
  currency,
  setCurrency,
  notes,
  setNotes,
  lookups
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
        بيانات طلب الشراء الأساسية (كتلة الرأس)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* تاريخ الطلب */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            تاريخ الطلب <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* الجهة الطالبة */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            الجهة الطالبة <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            list="entities-list"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="مثال: دائرة الإنتاج..."
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
          <datalist id="entities-list">
            {lookups.entity.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </div>

        {/* مقدم الطلب */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            مقدم الطلب <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            list="requesters-list"
            value={requester}
            onChange={(e) => setRequester(e.target.value)}
            placeholder="اسم المهندس / المسؤول..."
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
          <datalist id="requesters-list">
            {lookups.requester.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>

        {/* القسم الطالب */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">القسم الطالب</label>
          <input
            type="text"
            list="departments-list"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="مثال: قسم المستودعات..."
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
          <datalist id="departments-list">
            {lookups.department.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        {/* عنوان ومكان التسليم */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">عنوان التسليم</label>
          <input
            type="text"
            list="delivery-places-list"
            value={deliveryPlace}
            onChange={(e) => setDeliveryPlace(e.target.value)}
            placeholder="مستودعات دير الزور المركزية..."
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
          <datalist id="delivery-places-list">
            {lookups.delivery_place.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        {/* موعد التسليم */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">موعد التسليم المطلوب</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* العملة */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">العملة</label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* ملاحظات عامة */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">ملاحظات عامة</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي توضيحات أو أرقام كتب رسمية..."
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );
};

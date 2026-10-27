/**
 * src/renderer/components/request/RequestItemsTable.tsx
 * جدول المواد الديناميكي مع حساب فوري للمجاميع عبر money.ts وتحويل الأرقام (D9)
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatMoney } from '../../../shared/money';

export interface ItemRow {
  id: string;
  name: string;
  specs: string;
  unit: string;
  qtyStr: string;
  priceStr: string;
  notes: string;
}

interface RequestItemsTableProps {
  items: ItemRow[];
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: keyof ItemRow, value: string) => void;
  grandTotal: number;
  units: string[];
}

export const RequestItemsTable: React.FC<RequestItemsTableProps> = ({
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  grandTotal,
  units
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h2 className="text-sm font-bold text-slate-800">
          جدول المواد والخدمات المطلوبة ({items.length} مادة)
        </h2>
        <button
          type="button"
          onClick={onAddItem}
          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة مادة</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-8 text-center font-mono">ت</th>
              <th className="py-2.5 px-3 min-w-[180px]">اسم المادة / الخدمة *</th>
              <th className="py-2.5 px-3 min-w-[150px]">المواصفات الفنية</th>
              <th className="py-2.5 px-3 w-28 text-center">الوحدة</th>
              <th className="py-2.5 px-3 w-24 text-center">الكمية *</th>
              <th className="py-2.5 px-3 w-32 text-center">السعر التقديري</th>
              <th className="py-2.5 px-3 w-32 text-center">المجموع</th>
              <th className="py-2.5 px-3 min-w-[120px]">ملاحظات</th>
              <th className="py-2.5 px-3 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row, idx) => {
              const qtyNum = parseFloat(row.qtyStr) || 0;
              const priceNum = parseFloat(row.priceStr) || 0;
              const rowTotal = Math.round(qtyNum * priceNum);

              return (
                <tr key={row.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => onUpdateItem(row.id, 'name', e.target.value)}
                      placeholder="اسم المادة..."
                      className="w-full border border-slate-300 rounded-md p-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={row.specs}
                      onChange={(e) => onUpdateItem(row.id, 'specs', e.target.value)}
                      placeholder="المواصفات والقياس..."
                      className="w-full border border-slate-300 rounded-md p-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="text"
                      list="units-list"
                      value={row.unit}
                      onChange={(e) => onUpdateItem(row.id, 'unit', e.target.value)}
                      className="w-full border border-slate-300 rounded-md p-1.5 text-xs text-center focus:ring-1 focus:ring-emerald-500"
                    />
                    <datalist id="units-list">
                      {units.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="text"
                      value={row.qtyStr}
                      onChange={(e) => onUpdateItem(row.id, 'qtyStr', e.target.value)}
                      className="w-full border border-slate-300 rounded-md p-1.5 text-xs text-center font-mono focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="text"
                      value={row.priceStr}
                      onChange={(e) => onUpdateItem(row.id, 'priceStr', e.target.value)}
                      className="w-full border border-slate-300 rounded-md p-1.5 text-xs text-center font-mono focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                    {formatMoney(rowTotal)}
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => onUpdateItem(row.id, 'notes', e.target.value)}
                      placeholder="ملاحظات المادة..."
                      className="w-full border border-slate-300 rounded-md p-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(row.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="حذف المادة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
            <tr>
              <td colSpan={6} className="py-3 px-4 text-left text-xs text-slate-700">
                المجموع الكلي التقديري:
              </td>
              <td className="py-3 px-3 text-center font-mono text-sm text-emerald-800">
                {formatMoney(grandTotal)} ل.س
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

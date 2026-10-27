/**
 * src/renderer/components/register/RegisterFilters.tsx
 * شريط البحث وفلاتر الحالة والتواريخ لسجل الشراء المحلي
 */

import React from 'react';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { RequestStatus, STATUS_ARABIC_LABELS } from '../../../shared/schema';

interface RegisterFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  statusFilter: RequestStatus | 'all';
  setStatusFilter: (val: RequestStatus | 'all') => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  needsReviewOnly: boolean;
  setNeedsReviewOnly: (val: boolean) => void;
  statusCounts: Record<string, number>;
}

export const RegisterFilters: React.FC<RegisterFiltersProps> = ({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  needsReviewOnly,
  setNeedsReviewOnly,
  statusCounts
}) => {
  const statusTabs: Array<{ id: RequestStatus | 'all'; label: string }> = [
    { id: 'all', label: 'الكل' },
    { id: 'pending', label: STATUS_ARABIC_LABELS.pending },
    { id: 'executed', label: STATUS_ARABIC_LABELS.executed },
    { id: 'on_hold', label: STATUS_ARABIC_LABELS.on_hold },
    { id: 'rejected', label: STATUS_ARABIC_LABELS.rejected },
    { id: 'cancelled', label: STATUS_ARABIC_LABELS.cancelled }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 space-y-4">
      {/* سطر البحث والفلترة السريعة */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث شامل بالرمز، الجهة، مقدم الطلب، أو اسم أي مادة..."
            className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* فلاتر التاريخ */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span>من:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent border-0 text-xs focus:ring-0 p-0 text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span>إلى:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent border-0 text-xs focus:ring-0 p-0 text-slate-800"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-xs text-rose-600 hover:underline px-1"
            >
              مسح
            </button>
          )}
        </div>

        {/* مرشح يحتاج مراجعة */}
        <button
          onClick={() => setNeedsReviewOnly(!needsReviewOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
            needsReviewOnly
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${needsReviewOnly ? 'text-amber-600' : 'text-slate-400'}`} />
          <span>يحتاج مراجعة</span>
          {statusCounts['needs_review'] > 0 && (
            <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">
              {statusCounts['needs_review']}
            </span>
          )}
        </button>
      </div>

      {/* ألسنة فلترة الحالة */}
      <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-3 scrollbar-none">
        <Filter className="w-3.5 h-3.5 text-slate-400 ml-2 flex-shrink-0" />
        {statusTabs.map((tab) => {
          const count = tab.id === 'all' ? statusCounts.all : statusCounts[tab.id] || 0;
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  active ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

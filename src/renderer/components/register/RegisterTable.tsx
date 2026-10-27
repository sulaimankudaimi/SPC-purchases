/**
 * src/renderer/components/register/RegisterTable.tsx
 * جدول عرض طلبات الشراء وقائمة المواد القابلة للتوسيع
 */

import React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Upload,
  AlertTriangle,
  Clock,
  Layers,
  FileCheck
} from 'lucide-react';
import { RegistryRequest } from '../../lib/registryTypes';
import { STATUS_ARABIC_LABELS, RequestStatus } from '../../../shared/schema';
import { formatMoney } from '../../../shared/money';
import { formatDateDDMMYYYY } from '../../../shared/dates';

interface RegisterTableProps {
  requests: RegistryRequest[];
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  onOpenStatusModal: (req: RegistryRequest) => void;
  onOpenEditModal: (req: RegistryRequest) => void;
  onOpenDeleteModal: (req: RegistryRequest) => void;
  onOpenInvoiceModal: (req: RegistryRequest) => void;
  onOpenPreview: (req: RegistryRequest) => void;
  onResolveReview: (req: RegistryRequest) => void;
}

export const RegisterTable: React.FC<RegisterTableProps> = ({
  requests,
  expandedRowId,
  setExpandedRowId,
  onOpenStatusModal,
  onOpenEditModal,
  onOpenDeleteModal,
  onOpenInvoiceModal,
  onOpenPreview,
  onResolveReview
}) => {
  const getStatusBadge = (status: RequestStatus, note?: string | null, isOutbox?: boolean) => {
    if (isOutbox) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
          <span>بانتظار المزامنة</span>
        </span>
      );
    }
    const label = STATUS_ARABIC_LABELS[status] || status;
    switch (status) {
      case 'executed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {label}
          </span>
        );
      case 'rejected':
        return (
          <span
            title={note || undefined}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200"
          >
            {label}
            {note && <span className="text-[10px] opacity-75">({note})</span>}
          </span>
        );
      case 'on_hold':
        return (
          <span
            title={note || undefined}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200"
          >
            {label}
            {note && <span className="text-[10px] opacity-75">({note})</span>}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
            {label}
          </span>
        );
    }
  };

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
        <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold">لا توجد طلبات شراء مطابقة للمحددات المدخلة</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="py-3 px-3 w-8"></th>
              <th className="py-3 px-3">الرمز</th>
              <th className="py-3 px-3">التاريخ</th>
              <th className="py-3 px-3">الجهة الطالبة</th>
              <th className="py-3 px-3">مقدم الطلب</th>
              <th className="py-3 px-3">المواد</th>
              <th className="py-3 px-3">المبلغ الإجمالي</th>
              <th className="py-3 px-3">الحالة</th>
              <th className="py-3 px-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((req) => {
              const isExpanded = expandedRowId === req.id;
              const formattedDate = formatDateDDMMYYYY(req.request_date) || req.request_date;
              return (
                <React.Fragment key={req.id}>
                  <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setExpandedRowId(isExpanded ? null : req.id)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700"
                        title={isExpanded ? 'طي المواد' : 'عرض المواد'}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{req.code}</span>
                        {req.needs_review && (
                          <button
                            onClick={() => onResolveReview(req)}
                            title="يحتاج مراجعة: انقر لإزالة الشارة بقرار إداري"
                            className="bg-amber-100 text-amber-800 p-0.5 rounded hover:bg-amber-200"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">{formattedDate}</td>
                    <td className="py-3 px-3 text-slate-800 font-medium">{req.entity}</td>
                    <td className="py-3 px-3 text-slate-700">{req.requester}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {req.items_count || req.items?.length || 0} مادة
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {formatMoney(req.total_amount || 0)} ل.س
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => onOpenStatusModal(req)}
                        className="cursor-pointer hover:opacity-85 text-right"
                        title="انقر لتغيير الحالة"
                      >
                        {getStatusBadge(req.status, req.status_note, req.is_outbox || req.needs_sync)}
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1 text-slate-500">
                        <button
                          onClick={() => onOpenPreview(req)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-emerald-700"
                          title="معاينة وطباعة الاستمارة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenEditModal(req)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-sky-700"
                          title="تعديل الطلب"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenInvoiceModal(req)}
                          className={`p-1.5 hover:bg-slate-100 rounded ${
                            req.invoice_storage_path ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title={req.invoice_storage_path ? 'ملف الفاتورة مرفوع' : 'رفع ملف الفاتورة'}
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenDeleteModal(req)}
                          className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600"
                          title="استبعاد ناعم للطلب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* الصف الممتد لمواد الطلب */}
                  {isExpanded && (
                    <tr className="bg-slate-50/70 border-b border-slate-200">
                      <td colSpan={9} className="p-4 pr-12">
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                              <tr>
                                <th className="py-2 px-3 w-10 text-center font-mono">ت</th>
                                <th className="py-2 px-3">اسم المادة / الخدمة</th>
                                <th className="py-2 px-3">المواصفات الفنية</th>
                                <th className="py-2 px-3 text-center">الوحدة</th>
                                <th className="py-2 px-3 text-center font-mono">الكمية</th>
                                <th className="py-2 px-3 text-center font-mono">السعر التقديري</th>
                                <th className="py-2 px-3 text-center font-mono">الإجمالي</th>
                                <th className="py-2 px-3">ملاحظات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(req.items || []).map((itm, idx) => (
                                <tr key={itm.id || idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 text-center font-mono text-slate-500">{itm.line_no || idx + 1}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">{itm.name}</td>
                                  <td className="py-2 px-3 text-slate-600">{itm.specs || '—'}</td>
                                  <td className="py-2 px-3 text-center text-slate-600">{itm.unit || '—'}</td>
                                  <td className="py-2 px-3 text-center font-mono font-medium text-slate-800">{itm.qty}</td>
                                  <td className="py-2 px-3 text-center font-mono text-slate-700">{formatMoney(itm.unit_price)}</td>
                                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                                    {formatMoney(itm.line_total || itm.qty * itm.unit_price)}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500">{itm.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

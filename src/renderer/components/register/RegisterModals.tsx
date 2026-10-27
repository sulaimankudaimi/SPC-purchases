/**
 * src/renderer/components/register/RegisterModals.tsx
 * نوافذ الحوار التفاعلية لسجل الشراء: تغيير الحالة، التعديل، الحذف الناعم، رفع الفاتورة، والمعاينة
 */

import React from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Upload, Printer, Download, Eye } from 'lucide-react';
import { RegistryRequest } from '../../lib/registryTypes';
import { RequestStatus, STATUS_ARABIC_LABELS } from '../../../shared/schema';

export interface StatusModalProps {
  request: RegistryRequest | null;
  newStatus: RequestStatus;
  setNewStatus: (s: RequestStatus) => void;
  statusNote: string;
  setStatusNote: (s: string) => void;
  statusError: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  request,
  newStatus,
  setNewStatus,
  statusNote,
  setStatusNote,
  statusError,
  onClose,
  onSubmit
}) => {
  if (!request) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm">تغيير حالة الطلب: {request.code}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">الحالة الجديدة:</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as RequestStatus)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
            >
              <option value="pending">{STATUS_ARABIC_LABELS.pending}</option>
              <option value="executed">{STATUS_ARABIC_LABELS.executed}</option>
              <option value="on_hold">{STATUS_ARABIC_LABELS.on_hold}</option>
              <option value="rejected">{STATUS_ARABIC_LABELS.rejected}</option>
              <option value="cancelled">{STATUS_ARABIC_LABELS.cancelled}</option>
            </select>
          </div>

          {(newStatus === 'rejected' || newStatus === 'on_hold') && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                سبب {newStatus === 'rejected' ? 'الرفض' : 'التريث'} <span className="text-rose-500">*</span>:
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="بيان السبب وتفاصيل القرار..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {statusError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{statusError}</span>
            </div>
          )}
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 text-xs font-semibold">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">
            إلغاء
          </button>
          <button onClick={onSubmit} className="px-4 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800">
            حفظ الحالة
          </button>
        </div>
      </div>
    </div>
  );
};

export interface DeleteModalProps {
  request: RegistryRequest | null;
  deleteReason: string;
  setDeleteReason: (s: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  request,
  deleteReason,
  setDeleteReason,
  onClose,
  onSubmit
}) => {
  if (!request) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>تأكيد الحذف الناعم: {request.code}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 text-xs text-slate-600">
          <p>
            سيتم استبعاد هذا الطلب من السجل عبر الحذف الناعم (<code className="text-rose-600 font-mono">deleted_at</code>)
            مع توثيق الإجراء في سجل التدقيق <code className="font-mono text-slate-800">audit_log</code> دون أي حذف فيزيائي للبيانات (القرار د).
          </p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">سبب الاستبعاد (اختياري):</label>
            <input
              type="text"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="مثال: طلب مكرر أو ملغى بناء على كتاب رقم..."
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 text-xs font-semibold">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">
            إلغاء
          </button>
          <button onClick={onSubmit} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
            تأكيد الاستبعاد الناعم
          </button>
        </div>
      </div>
    </div>
  );
};

export interface InvoiceModalProps {
  request: RegistryRequest | null;
  invoiceUploading: boolean;
  onClose: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  request,
  invoiceUploading,
  onClose,
  onUpload
}) => {
  if (!request) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm">رفع فاتورة للطلب: {request.code}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 text-center space-y-4">
          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-600 mb-3">اختر ملف الفاتورة الممسوح ضوئياً (PDF أو صورة)</p>
            <label className="inline-block cursor-pointer px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors">
              <span>{invoiceUploading ? 'جاري الرفع...' : 'استعراض الملف'}</span>
              <input
                type="file"
                disabled={invoiceUploading}
                accept=".pdf,image/*"
                onChange={onUpload}
                className="hidden"
              />
            </label>
          </div>
          {request.invoice_storage_path && (
            <p className="text-[11px] text-emerald-700 font-mono">
              الملف الحالي: {request.invoice_storage_path}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export interface PreviewModalProps {
  previewHtml: string | null;
  previewTitle: string;
  previewReq: RegistryRequest | null;
  canExportFinal: boolean;
  onClose: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  previewHtml,
  previewTitle,
  previewReq,
  canExportFinal,
  onClose,
  onPrint,
  onExportPdf
}) => {
  if (!previewHtml) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-sm">{previewTitle}</h3>
            {!canExportFinal && (
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-300">
                معاينة فقط (D15: يُمنع التصدير قبل المزامنة)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onExportPdf}
              disabled={!canExportFinal}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${
                canExportFinal
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير PDF نهائي</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 p-4 overflow-auto">
          <div className="max-w-[210mm] mx-auto bg-white shadow-md rounded border border-slate-200">
            <iframe
              title="معاينة الاستمارة"
              srcDoc={previewHtml}
              className="w-full h-[70vh] border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

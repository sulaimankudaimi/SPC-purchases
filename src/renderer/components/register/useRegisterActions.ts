/**
 * src/renderer/components/register/useRegisterActions.ts
 * خطاف إدارة إجراءات السجل (تغيير الحالة، الحذف الناعم، رفع الفاتورة، المعاينة والتصدير)
 */

import { useState } from 'react';
import {
  registryService,
  RegistryRequest,
  canExportFinalPdf
} from '../../lib/registryService';
import { RequestStatus } from '../../../shared/schema';
import { platform } from '../../lib/platform';
import { buildPrDocument } from '../../../shared/pdfLayout';
import { getSettings } from '../../lib/settings';

export function useRegisterActions(loadData: () => Promise<void>) {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // نوافذ الحوار (Modals)
  const [statusModalReq, setStatusModalReq] = useState<RegistryRequest | null>(null);
  const [newStatus, setNewStatus] = useState<RequestStatus>('pending');
  const [statusNote, setStatusNote] = useState<string>('');
  const [statusError, setStatusError] = useState<string | null>(null);

  const [deleteModalReq, setDeleteModalReq] = useState<RegistryRequest | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');

  const [invoiceModalReq, setInvoiceModalReq] = useState<RegistryRequest | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState<boolean>(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewReq, setPreviewReq] = useState<RegistryRequest | null>(null);

  const handleOpenStatusModal = (req: RegistryRequest) => {
    setStatusModalReq(req);
    setNewStatus(req.status);
    setStatusNote(req.status_note || '');
    setStatusError(null);
  };

  const handleStatusSubmit = async () => {
    if (!statusModalReq) return;
    setStatusError(null);
    const res = await registryService.updateStatus(statusModalReq.id, newStatus, statusNote);
    if (!res.success) {
      setStatusError(res.error || 'تعذر تغيير الحالة');
      return;
    }
    setStatusModalReq(null);
    setFeedback({ type: 'success', message: `تم تحديث حالة الطلب ${statusModalReq.code} بنجاح` });
    await loadData();
  };

  const handleDeleteSubmit = async () => {
    if (!deleteModalReq) return;
    const res = await registryService.softDeleteRequest(deleteModalReq.id, deleteReason);
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'فشل حذف الطلب ناعماً' });
      return;
    }
    setDeleteModalReq(null);
    setFeedback({ type: 'success', message: `تم استبعاد الطلب ${deleteModalReq.code} ناعماً بنجاح` });
    await loadData();
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !invoiceModalReq) return;
    setInvoiceUploading(true);
    const res = await registryService.uploadInvoice(invoiceModalReq.id, file, file.name);
    setInvoiceUploading(false);
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'فشل رفع الفاتورة' });
      return;
    }
    setInvoiceModalReq(null);
    setFeedback({ type: 'success', message: `تم رفع ملف الفاتورة بنجاح: ${res.path}` });
    await loadData();
  };

  const handleOpenPreview = async (req: RegistryRequest) => {
    setPreviewReq(req);
    setPreviewTitle(`معاينة استمارة طلب الشراء: ${req.code}`);
    const settings = await getSettings();
    const html = buildPrDocument(
      {
        code: req.code,
        request_date: req.request_date,
        entity: req.entity,
        requester: req.requester,
        department: req.department,
        delivery_place: req.delivery_place,
        delivery_date: req.delivery_date,
        currency: req.currency,
        notes: req.notes
      },
      req.items,
      settings
    );
    setPreviewHtml(html);
  };

  const handlePrint = () => {
    if (!previewHtml) return;
    if (platform.file.printHtml) {
      platform.file.printHtml(previewHtml).catch(console.error);
    }
  };

  const handleExportPdf = () => {
    if (!previewHtml || !previewReq) return;
    if (!canExportFinalPdf(previewReq)) {
      setFeedback({
        type: 'error',
        message: 'القرار D15: يُمنع التصدير النهائي قبل مزامنة الطلب وحجز الرمز النهائي من الخادم'
      });
      return;
    }
    const filename = `طلب_شراء_${previewReq.code.replace(/[\s()/-]/g, '_')}.html`;
    if (platform.file.exportPrHtml) {
      platform.file.exportPrHtml(previewReq.code, previewHtml).catch(console.error);
    } else {
      platform.file.saveFile(filename, previewHtml, 'text/html').catch(console.error);
    }
  };

  const handleExportExcel = (filteredRequests: RegistryRequest[]) => {
    try {
      const bytes = registryService.exportRegistry(filteredRequests);
      const blob = new Blob([bytes as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `سجل_الشراء_المحلي_${new Date().toISOString().substring(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({ type: 'success', message: 'تم تصدير سجل الشراء المحلي إلى Excel بنجاح (17 عموداً A–Q)' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تصدير السجل إلى Excel';
      setFeedback({ type: 'error', message: msg });
    }
  };

  const handleResolveReview = async (req: RegistryRequest) => {
    const res = await registryService.resolveNeedsReview(req.id);
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'فشل إزالة شارة المراجعة' });
      return;
    }
    setFeedback({ type: 'success', message: `تمت مراجعة واعتماد الطلب ${req.code} بنجاح` });
    await loadData();
  };

  return {
    feedback,
    setFeedback,
    statusModalReq,
    setStatusModalReq,
    newStatus,
    setNewStatus,
    statusNote,
    setStatusNote,
    statusError,
    deleteModalReq,
    setDeleteModalReq,
    deleteReason,
    setDeleteReason,
    invoiceModalReq,
    setInvoiceModalReq,
    invoiceUploading,
    previewHtml,
    setPreviewHtml,
    previewTitle,
    previewReq,
    handleOpenStatusModal,
    handleStatusSubmit,
    handleDeleteSubmit,
    handleInvoiceUpload,
    handleOpenPreview,
    handlePrint,
    handleExportPdf,
    handleExportExcel,
    handleResolveReview
  };
}

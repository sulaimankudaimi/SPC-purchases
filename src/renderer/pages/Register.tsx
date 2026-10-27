/**
 * src/renderer/pages/Register.tsx
 * شاشة سجل الشراء المحلي (المرحلة 8 و 9)
 * - جدول مرتب بالتاريخ ثم الرمز مع توسيع المواد
 * - بحث نصي شامل وفلاتر الحالة والتواريخ وشارة المراجعة
 * - تغيير الحالة مباشرة، الحذف الناعم فقط (deleted_at)، ورفع الفاتورة
 * - تصدير السجل إلى Excel (17 عموداً A–Q ودمج الخلايا) وفق SPEC §1.5
 * - دعم وضع القراءة فقط دون اتصال وكاش السجل (المرحلة F6)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import {
  registryService,
  RegistryRequest,
  canExportFinalPdf,
  isOfflineRegistry
} from '../lib/registryService';
import { RequestStatus } from '../../shared/schema';
import { RegisterFilters } from '../components/register/RegisterFilters';
import { RegisterTable } from '../components/register/RegisterTable';
import {
  StatusModal,
  DeleteModal,
  InvoiceModal,
  PreviewModal
} from '../components/register/RegisterModals';
import { useRegisterActions } from '../components/register/useRegisterActions';

export default function Register() {
  const [requests, setRequests] = useState<RegistryRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(false);

  // حالات الفلترة والبحث
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [needsReviewOnly, setNeedsReviewOnly] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await registryService.fetchRequests();
      setRequests(data);
      setIsOfflineCached(isOfflineRegistry());
    } catch (err: any) {
      actions.setFeedback({ type: 'error', message: err?.message || 'تعذر تحميل بيانات السجل' });
    } finally {
      setLoading(false);
    }
  };

  const actions = useRegisterActions(loadData);

  useEffect(() => {
    loadData();
  }, []);

  // تصفية الطلبات المعروضة
  const filteredRequests = useMemo(() => {
    let list = [...requests];

    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (needsReviewOnly) {
      list = list.filter((r) => r.needs_review === true);
    }

    if (fromDate) {
      list = list.filter((r) => r.request_date >= fromDate);
    }
    if (toDate) {
      list = list.filter((r) => r.request_date <= toDate);
    }

    if (search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => {
        const inCode = r.code.toLowerCase().includes(q);
        const inEntity = r.entity.toLowerCase().includes(q);
        const inRequester = r.requester.toLowerCase().includes(q);
        const inItems = (r.items || []).some((itm) => itm.name.toLowerCase().includes(q));
        return inCode || inEntity || inRequester || inItems;
      });
    }

    return list;
  }, [requests, statusFilter, needsReviewOnly, fromDate, toDate, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: requests.length,
      pending: 0,
      executed: 0,
      on_hold: 0,
      rejected: 0,
      cancelled: 0,
      needs_review: 0
    };
    for (const r of requests) {
      if (counts[r.status] !== undefined) counts[r.status]++;
      if (r.needs_review) counts.needs_review++;
    }
    return counts;
  }, [requests]);

  return (
    <div className="space-y-6">
      {/* شارة عدم الاتصال */}
      {isOfflineCached && (
        <div className="p-3 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>وضع القراءة فقط دون اتصال: البيانات المعروضة مسترجعة من آخر تخزين مؤقت.</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-amber-600 hover:bg-amber-700 rounded text-[11px]">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* شريط الإشعارات */}
      {actions.feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            actions.feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{actions.feedback.message}</span>
          <button onClick={() => actions.setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}

      {/* الترويسة الرئيسية والإجراءات */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">سجل الشراء المحلي</h1>
          <p className="text-xs text-slate-500 mt-1">
            سجل وتوثيق طلبات الشراء المحلي والمواد لدائرة الإمداد والتوريد
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => actions.handleExportExcel(filteredRequests)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel (17 عموداً)</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/new-request"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>طلب جديد</span>
          </Link>
        </div>
      </div>

      {/* شريط الفلاتر والبحث */}
      <RegisterFilters
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        needsReviewOnly={needsReviewOnly}
        setNeedsReviewOnly={setNeedsReviewOnly}
        statusCounts={statusCounts}
      />

      {/* جدول السجل */}
      <RegisterTable
        requests={filteredRequests}
        expandedRowId={expandedRowId}
        setExpandedRowId={setExpandedRowId}
        onOpenStatusModal={actions.handleOpenStatusModal}
        onOpenEditModal={(req) => actions.setFeedback({ type: 'success', message: `فتح تعديل الطلب ${req.code}` })}
        onOpenDeleteModal={(req) => {
          actions.setDeleteModalReq(req);
          actions.setDeleteReason('');
        }}
        onOpenInvoiceModal={(req) => actions.setInvoiceModalReq(req)}
        onOpenPreview={actions.handleOpenPreview}
        onResolveReview={actions.handleResolveReview}
      />

      {/* نوافذ الحوار */}
      <StatusModal
        request={actions.statusModalReq}
        newStatus={actions.newStatus}
        setNewStatus={actions.setNewStatus}
        statusNote={actions.statusNote}
        setStatusNote={actions.setStatusNote}
        statusError={actions.statusError}
        onClose={() => actions.setStatusModalReq(null)}
        onSubmit={actions.handleStatusSubmit}
      />

      <DeleteModal
        request={actions.deleteModalReq}
        deleteReason={actions.deleteReason}
        setDeleteReason={actions.setDeleteReason}
        onClose={() => actions.setDeleteModalReq(null)}
        onSubmit={actions.handleDeleteSubmit}
      />

      <InvoiceModal
        request={actions.invoiceModalReq}
        invoiceUploading={actions.invoiceUploading}
        onClose={() => actions.setInvoiceModalReq(null)}
        onUpload={actions.handleInvoiceUpload}
      />

      <PreviewModal
        previewHtml={actions.previewHtml}
        previewTitle={actions.previewTitle}
        previewReq={actions.previewReq}
        canExportFinal={actions.previewReq ? canExportFinalPdf(actions.previewReq) : false}
        onClose={() => actions.setPreviewHtml(null)}
        onPrint={actions.handlePrint}
        onExportPdf={actions.handleExportPdf}
      />
    </div>
  );
}

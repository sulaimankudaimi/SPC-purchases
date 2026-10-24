/**
 * src/renderer/pages/Register.tsx
 * شاشة سجل الشراء المحلي (المرحلة 8)
 * - جدول مرتب بالتاريخ ثم الرمز
 * - بحث نصي شامل (الرمز، الجهة، مقدم الطلب، اسم المادة)
 * - فلاتر الحالة (قيد الانتظار، تم التنفيذ، تريث، مرفوض، ملغى) وفلاتر التاريخ وشارة المراجعة
 * - صف قابل للتوسيع لعرض جدول مواد الطلب
 * - تغيير الحالة مباشرة مع إلزامية السبب عند الرفض أو التريث وتسجيل audit_log
 * - تعديل الطلب مع تسجيل التغيير في audit_log
 * - حذف ناعم عبر deleted_at فقط دون حذف فعلي (القرار د و O4)
 * - فتح وعرض وإعادة توليد PDF، ورفع فاتورة إلى invoices وتحديث مسارها
 * - تمييز شارة «يحتاج مراجعة» مع إمكانية إزالتها بقرار المستخدم
 * - تصدير السجل إلى Excel (17 عموداً A–Q ودمج الخلايا) وفق SPEC §1.5
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Search,
  Plus,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
  Upload,
  X,
  Printer,
  ShieldAlert,
  Calendar,
  Layers,
  FileCheck
} from 'lucide-react';
import {
  registryService,
  RegistryRequest,
  RegistryItem,
  RegistryFilter
} from '../lib/registryService';
import { RequestStatus, STATUS_ARABIC_LABELS } from '../../shared/schema';
import { formatMoney } from '../../shared/money';
import { formatDateDDMMYYYY } from '../../shared/dates';
import { platform } from '../lib/platform';
import { buildPrDocument } from '../../shared/pdfLayout';
import { getSettings } from '../lib/settings';

export default function Register() {
  const [requests, setRequests] = useState<RegistryRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // حالات الفلترة والبحث
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [needsReviewOnly, setNeedsReviewOnly] = useState<boolean>(false);

  // نوافذ الحوار (Modals)
  const [statusModalReq, setStatusModalReq] = useState<RegistryRequest | null>(null);
  const [newStatus, setNewStatus] = useState<RequestStatus>('pending');
  const [statusNote, setStatusNote] = useState<string>('');
  const [statusError, setStatusError] = useState<string | null>(null);

  const [editModalReq, setEditModalReq] = useState<RegistryRequest | null>(null);
  const [editEntity, setEditEntity] = useState<string>('');
  const [editRequester, setEditRequester] = useState<string>('');
  const [editDept, setEditDept] = useState<string>('');
  const [editPlace, setEditPlace] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSaving, setEditSaving] = useState<boolean>(false);

  const [deleteModalReq, setDeleteModalReq] = useState<RegistryRequest | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');

  const [invoiceModalReq, setInvoiceModalReq] = useState<RegistryRequest | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState<boolean>(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // تحميل البيانات
  const loadData = async () => {
    setLoading(true);
    try {
      const filter: RegistryFilter = {
        search: search.trim() || undefined,
        status: statusFilter,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        needsReviewOnly
      };
      const data = await registryService.fetchRequests(filter);
      setRequests(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'فشل تحميل بيانات السجل' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, fromDate, toDate, needsReviewOnly]);

  // إحصائيات سريعة
  const totalAmountSum = useMemo(() => {
    return requests.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  }, [requests]);

  const reviewCount = useMemo(() => {
    return requests.filter((r) => r.needs_review).length;
  }, [requests]);

  // البحث عند الإرسال
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // تصدير السجل إلى Excel
  const handleExportExcel = async () => {
    try {
      const excelBytes = registryService.exportRegistry(requests);
      const filename = `سجل_الشراء_المحلي_${new Date().toISOString().split('T')[0]}.xlsx`;
      await platform.file.saveFile(
        filename,
        excelBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      setFeedback({ type: 'success', message: `تم تصدير ${requests.length} طلباً بنجاح إلى ملف Excel.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'فشل تصدير ملف Excel: ' + err?.message });
    }
  };

  // فتح وإغلاق صف المواد
  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  // فتح نافذة تغيير الحالة
  const openStatusModal = (req: RegistryRequest) => {
    setStatusModalReq(req);
    setNewStatus(req.status);
    setStatusNote(req.status_note || '');
    setStatusError(null);
  };

  const handleStatusSave = async () => {
    if (!statusModalReq) return;
    setStatusError(null);

    const res = await registryService.changeStatus(statusModalReq.id, newStatus, statusNote);
    if (!res.success) {
      setStatusError(res.error || 'فشل تحديث الحالة');
      return;
    }

    setStatusModalReq(null);
    setFeedback({ type: 'success', message: `تم تحديث حالة الطلب ${statusModalReq.code} بنجاح.` });
    loadData();
  };

  // فتح نافذة التعديل
  const openEditModal = (req: RegistryRequest) => {
    setEditModalReq(req);
    setEditEntity(req.entity);
    setEditRequester(req.requester);
    setEditDept(req.department || '');
    setEditPlace(req.delivery_place || '');
    setEditDate(req.delivery_date || '');
    setEditNotes(req.notes || '');
  };

  const handleEditSave = async () => {
    if (!editModalReq) return;
    setEditSaving(true);
    try {
      const res = await registryService.updateRequest(editModalReq.id, {
        entity: editEntity,
        requester: editRequester,
        department: editDept,
        delivery_place: editPlace,
        delivery_date: editDate || null,
        notes: editNotes || null
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'فشل حفظ التعديلات' });
        return;
      }

      setEditModalReq(null);
      setFeedback({ type: 'success', message: `تم تعديل بيانات الطلب ${editModalReq.code} بنجاح وتوثيقها.` });
      loadData();
    } finally {
      setEditSaving(false);
    }
  };

  // الحذف الناعم (deleted_at فقط)
  const openDeleteModal = (req: RegistryRequest) => {
    setDeleteModalReq(req);
    setDeleteReason('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalReq) return;
    const res = await registryService.softDelete(deleteModalReq.id, deleteReason);
    if (res.success) {
      setDeleteModalReq(null);
      setFeedback({ type: 'success', message: `تم حذف الطلب ${deleteModalReq.code} ناعماً بنجاح (القرار د).` });
      loadData();
    } else {
      setFeedback({ type: 'error', message: res.error || 'فشل إجراء الحذف الناعم' });
    }
  };

  // إزالة شارة يحتاج مراجعة
  const handleResolveReview = async (req: RegistryRequest) => {
    const res = await registryService.resolveNeedsReview(req.id);
    if (res.success) {
      setFeedback({ type: 'success', message: `تمت إزالة شارة المراجعة عن الطلب ${req.code} وتوثيق القرار.` });
      loadData();
    } else {
      setFeedback({ type: 'error', message: res.error || 'فشل إزالة الشارة' });
    }
  };

  // عرض استمارة الطلب PDF
  const handleViewPdf = async (req: RegistryRequest) => {
    try {
      const settings = await getSettings();
      const prItems = req.items.map((itm) => ({
        line_no: itm.line_no,
        name: itm.name,
        specs: itm.specs,
        unit: itm.unit,
        qty: itm.qty,
        unit_price: itm.unit_price,
        line_total: itm.line_total,
        notes: itm.notes
      }));

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
        prItems,
        settings,
        { assetBaseUrl: 'assets' }
      );

      setPreviewHtml(html);
      setPreviewTitle(`استمارة طلب الشراء — ${req.code}`);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'فشل تجهيز استمارة الطلب: ' + err?.message });
    }
  };

  // طباعة الاستمارة
  const handlePrintPreview = async () => {
    if (!previewHtml) return;
    if (platform.file.printHtml) {
      await platform.file.printHtml(previewHtml);
    } else {
      window.print();
    }
  };

  // حفظ استمارة HTML محلياً
  const handleDownloadPreview = async () => {
    if (!previewHtml) return;
    const filename = `${previewTitle.replace(/[/\\?%*:|"<>]/g, '_')}.html`;
    await platform.file.saveFile(filename, previewHtml, 'text/html;charset=utf-8');
    setFeedback({ type: 'success', message: `تم حفظ الاستمارة باسم ${filename}` });
  };

  // رفع فاتورة
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !invoiceModalReq) return;

    setInvoiceUploading(true);
    try {
      const res = await registryService.uploadInvoice(invoiceModalReq.id, file, file.name);
      if (res.success) {
        setInvoiceModalReq(null);
        setFeedback({ type: 'success', message: `تم رفع وتوثيق الفاتورة للطلب ${invoiceModalReq.code}.` });
        loadData();
      } else {
        setFeedback({ type: 'error', message: res.error || 'فشل رفع الفاتورة' });
      }
    } finally {
      setInvoiceUploading(false);
    }
  };

  // ألوان شارات الحالة
  const getStatusBadge = (status: RequestStatus, note?: string | null) => {
    switch (status) {
      case 'executed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>تم التنفيذ</span>
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200" title={note || ''}>
            <Clock className="w-3 h-3" />
            <span>تريث</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200" title={note || ''}>
            <AlertCircle className="w-3 h-3" />
            <span>مرفوض</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <X className="w-3 h-3" />
            <span>ملغى</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" />
            <span>قيد الانتظار</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* الترويسة وأزرار الإجراءات الرئيسية */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F4C5C] text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">سجل الشراء المحلي</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إدارة ومتابعة طلبات الشراء، تعديل الحالات، تصدير السجل، والأرشفة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition shadow-xs cursor-pointer"
            title="تصدير السجل كاملاً إلى مصنف Excel مطابق للملف الأصلي (17 عموداً)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>تصدير Excel (17 عموداً)</span>
          </button>

          <Link
            to="/new-request"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0c3c49] rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>طلب جديد</span>
          </Link>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* رسالة التنبيه والإشعارات */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* بطاقات الإحصاءات الموجزة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium">عدد الطلبات المعروضة</span>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{requests.length} طلب</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium">إجمالي القيمة التقديرية</span>
          <div className="text-lg font-bold text-teal-800 mt-0.5">{formatMoney(totalAmountSum, true)}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium">قيد الانتظار</span>
          <div className="text-lg font-bold text-blue-700 mt-0.5">
            {requests.filter((r) => r.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium">تحتاج مراجعة (فروقات قديمة)</span>
          <div className="text-lg font-bold text-amber-700 mt-0.5">{reviewCount}</div>
        </div>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالرمز، أو الجهة، أو مقدم الطلب، أو اسم أي مادة..."
              className="w-full ps-9 pe-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-teal-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700"
              title="من تاريخ"
            />
            <span className="text-xs text-slate-400">—</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700"
              title="إلى تاريخ"
            />

            <button
              type="submit"
              className="px-3.5 py-2 bg-[#0F4C5C] text-white rounded-lg text-xs font-semibold hover:bg-[#0c3c49] transition cursor-pointer"
            >
              بحث
            </button>
          </div>
        </form>

        {/* شريط تصنيفات الحالة */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-slate-400 text-[11px] font-medium me-1">الحالة:</span>
            {(['all', 'pending', 'executed', 'on_hold', 'rejected', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#0F4C5C] text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'all' ? 'كافة الحالات' : STATUS_ARABIC_LABELS[st]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={needsReviewOnly}
                onChange={(e) => setNeedsReviewOnly(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-600 rounded-sm focus:ring-teal-500"
              />
              <span className="text-amber-800 font-medium">طلبات تحتاج مراجعة فقط</span>
            </label>
          </div>
        </div>
      </div>

      {/* جدول السجل الرئيسي */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-3 border-[#0F4C5C] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs">جاري تحميل سجل الشراء المحلي...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold">لا توجد طلبات تطابق معايير البحث والفلترة.</p>
            <p className="text-xs text-slate-400">جرّب تغيير فلاتر التاريخ أو الحالة أو تنظيف شريط البحث.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50/80 text-slate-600 font-bold">
                <tr>
                  <th className="w-8 py-3 px-3 text-center">#</th>
                  <th className="py-3 px-3">ترميز الطلب</th>
                  <th className="py-3 px-3">تاريخ الطلب</th>
                  <th className="py-3 px-3">الجهة ومقدم الطلب</th>
                  <th className="py-3 px-3">القسم ومكان التسليم</th>
                  <th className="py-3 px-3 text-center">المواد</th>
                  <th className="py-3 px-3 text-left">الإجمالي التقديري</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  <th className="py-3 px-3 text-center w-36">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {requests.map((req, index) => {
                  const isExpanded = expandedRowId === req.id;
                  const formattedDate = formatDateDDMMYYYY(req.request_date) || req.request_date;

                  return (
                    <React.Fragment key={req.id}>
                      <tr
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isExpanded ? 'bg-slate-50/90' : ''
                        } ${req.needs_review ? 'bg-amber-50/30' : ''}`}
                      >
                        {/* زر التوسيع والتسلسل */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => toggleRow(req.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer"
                            title={isExpanded ? 'طي المواد' : 'عرض المواد'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-teal-700" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>

                        {/* رمز الطلب وشارة المراجعة */}
                        <td className="py-3 px-3 font-semibold text-slate-900 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span>{req.code}</span>
                            {req.needs_review && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-sans cursor-pointer hover:bg-amber-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolveReview(req);
                                }}
                                title="اضغط لإزالة شارة المراجعة بقرار رسمي"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                                <span>مراجعة</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* التاريخ */}
                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* الجهة ومقدم الطلب */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900">{req.entity}</div>
                          <div className="text-[11px] text-slate-500">{req.requester}</div>
                        </td>

                        {/* القسم وعنوان التسليم */}
                        <td className="py-3 px-3">
                          <div className="text-slate-800">{req.department || '—'}</div>
                          <div className="text-[11px] text-slate-400">{req.delivery_place || '—'}</div>
                        </td>

                        {/* عدد المواد */}
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 rounded-md text-xs font-semibold text-slate-700">
                            {req.items.length}
                          </span>
                        </td>

                        {/* الإجمالي */}
                        <td className="py-3 px-3 text-left font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatMoney(req.total_amount || 0, true)}
                        </td>

                        {/* الحالة */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => openStatusModal(req)}
                            className="cursor-pointer hover:opacity-80 transition"
                            title="اضغط لتغيير حالة الطلب وتوثيق السبب"
                          >
                            {getStatusBadge(req.status, req.status_note)}
                          </button>
                        </td>

                        {/* أزرار الإجراءات */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* معاينة/طباعة الاستمارة */}
                            <button
                              onClick={() => handleViewPdf(req)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="معاينة وطباعة استمارة الطلب A4"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* رفع فاتورة */}
                            <button
                              onClick={() => setInvoiceModalReq(req)}
                              className={`p-1.5 rounded-md transition cursor-pointer ${
                                req.invoice_storage_path
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                              title={req.invoice_storage_path ? `فاتورة مرفوعة: ${req.invoice_storage_path}` : 'إرفاق فاتورة الطلب'}
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>

                            {/* تعديل الطلب */}
                            <button
                              onClick={() => openEditModal(req)}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="تعديل بيانات الطلب"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* حذف ناعم */}
                            <button
                              onClick={() => openDeleteModal(req)}
                              className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="حذف ناعم للطلب (deleted_at)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* الصف الممتد لعرض تفاصيل المواد */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-t border-b border-slate-200">
                          <td colSpan={9} className="p-4">
                            <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                <span className="font-bold text-slate-800">
                                  قائمة مواد الطلب ({req.items.length} مواد)
                                </span>
                                {req.status_note && (
                                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                                    ملاحظة الحالة: {req.status_note}
                                  </span>
                                )}
                              </div>

                              <table className="w-full text-right text-xs divide-y divide-slate-100">
                                <thead>
                                  <tr className="text-slate-400 text-[11px]">
                                    <th className="w-8 py-1.5 text-center">السطر</th>
                                    <th className="py-1.5">اسم المادة / الخدمة</th>
                                    <th className="py-1.5">المواصفات الفنية</th>
                                    <th className="py-1.5 text-center">الوحدة</th>
                                    <th className="py-1.5 text-center font-mono">الكمية</th>
                                    <th className="py-1.5 text-left font-mono">السعر التقديري</th>
                                    <th className="py-1.5 text-left font-mono">المجموع</th>
                                    <th className="py-1.5">ملاحظات المادة</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {req.items.map((itm) => (
                                    <tr key={itm.id} className="hover:bg-slate-50/60">
                                      <td className="py-2 text-center font-mono text-slate-400">
                                        {itm.line_no}
                                      </td>
                                      <td className="py-2 font-medium text-slate-900">{itm.name}</td>
                                      <td className="py-2 text-slate-500">{itm.specs || '—'}</td>
                                      <td className="py-2 text-center text-slate-600">{itm.unit || '—'}</td>
                                      <td className="py-2 text-center font-mono font-semibold">
                                        {itm.qty}
                                      </td>
                                      <td className="py-2 text-left font-mono text-slate-600">
                                        {formatMoney(itm.unit_price)}
                                      </td>
                                      <td className="py-2 text-left font-mono font-bold text-teal-800">
                                        {formatMoney(itm.line_total || itm.qty * itm.unit_price)}
                                      </td>
                                      <td className="py-2 text-slate-400 text-[11px]">{itm.notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {req.notes && (
                                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-700">ملاحظات عامة للطلب: </span>
                                  {req.notes}
                                </div>
                              )}
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
        )}
      </div>

      {/* نافذة تغيير حالة الطلب */}
      {statusModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                تغيير حالة الطلب: {statusModalReq.code}
              </h3>
              <button
                onClick={() => setStatusModalReq(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statusError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{statusError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الحالة الجديدة
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as RequestStatus)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                >
                  <option value="pending">قيد الانتظار (pending)</option>
                  <option value="executed">تم التنفيذ (executed)</option>
                  <option value="on_hold">تريث (on_hold) — يلزم سبب</option>
                  <option value="rejected">مرفوض (rejected) — يلزم سبب</option>
                  <option value="cancelled">ملغى (cancelled)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  سبب أو بيان الحالة {(newStatus === 'rejected' || newStatus === 'on_hold') && (
                    <span className="text-rose-600 font-bold">* (إلزامي)</span>
                  )}
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder={
                    newStatus === 'rejected' || newStatus === 'on_hold'
                      ? 'يرجى كتابة سبب التريث أو الرفض بالتفصيل...'
                      : 'ملاحظة اختيارية حول تغيير الحالة...'
                  }
                  rows={3}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusModalReq(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleStatusSave}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0c3c49] rounded-xl transition shadow-xs cursor-pointer"
              >
                تأكيد وحفظ التغيير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات الطلب */}
      {editModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                تعديل بيانات الطلب: {editModalReq.code}
              </h3>
              <button
                onClick={() => setEditModalReq(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الجهة الطالبة
                  </label>
                  <input
                    type="text"
                    value={editEntity}
                    onChange={(e) => setEditEntity(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مقدم الطلب
                  </label>
                  <input
                    type="text"
                    value={editRequester}
                    onChange={(e) => setEditRequester(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    القسم الطالب
                  </label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    عنوان التسليم
                  </label>
                  <input
                    type="text"
                    value={editPlace}
                    onChange={(e) => setEditPlace(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  موعد التسليم المتوقع
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ملاحظات الطلب
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                تنبيه: سيتم توثيق هذا التعديل في سجل audit_log مع حفظ لقطة الحالة القديمة والجديدة.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditModalReq(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={handleEditSave}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0c3c49] rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {editSaving ? 'جاري الحفظ...' : 'حفظ وتوثيق التعديل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد الحذف الناعم */}
      {deleteModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تأكيد الحذف الناعم</h3>
                <p className="text-xs text-slate-500">رمز الطلب: {deleteModalReq.code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              وفقاً لدستور المشروع والقرار (د)، سيتم وسم الطلب بحقل <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-700">deleted_at</code> ولن يظهر في السجل أو الإحصائيات، دون حذفه فيزيائياً من قاعدة البيانات.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                سبب الحذف (اختياري)
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="مثال: طلب ملغى بالاتفاق مع الإدارة..."
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModalReq(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs cursor-pointer"
              >
                تأكيد الحذف الناعم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إرفاق الفاتورة */}
      {invoiceModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                إرفاق فاتورة للطلب: {invoiceModalReq.code}
              </h3>
              <button
                onClick={() => setInvoiceModalReq(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {invoiceModalReq.invoice_storage_path && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <span className="font-bold">توجد فاتورة مرفوعة مسبقاً: </span>
                <span className="font-mono">{invoiceModalReq.invoice_storage_path}</span>
              </div>
            )}

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-2 hover:border-teal-500 transition">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <label className="block text-xs font-semibold text-teal-800 hover:underline cursor-pointer">
                <span>اختر ملف الفاتورة (PDF أو صورة)</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleInvoiceUpload}
                  disabled={invoiceUploading}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400">
                سيتم رفع الملف إلى حاوية invoices الآمنة وتحديث invoice_storage_path.
              </p>
            </div>

            {invoiceUploading && (
              <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span>جاري رفع الفاتورة...</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInvoiceModalReq(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة معاينة وطباعة الاستمارة */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-900">{previewTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F4C5C] text-white text-xs font-semibold rounded-lg hover:bg-[#0c3c49] transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة A4</span>
                </button>
                <button
                  onClick={handleDownloadPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>حفظ ملف</span>
                </button>
                <button
                  onClick={() => setPreviewHtml(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-200/60 p-4 overflow-y-auto flex justify-center">
              <div
                className="bg-white shadow-xl max-w-[210mm] w-full p-2"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

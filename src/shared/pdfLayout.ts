/**
 * src/shared/pdfLayout.ts
 * بناء قالب استمارة طلب الشراء مطابقاً حرفياً لملف طلب_اساسي.xlsx
 * - ورق A4 عمودي اتجاه RTL
 * - الصورتان: شعار SPC أعلى اليسار، ترويسة الجمهورية أعلى اليمين
 * - العنوان: Purchase Request / طلب شراء
 * - كتلة الرأس الثنائية اللغة
 * - جدول المواد بـ 8 أعمدة، وصف 55 نقطة، وتثبيت عرض Quantity وتصحيح nots إلى Notes (D8)
 * - سطر الإجمالي الكلي وجدول التواقيع الستة يظهران في الصفحة الأخيرة فقط عند تعدد الصفحات (O2)
 * - دالة paginate(items) بحسب O2 تقسم المواد بمعدل 12 مادة لكل صفحة، وحشو الصفوف الفارغة بلا 0.0 (D13)
 * - خط Sakkal Majalla غامق 28 (24 للمجموع) مع Amiri
 * - تذييل الصفحة: SPC | رقم الصفحة | PR
 */

import { addMoney, multiplyMoney, formatMoney } from './money';
import { formatDateDDMMYYYY } from './dates';

export interface PrItem {
  line_no?: number;
  name: string;
  specs?: string | null;
  unit?: string | null;
  qty: number;
  unit_price: number;
  line_total?: number;
  notes?: string | null;
}

export interface PrRequest {
  code: string;
  request_date: string;
  entity: string;
  requester: string;
  department?: string | null;
  delivery_place?: string | null;
  delivery_date?: string | null;
  currency?: string;
  notes?: string | null;
}

export interface PrSignatories {
  requester?: string;
  warehouse?: string;
  dept_manager?: string;
  supply_manager?: string;
  fields_director?: string;
  procurement?: string;
}

export interface PrSettings {
  signatories?: PrSignatories;
  currency?: { name: string; symbol: string };
}

/**
 * 1. تقسيم المواد إلى صفحات متتابعة (12 مادة كحد أقصى لكل صفحة)
 */
export function paginate<T>(items: T[], pageSize = 12): T[][] {
  if (!items || items.length === 0) {
    return [[]];
  }
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

/**
 * 2. بناء مستند HTML الكامل لطباعة وتصدير استمارة طلب الشراء
 */
export function buildPrDocument(
  request: PrRequest,
  items: PrItem[],
  settings?: PrSettings,
  options?: { assetBaseUrl?: string }
): string {
  const assetBase = options?.assetBaseUrl || 'assets';
  const pages = paginate(items, 12);
  const totalPages = pages.length;

  // حساب الإجمالي العام للطلب
  const grandTotal = items.reduce((acc, itm) => {
    const rowTotal = itm.line_total !== undefined ? itm.line_total : multiplyMoney(itm.qty, itm.unit_price);
    return addMoney(acc, rowTotal);
  }, 0);

  const formattedDate = formatDateDDMMYYYY(request.request_date) || request.request_date;
  const formattedDeliveryDate = request.delivery_date ? (formatDateDDMMYYYY(request.delivery_date) || request.delivery_date) : '';
  const currencyName = request.currency || settings?.currency?.name || 'ليرة سورية جديدة';

  const sigs: PrSignatories = {
    requester: request.requester || settings?.signatories?.requester || '',
    warehouse: settings?.signatories?.warehouse || '',
    dept_manager: settings?.signatories?.dept_manager || 'م. ناصر العوده',
    supply_manager: settings?.signatories?.supply_manager || 'م. ناصر العوده',
    fields_director: settings?.signatories?.fields_director || '',
    procurement: settings?.signatories?.procurement || 'م.م. سامي الفرج'
  };

  const pagesHtml = pages.map((pageItems, pageIdx) => {
    const pageNum = pageIdx + 1;
    const isLastPage = pageNum === totalPages;

    // حشو الصفوف الفارغة حتى 12 صفاً في الصفحة الحالية (D13)
    const paddedRowsCount = 12 - pageItems.length;

    const rowsHtml = pageItems.map((itm, idx) => {
      const globalLineNo = pageIdx * 12 + idx + 1;
      const lineTotal = itm.line_total !== undefined ? itm.line_total : multiplyMoney(itm.qty, itm.unit_price);
      return `
        <tr class="item-row">
          <td class="col-seq text-center">${globalLineNo}</td>
          <td class="col-name">${escapeHtml(itm.name)}</td>
          <td class="col-specs">${escapeHtml(itm.specs || '')}</td>
          <td class="col-unit text-center">${escapeHtml(itm.unit || '')}</td>
          <td class="col-qty text-center font-mono">${itm.qty}</td>
          <td class="col-price text-center font-mono">${formatMoney(itm.unit_price)}</td>
          <td class="col-total text-center font-mono font-bold">${formatMoney(lineTotal)}</td>
          <td class="col-notes">${escapeHtml(itm.notes || '')}</td>
        </tr>
      `;
    }).join('');

    // الصفوف الفارغة المكملة لـ 12 صفاً تترك بلا قيم ودون 0.0 (D13)
    const emptyRowsHtml = Array.from({ length: Math.max(0, paddedRowsCount) }).map(() => `
      <tr class="item-row empty-row">
        <td class="col-seq">&nbsp;</td>
        <td class="col-name">&nbsp;</td>
        <td class="col-specs">&nbsp;</td>
        <td class="col-unit">&nbsp;</td>
        <td class="col-qty">&nbsp;</td>
        <td class="col-price">&nbsp;</td>
        <td class="col-total">&nbsp;</td>
        <td class="col-notes">&nbsp;</td>
      </tr>
    `).join('');

    // سطر المجموع الكلي وجدول التواقيع يظهران فقط في الصفحة الأخيرة (O2)
    const lastPageSections = isLastPage ? `
      <!-- سطر القيمة الكلية للطلب -->
      <table class="pr-total-table" dir="rtl">
        <tr>
          <td class="total-label text-center">PR Total Amount / القيمة الكلّية للطلب</td>
          <td class="total-amount text-center font-mono font-bold">${formatMoney(grandTotal)}</td>
        </tr>
      </table>

      <!-- جدول التواقيع الستة -->
      <table class="pr-signatures-table" dir="rtl">
        <thead>
          <tr class="sig-header">
            <th class="col-sig-staff">Staff / الكادر</th>
            <th class="col-sig-name">Name / الاسم</th>
            <th class="col-sig-date">Signature and date / التوقيع و التاريخ</th>
            <th class="col-sig-notes">Notes / ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="sig-role">Requester / الطالب</td>
            <td class="sig-name">${escapeHtml(sigs.requester || '')}</td>
            <td class="sig-box">&nbsp;</td>
            <td class="sig-box">&nbsp;</td>
          </tr>
          <tr>
            <td class="sig-role">المستودع</td>
            <td class="sig-name">${escapeHtml(sigs.warehouse || '')}</td>
            <td class="sig-box">&nbsp;</td>
            <td class="sig-box">&nbsp;</td>
          </tr>
          <tr>
            <td class="sig-role">مديرالدائرة او مشرف الحقل</td>
            <td class="sig-name font-bold">${escapeHtml(sigs.dept_manager || '')}</td>
            <td class="sig-box">&nbsp;</td>
            <td class="sig-box">&nbsp;</td>
          </tr>
          <tr>
            <td class="sig-role">مدير دائرة الامداد و التوريد</td>
            <td class="sig-name font-bold">${escapeHtml(sigs.supply_manager || '')}</td>
            <td class="sig-box">&nbsp;</td>
            <td class="sig-box">&nbsp;</td>
          </tr>
          <tr>
            <td class="sig-role">مدير حقول ديرالزور</td>
            <td class="sig-name">${escapeHtml(sigs.fields_director || '')}</td>
            <td class="sig-box">&nbsp;</td>
            <td class="sig-box">&nbsp;</td>
          </tr>
          <tr>
            <td class="sig-role">Procurement / المشتريات</td>
            <td class="sig-name font-bold">${escapeHtml(sigs.procurement || '')}</td>
            <td class="sig-box">&nbsp;</td>
            <td class="sig-box">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    ` : '';

    return `
      <section class="sheet a4-page">
        <!-- ترويسة الصفحة (الجمهورية يميناً، الشعار يساراً، والعنوان وسطاً) -->
        <div class="pr-top-banner">
          <div class="sy-header-box">
            <img src="${assetBase}/header-sy.png" alt="الجمهورية العربية السورية" class="img-sy" />
          </div>
          <div class="title-box text-center">
            <h1 class="main-title-en">Purchase Request</h1>
            <h2 class="main-title-ar">طلب شراء</h2>
          </div>
          <div class="spc-logo-box">
            <img src="${assetBase}/spc-logo.png" alt="SPC" class="img-spc" />
          </div>
        </div>

        <!-- كتلة الرأس (ثنائية اللغة) -->
        <table class="pr-header-block" dir="rtl">
          <tr>
            <td class="hdr-label">الجهة الطالبة / the requesting department</td>
            <td class="hdr-val">${escapeHtml(request.entity)}</td>
            <td class="hdr-label-l">PR Date</td>
            <td class="hdr-val-l font-mono">${formattedDate}</td>
          </tr>
          <tr>
            <td class="hdr-label">Requester / مقدم الطلب</td>
            <td class="hdr-val">${escapeHtml(request.requester)}</td>
            <td class="hdr-label-l">تاريخ طلب الشراء</td>
            <td class="hdr-val-l font-mono">${formattedDate}</td>
          </tr>
          <tr>
            <td class="hdr-label">Requester Dep. / القسم الطالب</td>
            <td class="hdr-val">${escapeHtml(request.department || '')}</td>
            <td class="hdr-label-l">PR Code</td>
            <td class="hdr-val-l font-mono font-bold">${escapeHtml(request.code)}</td>
          </tr>
          <tr>
            <td class="hdr-label">Delivery Place / عنوان التسليم</td>
            <td class="hdr-val">${escapeHtml(request.delivery_place || '')}</td>
            <td class="hdr-label-l">رمز طلب الشراء</td>
            <td class="hdr-val-l font-mono font-bold">${escapeHtml(request.code)}</td>
          </tr>
          <tr>
            <td class="hdr-label">Delivery Date / موعد التسليم</td>
            <td class="hdr-val font-mono">${formattedDeliveryDate}</td>
            <td class="hdr-label-l">Currency / العملة</td>
            <td class="hdr-val-l">${escapeHtml(currencyName)}</td>
          </tr>
        </table>

        <!-- جدول المواد (8 أعمدة، ارتفاع الصف 55 نقطة) -->
        <table class="pr-items-table" dir="rtl">
          <thead>
            <tr>
              <th class="col-seq">ت</th>
              <th class="col-name">Item / Service name<br/>اسم المادة / الخدمة</th>
              <th class="col-specs">Technical Specifications<br/>المواصفات الفنّية</th>
              <th class="col-unit">Unit<br/>الوحدة</th>
              <th class="col-qty">Quantity<br/>العدد</th>
              <th class="col-price">Est. Unit Price<br/>السعر التقديري</th>
              <th class="col-total">Total<br/>المجموع</th>
              <th class="col-notes">Notes<br/>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${emptyRowsHtml}
          </tbody>
        </table>

        ${lastPageSections}

        <!-- تذييل الصفحة -->
        <footer class="pr-footer">
          <div class="footer-left">SPC</div>
          <div class="footer-center">صفحة ${pageNum} من ${totalPages}</div>
          <div class="footer-right">PR</div>
        </footer>
      </section>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>استمارة طلب شراء - ${escapeHtml(request.code)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0.75in 0.25in 0.75in 0.25in;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Sakkal Majalla', 'Amiri', 'Traditional Arabic', serif;
      direction: rtl;
    }
    .sheet {
      width: 100%;
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: transparent;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 5mm;
    }
    .sheet:last-of-type {
      page-break-after: avoid;
    }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .font-mono { font-family: 'Courier New', Courier, monospace; }

    /* الترويسة العليا */
    .pr-top-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .sy-header-box img { width: 140px; height: auto; max-height: 55px; }
    .spc-logo-box img { width: 150px; height: auto; max-height: 55px; }
    .title-box { flex: 1; }
    .main-title-en {
      margin: 0;
      font-size: 26pt;
      font-weight: bold;
      line-height: 1.1;
      font-family: Arial, sans-serif;
    }
    .main-title-ar {
      margin: 2px 0 0;
      font-size: 28pt;
      font-weight: bold;
      line-height: 1;
    }

    /* الجداول والحدود */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
      background: transparent;
    }
    td, th {
      border: 1px solid #000000;
      padding: 3px 4px;
      font-size: 15pt;
      font-weight: bold;
      vertical-align: middle;
      background: transparent;
    }
    th {
      border: 1.5px solid #000000;
      font-size: 14pt;
    }

    /* كتلة الرأس */
    .pr-header-block td {
      height: 24pt;
      font-size: 14pt;
    }
    .hdr-label, .hdr-label-l {
      width: 25%;
      font-size: 13pt;
    }
    .hdr-val, .hdr-val-l {
      width: 25%;
    }

    /* جدول المواد */
    .pr-items-table th {
      line-height: 1.1;
      text-align: center;
    }
    .col-seq { width: 4%; }
    .col-name { width: 26%; }
    .col-specs { width: 22%; }
    .col-unit { width: 7%; }
    .col-qty { width: 8%; min-width: 48px; } /* تثبيت عرض Quantity (D8) */
    .col-price { width: 11%; }
    .col-total { width: 11%; font-size: 24pt; } /* 24 لعمود المجموع */
    .col-notes { width: 11%; }

    /* ارتفاع صفوف المواد: 55 نقطة */
    .item-row td {
      height: 55pt;
      max-height: 55pt;
      font-size: 15pt;
    }

    /* سطر القيمة الكلية */
    .pr-total-table td {
      height: 35pt;
    }
    .total-label {
      width: 78%;
      font-size: 20pt;
      font-weight: bold;
    }
    .total-amount {
      width: 22%;
      font-size: 24pt;
      font-weight: bold;
    }

    /* جدول التواقيع */
    .pr-signatures-table th {
      height: 25pt;
      font-size: 14pt;
    }
    .pr-signatures-table td {
      height: 35pt;
      font-size: 14pt;
    }
    .col-sig-staff { width: 28%; }
    .col-sig-name { width: 24%; }
    .col-sig-date { width: 24%; }
    .col-sig-notes { width: 24%; }

    /* التذييل */
    .pr-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11pt;
      font-weight: bold;
      padding-top: 4px;
      margin-top: 4px;
      border-top: 1px solid #666;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

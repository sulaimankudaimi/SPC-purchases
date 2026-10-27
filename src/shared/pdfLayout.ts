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
import { getPrDocumentStyles } from './pdfStyles';
import {
  escapeHtml,
  renderTopBanner,
  renderHeaderBlock,
  renderSignaturesTable
} from './pdfTemplates';

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
  const formattedDeliveryDate = request.delivery_date
    ? formatDateDDMMYYYY(request.delivery_date) || request.delivery_date
    : '';
  const currencyName = request.currency || settings?.currency?.name || 'ليرة سورية جديدة';

  const sigs: PrSignatories = {
    requester: request.requester || settings?.signatories?.requester || '',
    warehouse: settings?.signatories?.warehouse || '',
    dept_manager: settings?.signatories?.dept_manager || 'م. ناصر العوده',
    supply_manager: settings?.signatories?.supply_manager || 'م. ناصر العوده',
    fields_director: settings?.signatories?.fields_director || '',
    procurement: settings?.signatories?.procurement || 'م.م. سامي الفرج'
  };

  const pagesHtml = pages
    .map((pageItems, pageIdx) => {
      const pageNum = pageIdx + 1;
      const isLastPage = pageNum === totalPages;

      // حشو الصفوف الفارغة حتى 12 صفاً في الصفحة الحالية (D13)
      const paddedRowsCount = 12 - pageItems.length;

      const rowsHtml = pageItems
        .map((itm, idx) => {
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
        })
        .join('');

      // الصفوف الفارغة المكملة لـ 12 صفاً تترك بلا قيم ودون 0.0 (D13)
      const emptyRowsHtml = Array.from({ length: Math.max(0, paddedRowsCount) })
        .map(
          () => `
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
    `
        )
        .join('');

      // سطر المجموع الكلي وجدول التواقيع يظهران فقط في الصفحة الأخيرة (O2)
      const lastPageSections = isLastPage ? renderSignaturesTable(sigs, grandTotal) : '';

      return `
      <section class="sheet a4-page">
        <!-- ترويسة الصفحة (الجمهورية يميناً، الشعار يساراً، والعنوان وسطاً) -->
        ${renderTopBanner(assetBase)}

        <!-- كتلة الرأس (ثنائية اللغة) -->
        ${renderHeaderBlock(request, formattedDate, formattedDeliveryDate, currencyName)}

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
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>استمارة طلب شراء - ${escapeHtml(request.code)}</title>
  <style>
${getPrDocumentStyles()}
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

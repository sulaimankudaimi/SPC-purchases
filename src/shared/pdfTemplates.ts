/**
 * src/shared/pdfTemplates.ts
 * قوالب أجزاء HTML لترويسة وجدول التواقيع لاستمارة طلب الشراء (D8 و O2)
 */

import type { PrSignatories, PrRequest } from './pdfLayout';
import { formatMoney } from './money';

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTopBanner(assetBase: string): string {
  return `
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
  `;
}

export function renderHeaderBlock(
  request: PrRequest,
  formattedDate: string,
  formattedDeliveryDate: string,
  currencyName: string
): string {
  return `
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
  `;
}

export function renderSignaturesTable(sigs: PrSignatories, grandTotal: number): string {
  return `
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
  `;
}

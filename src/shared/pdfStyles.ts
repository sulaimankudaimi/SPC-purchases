/**
 * src/shared/pdfStyles.ts
 * تنسيقات وأنماط CSS لمستند PDF وقالب طباعة استمارة طلب الشراء
 * يتضمن @font-face لخط Amiri المدمج كـ Data URI (قرار D7 و D16 و F7.3)
 */

import { amiriFontDataUri } from './amiriFont';

export function getPrDocumentStyles(): string {
  return `
    @font-face {
      font-family: 'Amiri';
      src: url('${amiriFontDataUri}') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'Sakkal Majalla';
      src: local('Sakkal Majalla'), local('SakkalMajalla');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'Sakkal Majalla';
      src: local('Sakkal Majalla Bold'), local('SakkalMajalla-Bold');
      font-weight: bold;
      font-style: normal;
    }

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
    .col-qty { width: 8%; min-width: 48px; }
    .col-price { width: 11%; }
    .col-total { width: 11%; font-size: 24pt; }
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
  `;
}

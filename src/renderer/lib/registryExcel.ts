/**
 * src/renderer/lib/registryExcel.ts
 * بناء وتصدير سجل الشراء المحلي إلى Excel (17 عموداً A–Q مع دمج الخلايا الرأسية)
 * يلتزم حرفياً بمواصفات SPEC §1.5
 */

import * as XLSX from 'xlsx';
import { RegistryRequest } from './registryTypes';
import { STATUS_ARABIC_LABELS } from '../../shared/schema';
import { formatDateDDMMYYYY } from '../../shared/dates';

export function createRegistryWorksheet(requests: RegistryRequest[]): XLSX.WorkSheet {
  const headers = [
    'ت',
    'ترميز طلب الشراء',
    'تاريخ الطلب',
    'الجهة الطالبة',
    'مقدم الطلب',
    'القسم الطالب',
    'عنوان التسليم',
    'اسم المادة / الخدمة',
    'المواصفات الفنية',
    'وحدة القياس',
    'العدد / الكمية',
    'السعر التقديري',
    'الإجمالي',
    'ملاحظات',
    'حالة الطلب',
    'ملف الطلب',
    'ملف الفاتورة والطلب'
  ];

  const row1 = ['سجل الشراء المحلي'];
  const row2 = headers;
  const dataRows: any[][] = [row1, row2];
  const merges: XLSX.Range[] = [];

  let currentRowIdx = 2; // الصف 3 في Excel
  let requestSeq = 1;

  for (const req of requests) {
    const items =
      req.items && req.items.length > 0
        ? req.items
        : [
            {
              id: '',
              request_id: req.id,
              line_no: 1,
              name: '',
              specs: '',
              unit: '',
              qty: 0,
              unit_price: 0,
              line_total: 0,
              notes: ''
            }
          ];

    const itemCount = items.length;
    const startRow = currentRowIdx;
    const endRow = currentRowIdx + itemCount - 1;

    const dateFormatted = formatDateDDMMYYYY(req.request_date) || req.request_date;
    const statusText = req.status_note
      ? `${STATUS_ARABIC_LABELS[req.status] || req.status} (${req.status_note})`
      : STATUS_ARABIC_LABELS[req.status] || req.status;

    for (let i = 0; i < itemCount; i++) {
      const itm = items[i];
      const isFirstItemOfRequest = i === 0;

      const rowData = [
        isFirstItemOfRequest ? requestSeq : '',
        isFirstItemOfRequest ? req.code : '',
        isFirstItemOfRequest ? dateFormatted : '',
        isFirstItemOfRequest ? req.entity : '',
        isFirstItemOfRequest ? req.requester : '',
        isFirstItemOfRequest ? req.department || '' : '',
        isFirstItemOfRequest ? req.delivery_place || '' : '',
        itm.name || '',
        itm.specs || '',
        itm.unit || '',
        itm.qty || 0,
        itm.unit_price || 0,
        itm.line_total !== undefined ? itm.line_total : itm.qty * itm.unit_price,
        itm.notes || '',
        isFirstItemOfRequest ? statusText : '',
        isFirstItemOfRequest ? req.pdf_local_path || req.pdf_storage_path || '' : '',
        isFirstItemOfRequest ? req.invoice_storage_path || '' : ''
      ];

      dataRows.push(rowData);
    }

    if (itemCount > 1) {
      const mergedCols = [0, 1, 2, 3, 4, 5, 6, 14, 15, 16];
      for (const colIdx of mergedCols) {
        merges.push({
          s: { r: startRow, c: colIdx },
          e: { r: endRow, c: colIdx }
        });
      }
    }

    currentRowIdx += itemCount;
    requestSeq++;
  }

  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 4.6 },
    { wch: 19.2 },
    { wch: 14.7 },
    { wch: 23.6 },
    { wch: 14.5 },
    { wch: 18.7 },
    { wch: 13.7 },
    { wch: 22.0 },
    { wch: 33.9 },
    { wch: 14.0 },
    { wch: 14.8 },
    { wch: 16.2 },
    { wch: 11.3 },
    { wch: 19.9 },
    { wch: 14.9 },
    { wch: 24.6 },
    { wch: 20.8 }
  ];
  ws['!views'] = [{ rightToLeft: true }];
  return ws;
}

export function exportRegistryToExcel(requests: RegistryRequest[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = createRegistryWorksheet(requests);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

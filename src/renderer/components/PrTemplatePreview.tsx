/**
 * src/renderer/components/PrTemplatePreview.tsx
 * معاينة حية لقالب استمارة طلب الشراء المطابق لـ Excel (المرحلة 6)
 * تعرض القالب ببيانات تجريبية مع إمكانية التبديل بين صفحة واحدة ومتعدد الصفحات
 */

import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  Eye, 
  FileCheck, 
  Layers 
} from 'lucide-react';
import { buildPrDocument, PrRequest, PrItem } from '../../shared/pdfLayout';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { platform } from '../lib/platform';

export default function PrTemplatePreview() {
  const [mode, setMode] = useState<'single' | 'multi'>('single');

  // طلب نموذجي
  const sampleRequest: PrRequest = {
    code: 'spc 23-10-26 (1)',
    request_date: '2026-10-23',
    entity: 'دائرة الإنتاج',
    requester: 'م. ناصر العوده',
    department: 'قسم المستودعات',
    delivery_place: 'مستودعات دير الزور المركزية',
    delivery_date: '2026-11-05',
    currency: 'ليرة سورية جديدة'
  };

  // مواد نموذجية
  const sampleItems: PrItem[] = useMemo(() => {
    if (mode === 'single') {
      return [
        { line_no: 1, name: 'صمام أمان كروي 2 إنش', specs: 'ستانلس ستيل 316 ضغط 600', unit: 'عدد', qty: 4, unit_price: 700, notes: 'عاجل للموقع' },
        { line_no: 2, name: 'طقم جوانات تفلون حرارية', specs: 'مقاوم للمواد الكيميائية', unit: 'طقم', qty: 2, unit_price: 350, notes: '' },
        { line_no: 3, name: 'براغي تثبيت صلب عالي المتانة', specs: 'قياس M16 طول 80 مم', unit: 'عدد', qty: 20, unit_price: 15, notes: '' }
      ];
    } else {
      // 15 مادة لاختبار تعدد الصفحات (O2)
      return Array.from({ length: 15 }, (_, i) => ({
        line_no: i + 1,
        name: `مادة فنية رقم ${i + 1}`,
        specs: `مواصفات قياسية معتمدة رقم ${i + 1}`,
        unit: i % 2 === 0 ? 'عدد' : 'قطعة',
        qty: (i + 1) * 3,
        unit_price: 120 + i * 10,
        notes: i === 14 ? 'آخر مادة في الطلب' : ''
      }));
    }
  }, [mode]);

  const htmlDoc = useMemo(() => {
    return buildPrDocument(sampleRequest, sampleItems, DEFAULT_SETTINGS);
  }, [sampleRequest, sampleItems]);

  const handlePrint = async () => {
    if (platform.file.printHtml) {
      await platform.file.printHtml(htmlDoc);
    }
  };

  const handleExportHtml = async () => {
    if (platform.file.exportPrHtml) {
      await platform.file.exportPrHtml(sampleRequest.code, htmlDoc);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm" dir="rtl">
      {/* شريط التحكم في المعاينة */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-[#0F4C5C]">
          <Eye className="w-5 h-5" />
          <h3 className="text-base font-bold text-slate-900">معاينة استمارة طلب الشراء المعتمدة (PR Sheet)</h3>
        </div>

        <div className="flex items-center gap-3">
          {/* تبديل الوضع: صفحة واحدة / متعدد */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                mode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              صفحة واحدة (3 مواد)
            </button>
            <button
              type="button"
              onClick={() => setMode('multi')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                mode === 'multi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              صفحات متتابعة (15 مادة)
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة القالب</span>
          </button>

          <button
            type="button"
            onClick={handleExportHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير HTML</span>
          </button>
        </div>
      </div>

      {/* تنبيه المطابقة */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          قالب مطابق للاستمارة: حدود رفيعة، صف 55pt، تصحيح nots إلى Notes، والشعاران والترويسة، وخط Sakkal Majalla/Amiri.
        </span>
      </div>

      {/* إطار عرض القالب المطبوع بدقة A4 */}
      <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-100 p-4">
        <div className="max-w-[820px] mx-auto bg-white shadow-md border border-slate-300 rounded-sm overflow-hidden">
          <iframe
            srcDoc={htmlDoc}
            title="PR Form Preview"
            className="w-full border-0"
            style={{ height: mode === 'single' ? '920px' : '1500px' }}
          />
        </div>
      </div>
    </div>
  );
}

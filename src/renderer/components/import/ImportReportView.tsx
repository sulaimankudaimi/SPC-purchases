/**
 * src/renderer/components/import/ImportReportView.tsx
 * عرض تفاصيل تقرير الاستيراد: الوحدات، المقترحات، تعارضات الرموز، والصفوف المرفوضة
 */

import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { ImportResult } from '../../../../scripts/import-core';

interface ImportReportViewProps {
  importResult: ImportResult;
}

export const ImportReportView: React.FC<ImportReportViewProps> = ({ importResult }) => {
  const { lookups, report } = importResult;
  const { rejectedRows, conflicts, nameSuggestions } = report;

  return (
    <div className="space-y-6">
      {/* شبكة القوائم المستخرجة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* الوحدات */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 mb-2">الوحدات المستخرجة ({lookups.units.length}):</h3>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {lookups.units.map((u: string) => (
              <span key={u} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                {u}
              </span>
            ))}
          </div>
        </div>

        {/* الجهات */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 mb-2">الجهات الطالبة ({lookups.entities.length}):</h3>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {lookups.entities.map((e: string) => (
              <span key={e} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                {e}
              </span>
            ))}
          </div>
        </div>

        {/* مقدمو الطلبات */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 mb-2">مقدمو الطلبات ({lookups.requesters.length}):</h3>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {lookups.requesters.map((r: string) => (
              <span key={r} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* اقتراحات دمج الأسماء */}
      {(nameSuggestions.entities.length > 0 || nameSuggestions.requesters.length > 0) && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span>اقتراحات دمج الأسماء المتشابهة (Q4: للعرض فقط دون دمج تلقائي):</span>
          </div>
          <div className="space-y-1 text-xs text-amber-900 font-mono">
            {nameSuggestions.entities.map((s: string, idx: number) => (
              <div key={idx} className="bg-amber-100/60 p-2 rounded">
                جهة: {s}
              </div>
            ))}
            {nameSuggestions.requesters.map((s: string, idx: number) => (
              <div key={idx} className="bg-amber-100/60 p-2 rounded">
                طالب: {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* تعارضات الرموز */}
      {conflicts.length > 0 && (
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-2">
            <AlertCircle className="w-4 h-4" />
            <span>تعارضات رموز الطلبات:</span>
          </div>
          <div className="space-y-1 text-xs text-rose-900 font-mono">
            {conflicts.map((c: string, idx: number) => (
              <div key={idx} className="bg-rose-100/60 p-2 rounded">
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الصفوف المرفوضة أو المستبعدة */}
      {rejectedRows.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-800 mb-2">الصفوف المستبعدة أثناء القراءة:</h3>
          <div className="space-y-1 text-xs text-slate-600 font-mono">
            {rejectedRows.map((r: { rowNum: number; reason: string }, idx: number) => (
              <div key={idx} className="bg-white p-2 rounded border border-slate-200">
                سطر {r.rowNum}: {r.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

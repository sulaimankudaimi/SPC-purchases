/**
 * src/renderer/components/import/ImportReferenceMatch.tsx
 * لوحة مطابقة الأرقام المرجعية للسجل المستورد (المرحلة 4 و F4)
 */

import React from 'react';
import { Scale, CheckCircle2, XCircle } from 'lucide-react';

export interface ReferenceCheckItem {
  id: string;
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
}

interface ImportReferenceMatchProps {
  checks: ReferenceCheckItem[];
  allPassed: boolean;
  dateMismatches?: string[];
}

export const ImportReferenceMatch: React.FC<ImportReferenceMatchProps> = ({ checks, allPassed, dateMismatches }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-700" />
          <h2 className="text-sm font-bold text-slate-800">لوحة مطابقة الأرقام المرجعية (Gold Standard Benchmark)</h2>
        </div>
        <div>
          {allPassed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>مطابقة كاملة بنسبة 100% (ALL PASS)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>يوجد عدم تطابق في الأرقام (FAIL)</span>
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 font-semibold">المؤشر / الخاصية المرجعية</th>
              <th className="py-2.5 px-4 font-semibold">القيمة المرجعية الذهبية (المتوقعة)</th>
              <th className="py-2.5 px-4 font-semibold">القيمة الناتجة من الملف</th>
              <th className="py-2.5 px-4 font-semibold text-center w-24">النتيجة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {checks.map((c) => (
              <tr key={c.id} className={c.pass ? 'hover:bg-slate-50' : 'bg-rose-50/60 hover:bg-rose-50'}>
                <td className="py-2.5 px-4 font-sans font-medium text-slate-800">{c.label}</td>
                <td className="py-2.5 px-4 text-slate-600">{c.expected}</td>
                <td className="py-2.5 px-4 font-bold text-slate-900">{c.actual}</td>
                <td className="py-2.5 px-4 text-center">
                  {c.pass ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      PASS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                      FAIL
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

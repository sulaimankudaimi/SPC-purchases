/**
 * src/renderer/pages/Register.tsx
 * شاشة سجل الشراء المحلي (هيكل فارغ مخصص للمرحلة 7)
 */

import React from 'react';
import { FileSpreadsheet, Clock } from 'lucide-react';

export default function Register() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">سجل الشراء المحلي</h2>
          <p className="text-xs text-slate-500 mt-1">
            عرض وتصفية طلبات الشراء والبحث الموسع وتصدير السجل إلى Excel
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs font-medium">
          <Clock className="w-3.5 h-3.5" />
          <span>مرحلة قادمة (المرحلة 7)</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">هيكل شاشة السجل جاهز</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          وفقاً لقواعد وثيقة CLAUDE.md وخطة العمل، سيتم بناء جدول السجل والفلاتر وتوسيع صفوف المواد وتصدير ملف Excel المتطابق في المرحلة 7.
        </p>
      </div>
    </div>
  );
}

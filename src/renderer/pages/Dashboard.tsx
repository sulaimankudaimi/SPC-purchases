/**
 * src/renderer/pages/Dashboard.tsx
 * شاشة لوحة التحكم (هيكل فارغ مخصص للمرحلة 8)
 */

import React from 'react';
import { LayoutDashboard, Clock } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">لوحة التحكم والمؤشرات</h2>
          <p className="text-xs text-slate-500 mt-1">
            إحصائيات المشتريات المحلية وحالات الطلبات وقيم الإنفاق
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs font-medium">
          <Clock className="w-3.5 h-3.5" />
          <span>مرحلة قادمة (المرحلة 8)</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">هيكل شاشة لوحة التحكم جاهز</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          وفقاً لقواعد وثيقة CLAUDE.md وخطة المشروع، سيتم بناء بطاقات المؤشرات والرسوم البيانية التفاعلية (Recharts) في المرحلة 8 دون كتابة منطق مسبق.
        </p>
      </div>
    </div>
  );
}

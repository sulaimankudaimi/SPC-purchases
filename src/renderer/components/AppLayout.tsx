/**
 * src/renderer/components/AppLayout.tsx
 * الهيكل العام للتطبيق مع الشريط الجانبي والتنقل RTL
 * يتضمن قائمة الروابط وبطاقة المستخدم «مدير المشتريات» وزر تسجيل الخروج (D17)
 */

import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FilePlus2, 
  FileSpreadsheet, 
  Settings, 
  Terminal, 
  LogOut, 
  UserCheck,
  Clock
} from 'lucide-react';
import { signOut } from '../lib/auth';
import { requestService } from '../lib/requestService';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const checkCount = () => {
      requestService.getPendingCount().then((count) => {
        if (mounted) setPendingCount(count);
      });
    };

    checkCount();
    const interval = setInterval(checkCount, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
    { to: '/new-request', label: 'طلب جديد', icon: FilePlus2, badge: pendingCount },
    { to: '/register', label: 'السجل', icon: FileSpreadsheet },
    { to: '/settings', label: 'الإعدادات', icon: Settings },
    { to: '/selftest', label: 'الفحص الذاتي', icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans" dir="rtl">
      {/* 1. الشريط الجانبي الأيمن RTL */}
      <aside className="w-64 bg-slate-900 text-slate-200 border-e border-slate-800 flex flex-col shrink-0 select-none">
        {/* ترويسة الشريط والشعار */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0F4C5C] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            SPC
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">منظومة المشتريات</h1>
            <p className="text-xs text-slate-400">حقول دير الزور</p>
          </div>
        </div>

        {/* قائمة الروابط الرئيسية */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#0F4C5C] text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {Boolean(item.badge && item.badge > 0) && (
                  <span
                    title={`${item.badge} طلبات بانتظار المزامنة في الصندوق الصادر`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>{item.badge}</span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* بطاقة المستخدم أسفل الشريط الجانبي (وفق القرار D17) */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-900/60 text-teal-300 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">مدير المشتريات</p>
                <p className="text-[11px] text-emerald-400 font-medium truncate">جلسة نشطة</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. منطقة المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>الجمهورية العربية السورية</span>
            <span>•</span>
            <span>الشركة السورية للبترول</span>
            <span>•</span>
            <span className="font-medium text-slate-700">دائرة الإمداد والتوريد</span>
          </div>

          <div className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-mono">
            SPC-DZR-PURCHASE
          </div>
        </header>

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

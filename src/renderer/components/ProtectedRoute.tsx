/**
 * src/renderer/components/ProtectedRoute.tsx
 * حارس المسارات المعتمد على دالة requireSession النقية
 * يعيد توجيه المستخدم غير الموثق إلى صفحة تسجيل الدخول #/login
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { requireSession, getCurrentSession, onAuthStateChange } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    // التحقق من الجلسة الحالية
    getCurrentSession().then((session) => {
      if (mounted) {
        setIsAuthenticated(requireSession(session));
      }
    });

    // الاشتراك في تحديثات الجلسة
    const subscription = onAuthStateChange((session) => {
      if (mounted) {
        setIsAuthenticated(requireSession(session));
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">جاري التحقق من الجلسة...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

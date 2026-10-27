/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './renderer/pages/Login';
import Dashboard from './renderer/pages/Dashboard';
import NewRequest from './renderer/pages/NewRequest';
import Register from './renderer/pages/Register';
import Settings from './renderer/pages/Settings';
import SelfTest from './renderer/pages/SelfTest';
import ImportTool from './renderer/tools/ImportTool';
import RestoreTool from './renderer/tools/Restore';
import AppLayout from './renderer/components/AppLayout';
import ProtectedRoute from './renderer/components/ProtectedRoute';
import { startAutoSync } from './renderer/lib/requestService';

// التحقق من وضع التطوير أو أعلام أدوات التطوير لاستبعاد مسارات الفحص في حزمة الإنتاج
const isDevToolsEnabled = import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true';

export default function App() {
  useEffect(() => {
    const stopAutoSync = startAutoSync();
    return () => {
      stopAutoSync();
    };
  }, []);

  return (
    <HashRouter>
      <Routes>
        {/* صفحة تسجيل الدخول */}
        <Route path="/login" element={<Login />} />

        {/* لوحة الفحص الذاتي وأدوات الاستيراد والاستعادة (متاحة في وضع التطوير فقط ومستبعدة في حزمة الإنتاج النهائية) */}
        {isDevToolsEnabled ? (
          <>
            <Route path="/selftest" element={<SelfTest />} />
            <Route path="/tools/import" element={<ImportTool />} />
            <Route path="/tools/restore" element={<RestoreTool />} />
          </>
        ) : null}

        {/* المسارات المحمية مع الهيكل والتنقل RTL */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/new-request"
          element={
            <ProtectedRoute>
              <AppLayout>
                <NewRequest />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/register"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Register />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* أي مسار غير معرّف يعود للرئيسية */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

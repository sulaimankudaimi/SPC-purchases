/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './renderer/pages/Login';
import Dashboard from './renderer/pages/Dashboard';
import NewRequest from './renderer/pages/NewRequest';
import Register from './renderer/pages/Register';
import Settings from './renderer/pages/Settings';
import SelfTest from './renderer/pages/SelfTest';
import ImportTool from './renderer/tools/ImportTool';
import AppLayout from './renderer/components/AppLayout';
import ProtectedRoute from './renderer/components/ProtectedRoute';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* صفحة تسجيل الدخول */}
        <Route path="/login" element={<Login />} />

        {/* لوحة الفحص الذاتي (مفتوحة دائماً للمعاينة وفحص البوابة) */}
        <Route path="/selftest" element={<SelfTest />} />

        {/* أداة استيراد السجل القديم (المرحلة 7) */}
        <Route path="/tools/import" element={<ImportTool />} />

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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SubjectPage from './pages/SubjectPage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';
import SearchPage from './pages/SearchPage';
import ExportPage from './pages/ExportPage';
import PracticePage from './pages/PracticePage';
import SearchHotkey from './components/SearchHotkey';
import NotFound from './pages/NotFound';
import { ToastProvider } from './components/Toast';
import RequireAuth from './components/RequireAuth';
import { initTheme } from './lib/theme';
import { initInstall } from './lib/install';
import './styles.css';

initTheme();
initInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <SearchHotkey />
          <Routes>
            <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
            <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
            <Route path="/subjects/:slug" element={<RequireAuth><SubjectPage /></RequireAuth>} />
            <Route path="/subjects/:slug/export" element={<RequireAuth><ExportPage /></RequireAuth>} />
            <Route path="/subjects/:slug/practice" element={<RequireAuth><PracticePage /></RequireAuth>} />
            <Route path="*" element={<RequireAuth><NotFound /></RequireAuth>} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Home from './pages/Home';
import Login from './pages/Login';
import SubjectPage from './pages/SubjectPage';
import CalendarPage from './pages/CalendarPage';
import NotFound from './pages/NotFound';
import { ToastProvider } from './components/Toast';
import RequireAuth from './components/RequireAuth';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
            <Route path="/subjects/:slug" element={<RequireAuth><SubjectPage /></RequireAuth>} />
            <Route path="*" element={<RequireAuth><NotFound /></RequireAuth>} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);

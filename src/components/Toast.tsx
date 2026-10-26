import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import Icon from './Icon';

type Kind = 'success' | 'error';
type ToastItem = { id: number; message: string; kind: Kind };

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

  const show = useCallback((message: string, kind: Kind = 'success') => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-2), { id, message, kind }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 2500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={t.kind === 'error' ? 'x' : 'check'} size={16} />
            <span>{t.message}</span>
            {t.kind === 'error' && (
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  texto: string;
  tipo?: 'sucesso' | 'erro' | 'info';
}

let toastListeners: Array<(msg: ToastMessage) => void> = [];

export function showToast(texto: string, tipo: 'sucesso' | 'erro' | 'info' = 'sucesso') {
  const msg: ToastMessage = {
    id: String(Date.now() + Math.random()),
    texto,
    tipo,
  };
  toastListeners.forEach((fn) => fn(msg));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 3500);
    };

    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item toast-${t.tipo || 'sucesso'}`}>
          <div className="toast-icon">
            {t.tipo === 'erro' ? '✕' : t.tipo === 'info' ? 'ℹ' : '✓'}
          </div>
          <div className="toast-text">{t.texto}</div>
        </div>
      ))}
    </div>
  );
}

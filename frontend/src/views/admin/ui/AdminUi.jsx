import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AdminUiContext = createContext(null);

/** notify(message, 'success' | 'error') et confirm({ title, message, confirmLabel, danger }) → Promise<boolean>. */
export const useAdminUi = () => useContext(AdminUiContext);

function ConfirmDialog({ dialog, onAnswer }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onAnswer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return (
    <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onAnswer(false); }}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
        <h2 id="admin-modal-title">{dialog.title}</h2>
        {dialog.message && <p>{dialog.message}</p>}
        <div className="modal-actions">
          <button type="button" ref={cancelRef} className="btn btn-outline-secondary" onClick={() => onAnswer(false)}>
            Annuler
          </button>
          <button type="button" className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onAnswer(true)}>
            {dialog.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminUiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const counter = useRef(0);

  const notify = useCallback((message, type = 'success') => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), type === 'error' ? 6500 : 2600);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), []);

  const answer = useCallback((value) => {
    setDialog((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <AdminUiContext.Provider value={value}>
      {children}
      <div className="admin-toast-host" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`admin-toast ${toast.type === 'error' ? 'is-error' : ''}`}>{toast.message}</div>
        ))}
      </div>
      {dialog && <ConfirmDialog dialog={dialog} onAnswer={answer} />}
    </AdminUiContext.Provider>
  );
}

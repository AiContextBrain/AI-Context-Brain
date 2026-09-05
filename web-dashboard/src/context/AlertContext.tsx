import React, { createContext, useContext, useState, useCallback } from 'react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertMessage {
  id: string;
  message: string;
  type: AlertType;
  description?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType, description?: string) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  removeAlert: (id: string) => void;
  alerts: AlertMessage[];
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmRequest | null>(null);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const showAlert = useCallback((message: string, type: AlertType = 'info', description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setAlerts(prev => [...prev, { id, message, type, description }]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      removeAlert(id);
    }, 5000);
  }, [removeAlert]);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmation({ ...options, resolve });
    });
  }, []);

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    const current = confirmation;
    setConfirmation(null);
    current?.resolve(confirmed);
  }, [confirmation]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, removeAlert, alerts }}>
      {children}
      <AlertContainer alerts={alerts} removeAlert={removeAlert} />
      {confirmation && (
        <ConfirmDialog
          options={confirmation}
          onCancel={() => resolveConfirmation(false)}
          onConfirm={() => resolveConfirmation(true)}
        />
      )}
    </AlertContext.Provider>
  );
}

function ConfirmDialog({
  options,
  onCancel,
  onConfirm
}: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(3, 5, 10, 0.76)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="global-confirm-title"
        aria-describedby="global-confirm-message"
        style={{
          width: 'min(440px, 100%)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.10)',
          background: '#0d0f1a',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)'
        }}
      >
        <h2 id="global-confirm-title" style={{ margin: 0, color: '#fff', fontSize: '17px', fontWeight: 800 }}>
          {options.title}
        </h2>
        <p id="global-confirm-message" style={{ margin: '10px 0 0', color: '#9aa2ba', fontSize: '13px', lineHeight: 1.65 }}>
          {options.message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button type="button" onClick={onCancel} className="btn-secondary px-4 py-2 text-xs font-bold">
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-bold text-white"
            style={{
              borderRadius: '6px',
              border: options.danger ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(79,124,255,0.45)',
              background: options.danger ? '#b91c1c' : '#315eea',
              cursor: 'pointer'
            }}
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

function AlertContainer({ alerts, removeAlert }: { alerts: AlertMessage[]; removeAlert: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '400px',
      width: 'calc(100% - 48px)',
      pointerEvents: 'none'
    }}>
      {alerts.map(alert => (
        <AlertToast key={alert.id} alert={alert} onClose={() => removeAlert(alert.id)} />
      ))}
    </div>
  );
}

function AlertToast({ alert, onClose }: { alert: AlertMessage; onClose: () => void }) {
  const getColors = () => {
    switch (alert.type) {
      case 'success':
        return {
          border: 'rgba(16, 185, 129, 0.2)',
          bg: 'rgba(6, 78, 59, 0.95)',
          text: '#a7f3d0',
          accent: '#10b981',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )
        };
      case 'error':
        return {
          border: 'rgba(239, 68, 68, 0.2)',
          bg: 'rgba(127, 29, 29, 0.95)',
          text: '#fca5a5',
          accent: '#ef4444',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )
        };
      case 'warning':
        return {
          border: 'rgba(245, 158, 11, 0.2)',
          bg: 'rgba(120, 53, 4, 0.95)',
          text: '#fde68a',
          accent: '#f59e0b',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )
        };
      case 'info':
      default:
        return {
          border: 'rgba(59, 130, 246, 0.2)',
          bg: 'rgba(30, 58, 138, 0.95)',
          text: '#bfdbfe',
          accent: '#3b82f6',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className="alert-toast-animation"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg,
        backdropFilter: 'blur(12px)',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* Accent strip */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '4px',
        backgroundColor: colors.accent
      }} />

      {/* Icon */}
      <div style={{ color: colors.accent, display: 'flex', alignItems: 'center', marginTop: '2px', paddingLeft: '4px' }}>
        {colors.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '20px' }}>
        <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>
          {alert.message}
        </div>
        {alert.description && (
          <div style={{ fontSize: '12px', color: colors.text, lineHeight: '16px' }}>
            {alert.description}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.5)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'all 0.2s',
          position: 'absolute',
          top: '12px',
          right: '12px',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ffffff';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

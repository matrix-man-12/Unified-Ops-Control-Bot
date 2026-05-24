import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function GlobalToastContainer({ toasts = [], onCloseToast }) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '360px',
      maxWidth: '90%'
    }}>
      {toasts.map((t) => {
        let icon = <Info size={16} style={{ color: 'var(--color-info)' }} />;
        let border = '1px solid rgba(139, 123, 102, 0.15)';
        let bg = 'rgba(255, 255, 255, 0.98)';
        let shadow = '0 10px 30px -10px rgba(139, 123, 102, 0.15)';

        if (t.type === 'success') {
          icon = <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />;
          border = '1.5px solid rgba(13, 148, 136, 0.25)';
          bg = 'rgba(240, 253, 250, 0.98)';
          shadow = '0 10px 30px -10px rgba(13, 148, 136, 0.15)';
        } else if (t.type === 'error') {
          icon = <AlertCircle size={16} style={{ color: 'var(--color-error)' }} />;
          border = '1.5px solid rgba(225, 29, 72, 0.25)';
          bg = 'rgba(255, 241, 242, 0.98)';
          shadow = '0 10px 30px -10px rgba(225, 29, 72, 0.15)';
        } else if (t.type === 'warning') {
          icon = <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />;
          border = '1.5px solid rgba(217, 119, 6, 0.25)';
          bg = 'rgba(254, 252, 232, 0.98)';
          shadow = '0 10px 30px -10px rgba(217, 119, 6, 0.15)';
        } else if (t.type === 'info') {
          icon = <Info size={16} style={{ color: '#0284c7' }} />;
          border = '1.5px solid rgba(2, 132, 199, 0.2)';
          bg = 'rgba(240, 249, 255, 0.98)';
          shadow = '0 10px 30px -10px rgba(2, 132, 199, 0.1)';
        }

        return (
          <div 
            key={t.id}
            className="animate-fade-in"
            style={{
              background: bg,
              border: border,
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: `${shadow}, 0 4px 12px rgba(0,0,0,0.02)`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ marginTop: '2px', flexShrink: 0 }}>
              {icon}
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', pr: '16px' }}>
              <span style={{ 
                fontSize: '12.5px', 
                color: 'var(--text-primary)', 
                fontWeight: '600',
                lineHeight: '1.4',
                wordBreak: 'break-word'
              }}>
                {t.message}
              </span>
            </div>

            <button 
              onClick={() => onCloseToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px'
              }}
              className="hover-accent"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

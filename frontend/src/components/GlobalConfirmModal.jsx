import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export default function GlobalConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(42, 40, 37, 0.4)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      animation: 'fadeIn 0.2s ease forwards'
    }}>
      <div 
        className="glass-panel pulse-glowing animate-fade-in"
        style={{
          width: '420px',
          maxWidth: '90%',
          padding: '28px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-neon-active)',
          boxShadow: 'var(--shadow-neon), 0 20px 48px rgba(139, 123, 102, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(168, 95, 26, 0.1)',
            border: '1px solid rgba(168, 95, 26, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {title?.toLowerCase().includes('delete') || title?.toLowerCase().includes('remove') ? (
              <AlertTriangle size={20} style={{ color: 'var(--color-accent)' }} />
            ) : (
              <HelpCircle size={20} style={{ color: 'var(--color-primary)' }} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-header)' }}>
              {title || 'Confirmation Required'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {message || 'Are you sure you want to proceed with this action?'}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button 
            onClick={onConfirm}
            className="btn-gradient"
            style={{ 
              flex: 1.2, 
              padding: '10px 20px', 
              fontSize: '13px',
              background: title?.toLowerCase().includes('delete') || title?.toLowerCase().includes('remove')
                ? 'linear-gradient(135deg, var(--color-error), #be123c)'
                : 'var(--gradient-brand)',
              boxShadow: title?.toLowerCase().includes('delete') || title?.toLowerCase().includes('remove')
                ? '0 4px 14px rgba(225, 29, 72, 0.2)'
                : '0 4px 14px rgba(168, 95, 26, 0.2)'
            }}
          >
            Confirm
          </button>
          <button 
            onClick={onCancel}
            className="btn-outline"
            style={{ flex: 0.8, padding: '10px 20px', fontSize: '13px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

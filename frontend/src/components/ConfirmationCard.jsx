import React from 'react';
import { ShieldCheck, AlertOctagon, ThumbsUp, XCircle } from 'lucide-react';

export default function ConfirmationCard({ stepId, title, mode, toolName, inputs, message, onApprove, onReject }) {
  const isDestructive = mode !== 'manual'; // manual checks are usually warning, API mutations are critical

  return (
    <div 
      className="glass-panel pulse-glowing" 
      style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        width: '500px', 
        padding: '28px', 
        zIndex: '100', 
        background: 'var(--bg-panel-solid)',
        border: '1px solid var(--border-neon-active)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
        <div style={{ 
          width: '36px', 
          height: '36px', 
          borderRadius: '8px', 
          background: isDestructive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
          border: isDestructive ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexShrink: '0' 
        }}>
          {isDestructive ? (
            <AlertOctagon size={18} style={{ color: 'var(--color-accent)' }} />
          ) : (
            <ShieldCheck size={18} style={{ color: 'var(--color-warning)' }} />
          )}
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-header)', marginBottom: '4px' }}>
            {isDestructive ? 'Security Authorization Check' : 'Manual checklist Verification'}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {isDestructive ? 'A state-modifying action requires explicit operator approval before execution.' : 'Operator confirmation required.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
        {isDestructive ? (
          <>
            <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-neon)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target API Operation</div>
              <div style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--color-secondary)' }}>{toolName}</div>
            </div>
            
            <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-neon)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mapped Request Parameters</div>
              <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(inputs, null, 2)}
              </pre>
            </div>
          </>
        ) : (
          <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245,158,11,0.2)', padding: '16px', borderRadius: '10px', fontSize: '13px', lineHeight: '1.5' }}>
            {message}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={onApprove} 
          className="btn-gradient" 
          style={{ 
            flex: '1.2', 
            background: isDestructive ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--gradient-brand)',
            boxShadow: isDestructive ? '0 4px 14px rgba(16, 185, 129, 0.25)' : '0 4px 14px rgba(124, 58, 237, 0.25)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <ThumbsUp size={14} /> {isDestructive ? 'Authorize & Execute' : 'Mark Completed'}
        </button>
        <button 
          onClick={onReject} 
          className="btn-outline" 
          style={{ flex: '0.8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--color-accent)', borderColor: 'rgba(244,63,94,0.2)' }}
        >
          <XCircle size={14} /> Abort Action
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { ShieldCheck, AlertOctagon, ThumbsUp, XCircle, RefreshCw } from 'lucide-react';

export default function ConfirmationCard({ 
  stepId, 
  title, 
  mode, 
  toolName, 
  inputs, 
  message, 
  onApprove, 
  onReject, 
  inline = false,
  executionMode = "single",
  loopCount = 1,
  parameterList = []
}) {
  const isDestructive = mode !== 'manual';
  const isLoop = executionMode === "loop" && loopCount > 1;

  const containerStyle = inline ? {
    width: '100%',
    padding: '24px',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-neon-active)',
    borderRadius: '16px',
    boxShadow: '0 10px 30px -5px rgba(139, 123, 102, 0.15)',
    overflowY: 'auto',
    maxHeight: '450px'
  } : {
    position: 'absolute', 
    top: '50%', 
    left: '50%', 
    transform: 'translate(-50%, -50%)', 
    width: '560px', 
    padding: '30px', 
    zIndex: '100', 
    background: 'var(--bg-panel-solid)',
    border: '1px solid var(--border-neon-active)',
    borderRadius: '16px'
  };

  return (
    <div className="glass-panel pulse-glowing" style={containerStyle}>
      {/* Gating Header context */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <div style={{ 
          width: '38px', 
          height: '38px', 
          borderRadius: '10px', 
          background: isDestructive ? 'rgba(225, 29, 72, 0.1)' : 'rgba(217, 119, 6, 0.1)', 
          border: isDestructive ? '1px solid rgba(225,29,72,0.2)' : '1px solid rgba(217,119,6,0.2)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexShrink: '0' 
        }}>
          {isDestructive ? (
            <AlertOctagon size={18} style={{ color: 'var(--color-error)' }} />
          ) : (
            <ShieldCheck size={18} style={{ color: 'var(--color-warning)' }} />
          )}
        </div>
        <div>
          <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-header)', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px' }}>
            {isDestructive ? (isLoop ? 'Batch Security Authorization' : 'Security Authorization Check') : 'Manual verification checklist'}
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {isDestructive ? 'A state-modifying action requires explicit operator approval before execution.' : 'Operator confirmation required.'}
          </p>
        </div>
      </div>

      {/* Inputs Gating Details Body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
        {isDestructive ? (
          <>
            <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-neon)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target API Operation</div>
              <div style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {toolName} {isLoop && `(Batch Mode: ${loopCount} Iterations)`}
              </div>
            </div>
            
            {isLoop ? (
              <div 
                className="custom-scrollbar"
                style={{ 
                  background: '#ffffff', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-neon)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch iterations parameter set</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-muted)', width: '30px' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-muted)' }}>Mapped Variables</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(parameterList || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                        <td style={{ padding: '6px 4px', fontWeight: 'bold', color: 'var(--color-secondary)', verticalAlign: 'top' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 4px', color: 'var(--text-primary)' }}>
                          {Object.keys(item).length > 0 ? (
                            Object.entries(item).map(([k, v]) => (
                              <div key={k} style={{ marginBottom: '2px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{k}:</span> <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{String(v)}</span>
                              </div>
                            ))
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>[No custom inputs mapped]</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-neon)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mapped Request Parameters</div>
                <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(inputs, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ background: 'rgba(217, 119, 6, 0.04)', border: '1px dashed rgba(217,119,6,0.15)', padding: '16px', borderRadius: '10px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
            {message}
          </div>
        )}
      </div>

      {/* Gating Actions Panel */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={onApprove} 
          className="btn-gradient" 
          style={{ 
            flex: '1.2', 
            background: isDestructive ? 'linear-gradient(135deg, var(--color-success), #0f766e)' : 'var(--gradient-brand)',
            boxShadow: isDestructive ? '0 4px 14px rgba(13, 148, 136, 0.25)' : '0 4px 14px rgba(168, 95, 26, 0.2)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '6px',
            fontSize: '13px'
          }}
        >
          <ThumbsUp size={14} /> {isDestructive ? (isLoop ? `Authorize Batch Run` : 'Authorize & Execute') : 'Mark Checklist Verification Complete'}
        </button>
        <button 
          onClick={onReject} 
          className="btn-outline" 
          style={{ 
            flex: '0.8', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px', 
            color: 'var(--color-error)', 
            borderColor: 'rgba(225,29,72,0.2)',
            fontSize: '13px'
          }}
        >
          <XCircle size={14} /> Abort Action
        </button>
      </div>
    </div>
  );
}

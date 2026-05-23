import React, { useRef, useEffect } from 'react';
import { Bot, User, Terminal, ListTodo, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

export default function ChatWindow({ messages, statusLogs, plan, currentStepIndex, isConnected }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, statusLogs]);

  return (
    <div style={{ display: 'flex', flex: '1', gap: '20px', overflow: 'hidden', height: '100%' }}>
      {/* 1. Main Chat Messages Panel */}
      <div className="glass-panel" style={{ flex: '1.2', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-neon)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? 'var(--color-success)' : 'var(--color-error)' }} />
            <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-header)' }}>Operations Session Feed</h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>WS Gateway: Active</span>
        </div>

        {/* Scrollable Conversation area */}
        <div style={{ flex: '1', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((m, i) => (
            <div 
              key={i} 
              className="animate-fade-in"
              style={{ 
                display: 'flex', 
                gap: '12px', 
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              {m.sender !== 'user' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                  <Bot size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
              )}
              
              <div 
                style={{ 
                  background: m.sender === 'user' ? 'var(--bg-bubble-user)' : 'var(--bg-bubble-agent)',
                  border: m.sender === 'user' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid var(--border-neon)',
                  color: 'var(--text-primary)',
                  padding: '12px 16px',
                  borderRadius: m.sender === 'user' ? '14px 14px 0 14px' : '0 14px 14px 14px',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}
              >
                {m.text}
              </div>

              {m.sender === 'user' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                  <User size={16} style={{ color: 'var(--color-secondary)' }} />
                </div>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* 2. Side Plan Stepper & Terminal Console */}
      <div style={{ flex: '0.8', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflow: 'hidden' }}>
        
        {/* A. Plan Checklist Tracker */}
        <div className="glass-panel" style={{ flex: '1.1', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-neon)', paddingBottom: '10px', fontFamily: 'var(--font-header)' }}>
            <ListTodo size={16} style={{ color: 'var(--color-primary)' }} />
            Active Execution Plan
          </h3>
          
          <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {plan.map((step, index) => (
              <div 
                key={index} 
                className={`glass-panel animate-fade-in ${index === currentStepIndex ? 'glass-panel-active' : ''}`}
                style={{ 
                  padding: '10px 12px', 
                  fontSize: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  background: index === currentStepIndex ? 'rgba(6, 182, 212, 0.03)' : 'rgba(255,255,255,0.01)',
                  opacity: index > currentStepIndex ? '0.5' : '1'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {step.status === 'completed' && <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />}
                  {step.status === 'failed' && <AlertTriangle size={16} style={{ color: 'var(--color-error)' }} />}
                  {step.status === 'running' && (
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-secondary)', boxShadow: '0 0 8px var(--color-secondary)', animation: 'fadeIn 1s infinite alternate' }} />
                  )}
                  {step.status === 'interrupted' && <HelpCircle size={16} style={{ color: 'var(--color-warning)' }} />}
                  {step.status === 'pending' && (
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px dashed var(--text-muted)' }} />
                  )}
                </div>
                
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: '600' }}>Step {step.step}: {step.id}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{step.description}</span>
                </div>
              </div>
            ))}
            
            {plan.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                Waiting for user instruction to build a plan...
              </div>
            )}
          </div>
        </div>

        {/* B. Terminal Console Logger */}
        <div className="glass-panel" style={{ flex: '0.9', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px', background: '#1c1917', border: '1px solid var(--border-neon)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px', fontFamily: 'var(--font-header)' }}>
            <Terminal size={14} style={{ color: 'var(--color-secondary)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Systems Operator Console</span>
          </div>
          
          <div style={{ flex: '1', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#f5f5f4', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {statusLogs.map((log, index) => (
              <div key={index} style={{ wordBreak: 'break-all', lineHeight: '1.4' }}>
                <span style={{ color: 'var(--color-secondary)' }}>&gt;</span> {log}
              </div>
            ))}
            {statusLogs.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>Console shell awaiting actions...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

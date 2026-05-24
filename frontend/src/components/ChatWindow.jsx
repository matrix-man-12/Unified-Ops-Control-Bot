import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Terminal, ListTodo, AlertTriangle, CheckCircle, HelpCircle, Send, Paperclip, Check, UploadCloud } from 'lucide-react';
import DynamicForm from './DynamicForm';
import ConfirmationCard from './ConfirmationCard';

export default function ChatWindow({ 
  messages, 
  statusLogs, 
  plan, 
  currentStepIndex, 
  isConnected,
  activePortalId,
  onSendChatMessage,
  interruptPayload,
  handleFormSubmit,
  handleHitlResponse,
  onCancelInterrupt,
  onCreateSession
}) {
  const [activeTab, setActiveTab] = useState('chat'); // chat, plan, terminal
  const [chatInput, setChatInput] = useState('');
  const [showAgentMind, setShowAgentMind] = useState(true);
  
  // File upload state
  const [uploadState, setUploadState] = useState('idle'); // idle, uploading, success, error
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadedFilePath, setUploadedFilePath] = useState(null);
  
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll chat feed to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, statusLogs, interruptPayload, activeTab]);

  // Handle local file uploads
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activePortalId) return;

    setUploadState('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setUploadState('success');
        setUploadedFilePath(data.saved_path);
        setUploadedFileName(file.name);
      } else {
        setUploadState('error');
        alert('File upload failed.');
      }
    } catch (err) {
      setUploadState('error');
      alert('Upload error: ' + err.message);
    }
  };

  const clearAttachment = () => {
    setUploadedFileName(null);
    setUploadedFilePath(null);
    setUploadState('idle');
  };

  const onSubmitMessage = (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() && !uploadedFilePath) return;

    onSendChatMessage(chatInput, uploadedFilePath, uploadedFileName);
    
    // Clear composer states
    setChatInput('');
    clearAttachment();
  };

  return (
    <div 
      className="glass-panel" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        overflow: 'hidden', 
        background: 'rgba(253, 251, 247, 0.95)',
        border: '1px solid var(--border-neon)' 
      }}
    >
      
      {/* 1. Dashboard View Tabs Controller Header */}
      <div 
        style={{ 
          padding: '12px 24px', 
          borderBottom: '1px solid var(--border-neon)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          background: 'rgba(255,255,255,0.4)',
          flexShrink: 0,
          gap: '24px'
        }}
      >
        {/* Sleek Segmented Top Nav tabs for Workspace */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(0,0,0,0.02)', 
          border: '1px solid var(--border-neon)', 
          borderRadius: '10px', 
          padding: '3px',
          width: '540px',
          boxSizing: 'border-box',
          flexShrink: 0
        }}>
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              fontSize: '12.5px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              background: activeTab === 'chat' ? 'var(--gradient-brand)' : 'transparent',
              color: activeTab === 'chat' ? '#ffffff' : 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}
            className={activeTab === 'chat' ? '' : 'hover-accent'}
          >
            <span>💬 Operations Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              fontSize: '12.5px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              background: activeTab === 'plan' ? 'var(--gradient-brand)' : 'transparent',
              color: activeTab === 'plan' ? '#ffffff' : 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}
            className={activeTab === 'plan' ? '' : 'hover-accent'}
          >
            <span>📋 Execution Plan</span>
            {plan.length > 0 && (
              <span style={{ fontSize: '10px', background: activeTab === 'plan' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', color: activeTab === 'plan' ? '#fff' : 'var(--text-secondary)', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                {plan.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              fontSize: '12.5px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              background: activeTab === 'terminal' ? 'var(--gradient-brand)' : 'transparent',
              color: activeTab === 'terminal' ? '#ffffff' : 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}
            className={activeTab === 'terminal' ? '' : 'hover-accent'}
          >
            <span>📟 Console </span>
            {isConnected && (
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            )}
          </button>
        </div>

        {/* Server Gateway State & New Chat shortcut Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onCreateSession}
            disabled={!activePortalId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              background: '#ffffff',
              border: '1px solid var(--border-neon)',
              borderRadius: '8px',
              color: activePortalId ? 'var(--color-primary)' : 'var(--text-muted)',
              cursor: activePortalId ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
            className={activePortalId ? "hover-accent" : ""}
            title="Start a fresh chat run"
          >
            <span>➕ New Chat</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? 'var(--color-success)' : 'var(--color-error)', boxShadow: isConnected ? '0 0 6px var(--color-success)' : 'none' }} />
            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
              {isConnected ? 'LIVE GATEWAY' : 'GATEWAY OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Central Active Viewport Content Pane */}
      <div style={{ flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* VIEW 1: Operations Feed & spacious inputs bar (Default Tab) */}
        {activeTab === 'chat' && (
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

            
            {/* Scrollable Conversation Loop */}
            <div style={{ flex: '1', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', background: 'rgba(255,255,255,0.15)' }}>
              {messages.map((m, i) => (
                <div 
                  key={i} 
                  style={{ 
                    display: 'flex', 
                    gap: '14px', 
                    alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%'
                  }}
                >
                  {m.sender !== 'user' && (
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(179, 139, 77, 0.1)', border: '1px solid rgba(179,139,77,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bot size={16} style={{ color: 'var(--color-primary)' }} />
                    </div>
                  )}
                  
                  <div 
                    style={{ 
                      background: m.sender === 'user' ? 'var(--color-primary)' : 'var(--color-bg-paper)',
                      border: '1px solid var(--border-neon)',
                      color: m.sender === 'user' ? '#fff' : 'var(--text-primary)',
                      padding: '12px 16px',
                      borderRadius: m.sender === 'user' ? '14px 14px 0 14px' : '0 14px 14px 14px',
                      fontSize: '13.5px',
                      lineHeight: '1.6',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.01)'
                    }}
                  >
                    {m.text}
                  </div>

                  {m.sender === 'user' && (
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(179, 139, 77, 0.1)', border: '1px solid rgba(179,139,77,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={16} style={{ color: 'var(--color-secondary)' }} />
                    </div>
                  )}
                </div>
              ))}
              {/* Collapsible Chronological Agent Mind Timeline */}
              {statusLogs.length > 0 && isConnected && (
                <div 
                  className="glass-panel"
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignSelf: 'flex-start',
                    width: '100%',
                    maxWidth: '650px',
                    marginTop: '12px',
                    marginBottom: '12px',
                    background: 'rgba(253, 249, 241, 0.75)',
                    border: '1px solid rgba(179, 139, 77, 0.25)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px -2px rgba(179, 139, 77, 0.05)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Header */}
                  <div 
                    onClick={() => setShowAgentMind(!showAgentMind)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      background: 'rgba(179, 139, 77, 0.04)',
                      borderBottom: showAgentMind ? '1px solid rgba(179, 139, 77, 0.15)' : 'none',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="pulse-glowing" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-secondary)' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>
                        ⚡ Agent Mind & Live Execution Process
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                      {showAgentMind ? 'Collapse ▲' : 'Expand Process ▼'}
                    </span>
                  </div>

                  {/* Body Timeline */}
                  {showAgentMind && (
                    <div 
                      className="custom-scrollbar"
                      style={{ 
                        padding: '14px 18px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '10px',
                        maxHeight: '260px',
                        overflowY: 'auto'
                      }}
                    >
                      {statusLogs.map((log, index, arr) => {
                        const isLatest = index === arr.length - 1;
                        return (
                          <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginTop: '4px' }}>
                              {isLatest ? (
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-secondary)', boxShadow: '0 0 6px var(--color-secondary)' }} />
                              ) : (
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(179, 139, 77, 0.4)' }} />
                              )}
                              {index < arr.length - 1 && (
                                <div style={{ width: '1px', height: '24px', background: 'rgba(179, 139, 77, 0.15)', marginTop: '4px' }} />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ 
                                fontSize: '12px', 
                                color: isLatest ? 'var(--text-primary)' : 'var(--text-secondary)', 
                                fontWeight: isLatest ? '600' : '400',
                                lineHeight: '1.4'
                              }}>
                                {log}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              <div ref={scrollRef} />
            </div>

            {/* Inline Dynamic Form overlay tray (above composing box) */}
            {interruptPayload && (
              <div style={{ padding: '16px 24px', background: 'var(--color-bg-light)', borderTop: '1px solid var(--border-neon)', boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.04)' }} className="animate-fade-in">
                {interruptPayload.type === 'form_request' && (
                  <DynamicForm 
                    stepId={interruptPayload.step_id}
                    title={interruptPayload.title}
                    fields={interruptPayload.fields}
                    onSubmit={handleFormSubmit}
                    onCancel={onCancelInterrupt}
                    inline={true}
                    executionMode={interruptPayload.execution_mode}
                    loopCount={interruptPayload.loop_count}
                    parameterList={interruptPayload.parameter_list}
                  />
                )}
                
                {interruptPayload.type === 'hitl_request' && (
                  <ConfirmationCard 
                    stepId={interruptPayload.step_id}
                    title={interruptPayload.title}
                    mode={interruptPayload.mode}
                    toolName={interruptPayload.tool_name}
                    inputs={interruptPayload.inputs}
                    message={interruptPayload.message}
                    onApprove={() => handleHitlResponse(true)}
                    onReject={() => handleHitlResponse(false)}
                    inline={true}
                    executionMode={interruptPayload.execution_mode}
                    loopCount={interruptPayload.loop_count}
                    parameterList={interruptPayload.parameter_list}
                  />
                )}
              </div>
            )}

            {/* Spacious Premium Unified Prompt Bar */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-neon)', background: 'var(--color-bg-paper)', flexShrink: 0 }}>
              <form onSubmit={onSubmitMessage} style={{ width: '100%' }}>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#ffffff',
                  border: '1px solid var(--border-neon)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                  position: 'relative'
                }}>
                  
                  {/* Native Hidden input file attachment */}
                  <input 
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept=".csv,.xlsx,.xls,.json,.png,.jpg,.jpeg,.mp4"
                  />

                  {/* Multiline spacious operational request prompt */}
                  <textarea
                    rows={3}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={activePortalId ? "Explain the task you want to execute (e.g. Create a developer user or verify department)..." : "Please select and connect a Portal profile from the left sidebar configuration panel..."}
                    disabled={!activePortalId}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontSize: '13px',
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--text-primary)',
                      paddingBottom: '36px',
                      lineHeight: '1.5'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSubmitMessage(e);
                      }
                    }}
                  />
                  
                  {/* Unified prompts Action Dock */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '14px',
                    right: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(0,0,0,0.03)',
                    paddingTop: '8px'
                  }}>
                    {/* Left Actions: Attachment button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={!activePortalId || uploadState === 'uploading'}
                        onClick={() => fileInputRef.current.click()}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '500'
                        }}
                        className="hover-accent"
                        title="Upload spreadsheet or media attachments"
                      >
                        <Paperclip size={14} style={{ color: 'var(--color-primary)' }} />
                        <span>
                          {uploadState === 'uploading' ? 'Uploading...' : 'Attach File'}
                        </span>
                      </button>
                      
                      {/* Upload Chip */}
                      {uploadedFileName && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(179,139,77,0.1)',
                          border: '1px solid rgba(179,139,77,0.2)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: 'var(--color-primary)',
                          fontWeight: '500'
                        }}>
                          <span>📎 {uploadedFileName}</span>
                          <span 
                            onClick={clearAttachment} 
                            style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '2px', color: 'var(--color-accent)' }}
                            title="Remove attachment"
                          >×</span>
                        </div>
                      )}
                    </div>

                    {/* Right Actions: Execute submission button */}
                    <button
                      type="submit"
                      disabled={!activePortalId || (!chatInput.trim() && !uploadedFilePath)}
                      className="btn-gradient"
                      style={{
                        padding: '6px 16px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>Execute</span>
                      <Send size={12} />
                    </button>
                  </div>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* VIEW 2: Active Plan Stepper Tab */}
        {activeTab === 'plan' && (
          <div style={{ flex: '1', padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--color-bg-light)' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-neon)', paddingBottom: '12px' }}>
                <ListTodo size={18} />
                Automated Runbook Steps Execution Tracker
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Step-by-step checklist matching Swagger compiled parameters and dynamic Human-in-the-Loop gates.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '800px', width: '100%', marginInline: 'auto', position: 'relative' }}>
              {plan.map((step, index) => (
                <div 
                  key={index} 
                  className={`glass-panel ${index === currentStepIndex ? 'glass-panel-active' : ''}`}
                  style={{ 
                    padding: '16px 20px', 
                    fontSize: '13px', 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '14px',
                    background: index === currentStepIndex ? 'rgba(179, 139, 77, 0.05)' : '#ffffff',
                    border: index === currentStepIndex ? '1.5px solid var(--border-neon-active)' : '1px solid var(--border-neon)',
                    opacity: index > currentStepIndex ? '0.6' : '1',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    {step.status === 'completed' && <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />}
                    {step.status === 'failed' && <AlertTriangle size={18} style={{ color: 'var(--color-error)' }} />}
                    {step.status === 'running' && (
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-secondary)', boxShadow: '0 0 8px var(--color-secondary)' }} />
                    )}
                    {step.status === 'interrupted' && <HelpCircle size={18} style={{ color: 'var(--color-warning)' }} />}
                    {step.status === 'pending' && (
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1.5px dashed var(--text-muted)' }} />
                    )}
                  </div>
                  
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        Step {step.step}: {step.id}
                      </span>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                        {step.action_type}
                      </span>
                      {step.execution_mode === 'loop' && (
                        <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(168, 95, 26, 0.1)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(168,95,26,0.2)' }}>
                          🔄 LOOP MODE ({step.loop_count} Items)
                        </span>
                      )}
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.5' }}>
                      {step.description}
                    </span>
                    
                    {/* Loop Progress Metrics Rendering */}
                    {step.execution_mode === 'loop' && step.status === 'running' && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          <span>Processing Loop Index...</span>
                          <span>{step.current_loop_index + 1} of {step.loop_count} ({Math.round(((step.current_loop_index + 1)/step.loop_count) * 100)}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${((step.current_loop_index + 1)/step.loop_count) * 100}%`, 
                            height: '100%', 
                            background: 'var(--gradient-brand)', 
                            transition: 'width 0.3s ease-in-out',
                            boxShadow: '0 0 8px var(--color-secondary)'
                          }} />
                        </div>
                      </div>
                    )}
                    
                    {/* Loop Completed Metrics Tally Summary */}
                    {step.execution_mode === 'loop' && step.status === 'completed' && step.loop_results && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(13, 148, 136, 0.05)', border: '1px solid rgba(13, 148, 136, 0.15)', padding: '6px 12px', borderRadius: '6px', fontSize: '11.5px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                          ✅ BATCH RESULTS TALLY:
                        </span>
                        <span style={{ color: 'var(--color-success)', fontWeight: '700' }}>
                          {step.loop_results.passed} passed
                        </span>
                        {step.loop_results.failed > 0 && (
                          <span style={{ color: 'var(--color-error)', fontWeight: '700' }}>
                            {step.loop_results.failed} failed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {plan.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--border-neon)', borderRadius: '16px', background: '#fff' }}>
                  <ListTodo size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    Awaiting instructions to construct runbooks. Ask the chatbot to perform actions!
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: Systems Console Logger Tab */}
        {activeTab === 'terminal' && (
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px', background: '#181614' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b38b4d', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px', fontFamily: 'var(--font-header)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
              <Terminal size={15} />
              <span>Real-Time Systems Diagnostics Console Shell</span>
            </div>
            
            <div 
              className="custom-scrollbar"
              style={{ 
                flex: '1', 
                overflowY: 'auto', 
                fontFamily: 'var(--font-mono)', 
                fontSize: '11.5px', 
                color: '#f5f5f4', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px', 
                paddingRight: '6px',
                lineHeight: '1.5'
              }}
            >
              {statusLogs.map((log, index) => (
                <div key={index} style={{ wordBreak: 'break-all' }}>
                  <span style={{ color: '#b38b4d', marginRight: '8px' }}>&gt;</span>
                  {log}
                </div>
              ))}
              
              {statusLogs.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>
                  Awaiting operational node logs...
                </div>
              )}
            </div>
            
          </div>
        )}

      </div>

    </div>
  );
}

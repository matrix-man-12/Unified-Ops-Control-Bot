import React, { useState, useEffect, useRef } from 'react';
import { Bot, Cpu, Send, RefreshCw, Paperclip } from 'lucide-react';
import PortalSelector from './components/PortalSelector';
import ChatWindow from './components/ChatWindow';
import DynamicForm from './components/DynamicForm';
import ConfirmationCard from './components/ConfirmationCard';
import FileUploader from './components/FileUploader';

export default function App() {
  const [activePortalId, setActivePortalId] = useState(null);
  const [modelProvider, setModelProvider] = useState('gemini'); // gemini, openai, agent_builder
  const [session_id, setSessionId] = useState(() => Math.random().toString(36).substring(7));
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // WebSocket connection state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Chat window states
  const [messages, setMessages] = useState([
    { sender: 'agent', text: 'Hello! I am your Unified Portal Agent. Please configure and select a Portal in the left sidebar, and teach me some Swagger and Project Skill runbooks. Once done, ask me to perform operations!' }
  ]);
  const [statusLogs, setStatusLogs] = useState([]);
  const [plan, setPlan] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Interactive overlays
  const [interruptPayload, setInterruptPayload] = useState(null);
  
  // Input fields
  const [chatInput, setChatInput] = useState('');
  const [attachedFilePath, setAttachedFilePath] = useState(null);
  const [attachedFileName, setAttachedFileName] = useState(null);

  // Setup/Switch WebSocket on active portal changes
  useEffect(() => {
    if (!activePortalId) return;

    // Reset session states on portal swap
    const nextSession = Math.random().toString(36).substring(7);
    setSessionId(nextSession);
    setMessages([
      { sender: 'agent', text: `Portal connection established. Initializing automated session. Ready for queries.` }
    ]);
    setPlan([]);
    setCurrentStepIndex(0);
    setStatusLogs([]);
    setInterruptPayload(null);

    // Initialize websocket connection
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/chat`);
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log('WS Connection established');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'logs') {
        setStatusLogs(data.logs);
      } 
      
      else if (data.type === 'interrupt') {
        setInterruptPayload(data.payload);
        setStatusLogs(data.logs);
        if (data.plan) setPlan(data.plan);
        if (data.current_step_index !== undefined) setCurrentStepIndex(data.current_step_index);
      } 
      
      else if (data.type === 'completion') {
        setMessages(prev => [...prev, { sender: 'agent', text: data.message }]);
        setStatusLogs(data.logs);
        if (data.plan) setPlan(data.plan);
        if (data.current_step_index !== undefined) setCurrentStepIndex(data.current_step_index);
        setInterruptPayload(null);
      } 
      
      else if (data.type === 'error') {
        alert('Systems Error: ' + data.message);
        setStatusLogs(prev => [...prev, `ERROR: ${data.message}`]);
      }
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      console.log('WS Connection closed');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [activePortalId]);

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!activePortalId) {
      alert('Please configure and select a Portal in the sidebar first.');
      return;
    }
    if (!chatInput.trim() && !attachedFilePath) return;

    const payload = {
      type: 'chat',
      portal_id: activePortalId,
      text: chatInput,
      session_id: session_id,
      model_provider: modelProvider,
      file_path: attachedFilePath
    };

    // Optimistically update chat layout
    let displayMsg = chatInput;
    if (attachedFileName) {
      displayMsg += ` [Attachment: ${attachedFileName}]`;
    }
    setMessages(prev => [...prev, { sender: 'user', text: displayMsg }]);
    
    socket.send(JSON.stringify(payload));
    
    // Clear inputs
    setChatInput('');
    setAttachedFilePath(null);
    setAttachedFileName(null);
  };

  const handleFormSubmit = (formData) => {
    const payload = {
      type: 'form_submit',
      portal_id: activePortalId,
      session_id: session_id,
      variables: formData,
      model_provider: modelProvider
    };
    socket.send(JSON.stringify(payload));
    setInterruptPayload(null);
  };

  const handleHitlResponse = (approved) => {
    const payload = {
      type: 'hitl_response',
      portal_id: activePortalId,
      session_id: session_id,
      step_id: interruptPayload.step_id,
      approved: approved,
      model_provider: modelProvider
    };
    socket.send(JSON.stringify(payload));
    setInterruptPayload(null);
  };

  const handleFileUpload = (savedPath, name) => {
    setAttachedFilePath(savedPath);
    setAttachedFileName(name);
  };

  return (
    <div className="dashboard-wrapper">
      
      {/* 1. Left Configuration Sidebar */}
      <PortalSelector 
        activePortalId={activePortalId} 
        onSelectPortal={setActivePortalId}
        refreshTrigger={refreshTrigger}
      />

      {/* 2. Main Operational Workspace */}
      <div className="chat-workspace" style={{ position: 'relative' }}>
        
        {/* A. Glowing Operations Header */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em', background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🤖 Unified Operations Bot
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Multi-portal system orchestrator utilizing reactive dynamic tool compilers
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* LLM Provider Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', border: '1px solid var(--border-neon)', borderRadius: '8px' }}>
              <Cpu size={14} style={{ color: 'var(--color-secondary)' }} />
              <select 
                value={modelProvider} 
                onChange={(e) => setModelProvider(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: '500' }}
              >
                <option value="gemini" style={{ background: '#0e0e18', color: '#fff' }}>Gemini 1.5 Flash</option>
                <option value="openai" style={{ background: '#0e0e18', color: '#fff' }}>Local LLM (Ollama)</option>
                <option value="agent_builder" style={{ background: '#0e0e18', color: '#fff' }}>Agent Builder API</option>
              </select>
            </div>

            {/* Refresh Connection */}
            <button 
              onClick={() => setRefreshTrigger(t => t + 1)}
              className="btn-outline" 
              style={{ padding: '8px', borderRadius: '8px' }}
              title="Sync Portal Profiles"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* B. Operational Chat Area (Stepper + History) */}
        <div style={{ flex: '1', overflow: 'hidden', position: 'relative', marginBottom: '20px' }}>
          
          <ChatWindow 
            messages={messages} 
            statusLogs={statusLogs}
            plan={plan}
            currentStepIndex={currentStepIndex}
            isConnected={isConnected}
          />

          {/* C. Dynamic HITL Form Overlay */}
          {interruptPayload && interruptPayload.type === 'form_request' && (
            <>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: '90', borderRadius: '16px', backdropFilter: 'blur(4px)' }} />
              <DynamicForm 
                stepId={interruptPayload.step_id}
                title={interruptPayload.title}
                fields={interruptPayload.fields}
                onSubmit={handleFormSubmit}
                onCancel={() => setInterruptPayload(null)}
              />
            </>
          )}

          {/* D. Dynamic HITL Approval Card Overlay */}
          {interruptPayload && interruptPayload.type === 'hitl_request' && (
            <>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: '90', borderRadius: '16px', backdropFilter: 'blur(4px)' }} />
              <ConfirmationCard 
                stepId={interruptPayload.step_id}
                title={interruptPayload.title}
                mode={interruptPayload.mode}
                toolName={interruptPayload.tool_name}
                inputs={interruptPayload.inputs}
                message={interruptPayload.message}
                onApprove={() => handleHitlResponse(true)}
                onReject={() => handleHitlResponse(false)}
              />
            </>
          )}
        </div>

        {/* E. Composing Dashboard Footer (Input + Drag File) */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <form onSubmit={handleSendMessage} style={{ flex: '1', display: 'flex', gap: '12px' }}>
              <input 
                disabled={!activePortalId}
                className="form-input" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder={activePortalId ? "Explain the task you want to execute (e.g. Create a developer user or verify department)..." : "Please connect and select a portal config from the left sidebar to start..."}
              />
              <button 
                type="submit" 
                disabled={!activePortalId || (!chatInput.trim() && !attachedFilePath)}
                className="btn-gradient" 
                style={{ padding: '0 20px', borderRadius: '10px' }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
          
          {/* File Uploading Tray */}
          {activePortalId && (
            <FileUploader 
              onUploadComplete={handleFileUpload} 
              activePortalId={activePortalId}
            />
          )}
        </div>

      </div>
    </div>
  );
}

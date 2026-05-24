import React, { useState, useEffect, useRef } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import PortalSelector from './components/PortalSelector';
import ChatWindow from './components/ChatWindow';
import SkillStudio from './components/SkillStudio';

export default function App() {
  const [activePortalId, setActivePortalId] = useState(null);
  const [modelProvider, setModelProvider] = useState('gemini'); // gemini, openai, agent_builder
  const [session_id, setSessionId] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Active Workspace View (chat or studio)
  const [activeView, setActiveView] = useState('chat');
  const [studioSkill, setStudioSkill] = useState(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Persistent chat sessions
  const [sessions, setSessions] = useState([]);

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

  const fetchSessions = async (pid) => {
    if (!pid) return [];
    try {
      const res = await fetch(`/api/sessions?portal_id=${pid}`);
      const data = await res.json();
      setSessions(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch sessions', err);
      return [];
    }
  };

  const handleCreateSession = async (customTitle = null) => {
    if (!activePortalId) return;
    const newId = Math.random().toString(36).substring(7);
    const title = customTitle || "New Operations Run";
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          portal_id: activePortalId,
          title: title
        })
      });
      if (res.ok) {
        await fetchSessions(activePortalId);
        setSessionId(newId);
        setPlan([]);
        setCurrentStepIndex(0);
        setStatusLogs([]);
        setInterruptPayload(null);
      }
    } catch (err) {
      console.error('Failed to create session', err);
    }
  };

  const handleDeleteSession = async (sid, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this operational chat run?')) return;
    try {
      const res = await fetch(`/api/sessions/${sid}`, { method: 'DELETE' });
      if (res.ok) {
        const nextSessions = await fetchSessions(activePortalId);
        if (session_id === sid) {
          if (nextSessions && nextSessions.length > 0) {
            setSessionId(nextSessions[0].id);
          } else {
            handleCreateSession("Session initialized");
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  // 1. Fetch sessions when activePortalId changes
  useEffect(() => {
    if (!activePortalId) {
      setSessions([]);
      setSessionId('');
      return;
    }

    fetchSessions(activePortalId).then(list => {
      if (list && list.length > 0) {
        setSessionId(list[0].id);
      } else {
        handleCreateSession("Session initialized");
      }
    });
  }, [activePortalId, refreshTrigger]);

  // 2. Setup/Switch WebSocket on active session ID changes
  useEffect(() => {
    if (!activePortalId || !session_id) return;

    setPlan([]);
    setCurrentStepIndex(0);
    setStatusLogs([]);
    setInterruptPayload(null);

    // Initialize websocket connection
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/chat`);
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log('WS Connection established for session:', session_id);
      
      // Instantly restore past chat messages and step log audits
      ws.send(JSON.stringify({
        type: 'restore',
        portal_id: activePortalId,
        session_id: session_id,
        model_provider: modelProvider
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'restore') {
        setMessages(data.messages || []);
        setStatusLogs(data.logs || []);
        if (data.plan) setPlan(data.plan);
        if (data.current_step_index !== undefined) setCurrentStepIndex(data.current_step_index);
      }
      
      else if (data.type === 'logs') {
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
        
        // Reload list to update chat titles dynamically
        fetchSessions(activePortalId);
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
  }, [activePortalId, session_id]);

  const handleSendChatMessage = (text, filePath, fileName) => {
    if (!activePortalId) {
      alert('Please configure and select a Portal in the sidebar first.');
      return;
    }

    const payload = {
      type: 'chat',
      portal_id: activePortalId,
      text: text,
      session_id: session_id,
      model_provider: modelProvider,
      file_path: filePath
    };

    // Optimistically update chat layout
    let displayMsg = text;
    if (fileName) {
      displayMsg += ` [Attachment: ${fileName}]`;
    }
    setMessages(prev => [...prev, { sender: 'user', text: displayMsg }]);
    
    socket.send(JSON.stringify(payload));
  };

  const handleFormSubmit = (formData, parameterList) => {
    const payload = {
      type: 'form_submit',
      portal_id: activePortalId,
      session_id: session_id,
      variables: formData || {},
      parameter_list: parameterList,
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

  return (
    <div className="dashboard-wrapper">
      
      {/* 1. Left Configuration Sidebar */}
      <PortalSelector 
        activePortalId={activePortalId} 
        onSelectPortal={setActivePortalId}
        refreshTrigger={refreshTrigger}
        onOpenSkillStudio={(skill) => {
          setStudioSkill(skill);
          setActiveView('studio');
        }}
        sessions={sessions}
        activeSessionId={session_id}
        onSelectSession={setSessionId}
        onCreateSession={() => handleCreateSession()}
        onDeleteSession={handleDeleteSession}
      />

      {/* 2. Main Operational Workspace */}
      <div className="chat-workspace" style={{ position: 'relative' }}>
        
        {/* A. Glowing Operations Header */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', marginBottom: '20px', position: 'relative', zIndex: 100 }}>
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
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="btn-outline"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '8px 12px', 
                  fontSize: '12.5px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: '600',
                  borderColor: showModelDropdown ? 'var(--color-secondary)' : 'var(--border-neon)',
                  transition: 'all 0.2s ease',
                  userSelect: 'none'
                }}
              >
                <Cpu size={14} style={{ color: 'var(--color-secondary)' }} />
                <span>{
                  modelProvider === 'gemini' ? 'Gemini 1.5 Flash' :
                  modelProvider === 'openai' ? 'Local LLM (Ollama)' : 'Agent Builder API'
                }</span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginLeft: '4px', transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
              </button>

              {showModelDropdown && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    position: 'absolute', 
                    top: 'calc(100% + 6px)', 
                    right: 0, 
                    zIndex: 999, 
                    width: '180px', 
                    background: '#ffffff', 
                    border: '1px solid var(--border-neon-active)', 
                    borderRadius: '10px', 
                    padding: '6px', 
                    boxShadow: 'var(--shadow-neon), var(--shadow-glow)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    animation: 'fadeIn 0.2s ease forwards'
                  }}
                >
                  <button
                    onClick={() => { setModelProvider('gemini'); setShowModelDropdown(false); }}
                    style={{
                      textAlign: 'left',
                      border: 'none',
                      background: modelProvider === 'gemini' ? 'rgba(179,139,77,0.08)' : 'transparent',
                      color: modelProvider === 'gemini' ? 'var(--color-primary)' : 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: modelProvider === 'gemini' ? '700' : '500',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%'
                    }}
                    className="hover-accent"
                  >
                    Gemini 1.5 Flash
                  </button>
                  <button
                    onClick={() => { setModelProvider('openai'); setShowModelDropdown(false); }}
                    style={{
                      textAlign: 'left',
                      border: 'none',
                      background: modelProvider === 'openai' ? 'rgba(179,139,77,0.08)' : 'transparent',
                      color: modelProvider === 'openai' ? 'var(--color-primary)' : 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: modelProvider === 'openai' ? '700' : '500',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%'
                    }}
                    className="hover-accent"
                  >
                    Local LLM (Ollama)
                  </button>
                  <button
                    onClick={() => { setModelProvider('agent_builder'); setShowModelDropdown(false); }}
                    style={{
                      textAlign: 'left',
                      border: 'none',
                      background: modelProvider === 'agent_builder' ? 'rgba(179,139,77,0.08)' : 'transparent',
                      color: modelProvider === 'agent_builder' ? 'var(--color-primary)' : 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: modelProvider === 'agent_builder' ? '700' : '500',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%'
                    }}
                    className="hover-accent"
                  >
                    Agent Builder API
                  </button>
                </div>
              )}
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

        {activeView === 'studio' ? (
          <SkillStudio 
            portalId={activePortalId}
            skill={studioSkill}
            onClose={() => setActiveView('chat')}
            onSaveSuccess={() => {
              setActiveView('chat');
              setRefreshTrigger(t => t + 1);
            }}
          />
        ) : (
          <div style={{ flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChatWindow 
              messages={messages} 
              statusLogs={statusLogs}
              plan={plan}
              currentStepIndex={currentStepIndex}
              isConnected={isConnected}
              activePortalId={activePortalId}
              onSendChatMessage={handleSendChatMessage}
              interruptPayload={interruptPayload}
              handleFormSubmit={handleFormSubmit}
              handleHitlResponse={handleHitlResponse}
              onCancelInterrupt={() => setInterruptPayload(null)}
              onCreateSession={() => handleCreateSession()}
            />
          </div>
        )}

      </div>
    </div>
  );
}

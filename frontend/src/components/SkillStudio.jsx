import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Save, X, Code, FileCode, CheckCircle, AlertTriangle, HelpCircle, Paperclip } from 'lucide-react';

export default function SkillStudio({ portalId, skill, onClose, onSaveSuccess }) {
  const [yamlContent, setYamlContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationStatus, setValidationStatus] = useState({ valid: true, message: 'Ready' });
  const [skillId, setSkillId] = useState('');
  
  // Custom Modal state
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const showCustomModal = (title, message, type = 'info') => {
    setModal({ show: true, title, message, type });
  };
  
  // File upload state variables
  const [uploadState, setUploadState] = useState('idle'); 
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadedFilePath, setUploadedFilePath] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !portalId) return;

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

  // Initialize editor content
  useEffect(() => {
    if (skill) {
      setYamlContent(skill.yaml_content || '');
      setSkillId(skill.id || '');
      setPrompt('');
    } else {
      // Default template for a new skill
      const defaultTemplate = `# Unified Operations Runbook Skill
id: custom_portal_skill
name: "Custom Portal Operation"
description: "Workflow to perform custom tasks inside the portal"
version: "1.0.0"
steps:
  - step: 1
    id: gather_inputs
    description: "Collect user inputs"
    action_type: "collect_input"
    input_fields:
      - name: "username"
        type: "string"
        required: true
        description: "Name of target user account"
  - step: 2
    id: perform_api_action
    description: "Submit request to portal API"
    action_type: "api_call"
    tool_name: "create_user" # Verify this matches an operationId from your Swagger Spec
    inputs:
      username: "{{username}}"
    requires_approval: true
`;
      setYamlContent(defaultTemplate);
      setSkillId('custom_portal_skill');
      setPrompt('');
    }
    setValidationStatus({ valid: true, message: 'Ready' });
  }, [skill]);

  // Real-time basic validation and extracting Skill ID
  useEffect(() => {
    if (!yamlContent.trim()) return;

    // Extract skill ID
    const idMatch = yamlContent.match(/^id:\s*([^\s\n#]+)/m);
    if (idMatch && idMatch[1]) {
      setSkillId(idMatch[1].trim());
    }

    // Real-time YAML Validator check
    if (yamlContent.includes('\t')) {
      setValidationStatus({
        valid: false,
        message: 'Invalid syntax: Tabs are illegal in YAML.'
      });
      return;
    }

    const lines = yamlContent.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      
      // Skip comments, empty lines
      if (!line || line.startsWith('#')) continue;

      // Extract raw line content (handle list starts)
      let checkLine = line;
      if (line.startsWith('-')) {
        checkLine = line.substring(1).trim();
      }

      if (!checkLine) continue;

      // Verify key-value mapping colon rule
      if (checkLine.includes(':')) {
        const colonIdx = checkLine.indexOf(':');
        const val = checkLine.substring(colonIdx + 1);
        
        // If there's text after the colon, it MUST start with a space!
        if (val && !val.startsWith(' ')) {
          setValidationStatus({
            valid: false,
            message: `Invalid syntax (Line ${idx + 1}): Missing a space after the colon.`
          });
          return;
        }
      }
    }

    setValidationStatus({ valid: true, message: 'YAML syntax looks good.' });
  }, [yamlContent]);

  // Ask LLM Agent to Draft or Refine Skill (NL integration)
  const handleAgentDraftRefine = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/skills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal_id: portalId,
          prompt: prompt,
          model_provider: 'gemini',
          existing_yaml: yamlContent, // Pass current editor content for intelligent refinement!
          file_path: uploadedFilePath // Pass uploaded spec file path!
        })
      });

      if (res.ok) {
        const data = await res.json();
        setYamlContent(data.yaml_draft);
        setPrompt(''); // Clear prompt on successful generation
        clearAttachment(); // Reset rules attachment
        setValidationStatus({ valid: true, message: 'Refinement completed successfully by Skill Builder Agent!' });
      } else {
        const errData = await res.json();
        showCustomModal('Skill Builder Error', errData.detail || 'Failed to refine runbook.', 'error');
      }
    } catch (err) {
      showCustomModal('Network Error', 'Failed to contact Skill Builder Agent: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compile and Save Skill to Database
  const handleSaveSkill = async () => {
    if (!yamlContent.trim()) return;

    setIsProcessing(true);
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const file = new File([blob], `${skillId || 'custom_skill'}.yaml`, { type: 'text/yaml' });

    const formData = new FormData();
    formData.append('portal_id', portalId);
    formData.append('file', file);

    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        showCustomModal('Success', 'Skill compiled and registered successfully!', 'success');
      } else {
        const errorData = await res.json();
        showCustomModal('Validation Error', errorData.detail, 'error');
      }
    } catch (err) {
      showCustomModal('Compilation Failure', 'Failed to register skill: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(253, 251, 247, 0.95)', border: '1px solid var(--border-neon)', borderRadius: '16px', overflow: 'hidden' }}>
      
      {/* Studio Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-neon)', background: 'var(--color-bg-paper)', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode size={20} style={{ color: 'var(--color-secondary)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--color-secondary)' }}>
              {skill ? `Edit Skill: ${skill.name}` : 'Runbook Design Studio'}
            </h2>
            <span style={{ fontSize: '10px', background: 'rgba(179,139,77,0.1)', color: 'var(--color-secondary)', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
              Active ID: {skillId}.yaml
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Draft, refine, and compile automated portal runbooks using LLM agents and manual overrides.
          </p>
        </div>
        
        <button 
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          className="btn-outline"
          title="Back to Operations Chat"
        >
          <X size={18} />
        </button>
      </div>

      {/* Split Workstation Pane */}
      <div style={{ flex: '1', display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        
        {/* LEFT WORKSPACE: Agent Prompt Expanded Workspace (Takes entire left height/space) */}
        <div style={{ flex: '1', borderRight: '1px solid var(--border-neon)', padding: '24px', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-light)', overflowY: 'auto' }}>
          
          <div 
            className="glass-panel" 
            style={{ 
              padding: '24px', 
              background: '#ffffff', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              height: '100%',
              minHeight: '450px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
              <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-header)' }}>
                {skill ? 'Refine Skill with Agent' : 'Generate Runbook from Scratch'}
              </h4>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginTop: '-4px' }}>
              Explain what you want to add, remove, or modify in plain English. The agent will read your prompt alongside the active portal Swagger parameters to compile a valid YAML runbook inside the editor pane.
            </p>

            {/* Expanded Big prompt input section */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea 
                className="form-input"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={skill ? "e.g., 'Add a third step that triggers perform_user_sync and make step 2 require manual approval...'" : "e.g., 'First collect the corporate username, verify if they exist, then call create_user endpoint with HITL confirmation...'"}
                style={{ 
                  flex: 1,
                  fontSize: '13px', 
                  resize: 'none', 
                  background: 'rgba(0,0,0,0.01)', 
                  paddingBottom: '40px', 
                  lineHeight: '1.6',
                  fontFamily: 'var(--font-sans)',
                  border: '1px solid var(--border-neon)'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAgentDraftRefine();
                  }
                }}
              />
              
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
                accept=".csv,.xlsx,.xls,.json,.txt,.yaml,.yml" 
              />
              
              <div style={{ position: 'absolute', bottom: '12px', left: '16px', right: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current.click()} 
                  disabled={uploadState === 'uploading'}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}
                  className="hover-accent"
                  title="Attach Spec or Rules file"
                >
                  <Paperclip size={13} style={{ color: 'var(--color-primary)' }} />
                  <span>{uploadState === 'uploading' ? 'Uploading...' : 'Attach Spec/Rules'}</span>
                </button>
                
                {uploadedFileName && (
                  <span style={{ fontSize: '11px', background: 'rgba(168,95,26,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(168,95,26,0.15)', padding: '3px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', fontWeight: '600' }}>
                    📎 {uploadedFileName.length > 20 ? uploadedFileName.substring(0,17) + '...' : uploadedFileName}
                    <b onClick={clearAttachment} style={{ cursor: 'pointer', color: 'var(--color-accent)', paddingLeft: '4px' }}>×</b>
                  </span>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleAgentDraftRefine}
              disabled={isProcessing || !prompt.trim()}
              className="btn-gradient"
              style={{ padding: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexShrink: 0 }}
            >
              <Sparkles size={15} />
              {isProcessing ? 'Agent is translating specs...' : (skill ? 'Refine Skill YAML' : 'Generate YAML Skill Runbook')}
            </button>
          </div>

        </div>
 
        {/* RIGHT WORKSPACE: YAML Raw Code Editor */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
          
          {/* Editor Header Status Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-neon)', background: 'var(--color-bg-paper)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={14} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                YAML Code Editor
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              {validationStatus.valid ? (
                <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                  <CheckCircle size={12} /> {validationStatus.message}
                </span>
              ) : (
                <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                  <AlertTriangle size={12} /> {validationStatus.message}
                </span>
              )}
            </div>
          </div>
 
          {/* Text Area Code Editor */}
          <textarea 
            className="form-input"
            value={yamlContent}
            onChange={e => setYamlContent(e.target.value)}
            style={{ 
              flex: '1',
              width: '100%',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              lineHeight: '1.6',
              padding: '20px',
              border: 'none',
              background: '#fff',
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none',
              borderRadius: '0'
            }}
            placeholder="# Paste or generate your runbook skill YAML here..."
          />
 
          {/* Compile triggers footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-neon)', background: 'var(--color-bg-paper)', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0 }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-outline" 
              style={{ padding: '10px 20px', fontSize: '12px' }}
            >
              Cancel
            </button>
            
            <button 
              onClick={handleSaveSkill}
              disabled={isProcessing || !validationStatus.valid}
              className="btn-gradient"
              style={{ padding: '10px 24px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={14} />
              {isProcessing ? 'Compiling...' : 'Save & Register Skill'}
            </button>
          </div>
 
        </div>
 
      </div>
 
      {/* Custom alert/validation Modal */}
      {modal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{
            width: '450px',
            maxWidth: '90%',
            background: '#ffffff',
            border: `1px solid ${modal.type === 'error' ? 'var(--color-error)' : modal.type === 'success' ? 'var(--color-success)' : 'var(--border-neon-active)'}`,
            boxShadow: 'var(--shadow-neon), var(--shadow-glow)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {modal.type === 'error' ? (
                <div style={{ padding: '6px', background: 'rgba(225, 29, 72, 0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                  <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
                </div>
              ) : (
                <div style={{ padding: '6px', background: 'rgba(13, 148, 136, 0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                  <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                </div>
              )}
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-header)' }}>
                {modal.title}
              </h3>
            </div>
            
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--text-secondary)', 
              lineHeight: '1.6', 
              maxHeight: '220px', 
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: modal.type === 'error' ? 'var(--font-mono)' : 'var(--font-sans)',
              background: modal.type === 'error' ? 'rgba(0,0,0,0.02)' : 'transparent',
              border: modal.type === 'error' ? '1px solid var(--border-neon)' : 'none',
              borderRadius: modal.type === 'error' ? '8px' : '0',
              padding: modal.type === 'error' ? '12px' : '0'
            }} className="custom-scrollbar">
              {modal.message}
            </div>
 
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button 
                onClick={() => {
                  const savedType = modal.type;
                  setModal({ show: false, title: '', message: '', type: 'info' });
                  if (savedType === 'success') {
                    onSaveSuccess();
                  }
                }}
                className="btn-gradient" 
                style={{ 
                  padding: '8px 20px', 
                  fontSize: '12.5px', 
                  borderRadius: '8px',
                  boxShadow: 'none',
                  background: modal.type === 'error' ? 'var(--color-error)' : 'var(--gradient-brand)'
                }}
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
 
    </div>
  );
}

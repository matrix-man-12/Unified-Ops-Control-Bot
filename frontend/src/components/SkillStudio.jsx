import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Save, X, Code, Eye, FileCode, CheckCircle, AlertTriangle, Play, HelpCircle, Paperclip } from 'lucide-react';

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

  // Initialize editor
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

  // Parse steps for Visual Preview list
  const parseSteps = () => {
    try {
      const steps = [];
      // Safe extraction of steps
      const stepBlocks = yamlContent.split(/-\s+step:\s*/g);
      for (let i = 1; i < stepBlocks.length; i++) {
        const block = stepBlocks[i];
        const stepNumMatch = block.match(/^(\d+)/m);
        const idMatch = block.match(/id:\s*([^\s\n#]+)/m);
        const descMatch = block.match(/description:\s*["']?([^"'\n#]+)["']?/m);
        const actionMatch = block.match(/action_type:\s*([^\s\n#]+)/m);
        const toolMatch = block.match(/tool_name:\s*([^\s\n#]+)/m);
        const approvalMatch = block.match(/requires_approval:\s*([^\s\n#]+)/m);

        steps.push({
          step: stepNumMatch ? stepNumMatch[1] : i,
          id: idMatch ? idMatch[1] : 'unknown',
          description: descMatch ? descMatch[1].trim() : 'No description',
          action_type: actionMatch ? actionMatch[1].trim() : 'api_call',
          tool_name: toolMatch ? toolMatch[1].trim() : null,
          requires_approval: approvalMatch ? approvalMatch[1].trim() === 'true' : false
        });
      }
      return steps;
    } catch (err) {
      return [];
    }
  };

  const stepsList = parseSteps();

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-neon)', background: 'var(--color-bg-paper)' }}>
        <div>
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
      <div style={{ flex: '1', display: 'flex', overflow: 'hidden' }}>
        
        {/* LEFT WORKSPACE: Agent Prompt & Visual Workflow Pipeline */}
        <div style={{ flex: '1.2', borderRight: '1px solid var(--border-neon)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', background: 'var(--color-bg-light)' }}>
          
          {/* Agent Refinement Card */}
          <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.7)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {skill ? 'Refine Skill with Agent' : 'Generate Runbook from Scratch'}
              </h4>
            </div>
            
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-4px' }}>
              Explain what you want to add or modify in plain English. The agent will read your current YAML code below and apply your changes.
            </p>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea 
                className="form-input"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={skill ? "e.g., 'Add a third step that triggers perform_user_sync and make step 2 require manual approval...'" : "e.g., 'First collect the corporate username, verify if they exist, then call create_user endpoint with HITL confirmation...'"}
                style={{ height: '90px', fontSize: '12px', resize: 'none', background: 'rgba(255,255,255,0.9)', paddingBottom: '30px', lineHeight: '1.5' }}
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
              
              <div style={{ position: 'absolute', bottom: '8px', left: '12px', right: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current.click()} 
                  disabled={uploadState === 'uploading'}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}
                  className="hover-accent"
                  title="Attach Spec or Rules file"
                >
                  <Paperclip size={12} style={{ color: 'var(--color-primary)' }} />
                  <span>{uploadState === 'uploading' ? 'Uploading...' : 'Attach Spec/Rules'}</span>
                </button>
                
                {uploadedFileName && (
                  <span style={{ fontSize: '10px', background: 'rgba(179,139,77,0.1)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' }}>
                    📎 {uploadedFileName.length > 15 ? uploadedFileName.substring(0,12) + '...' : uploadedFileName}
                    <b onClick={clearAttachment} style={{ cursor: 'pointer', color: 'var(--color-accent)', paddingLeft: '2px' }}>×</b>
                  </span>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleAgentDraftRefine}
              disabled={isProcessing || !prompt.trim()}
              className="btn-gradient"
              style={{ padding: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}
            >
              <Sparkles size={14} />
              {isProcessing ? 'Agent is thinking...' : (skill ? 'Refine YAML Draft' : 'Draft New Runbook')}
            </button>
          </div>

          {/* Visual Runbook Card Pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Live Runbook Flow Preview
              </h4>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stepsList.length} Steps Found</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '8px', position: 'relative' }}>
              {/* Line linking steps */}
              {stepsList.length > 1 && (
                <div style={{ position: 'absolute', top: '24px', bottom: '24px', left: '26px', width: '2px', background: 'rgba(179,139,77,0.15)', zIndex: 1 }} />
              )}

              {stepsList.map((st, index) => (
                <div 
                  key={st.step} 
                  className="glass-panel animate-fade-in" 
                  style={{ display: 'flex', gap: '12px', padding: '12px 16px', background: '#fff', position: 'relative', zIndex: 2, borderLeft: '4px solid var(--color-primary)' }}
                >
                  {/* Step Number Circle */}
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-bg-paper)', border: '1px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--color-primary)' }}>
                    {st.step}
                  </div>
                  
                  {/* Step Info */}
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{st.id}</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: st.action_type === 'api_call' ? 'rgba(179,139,77,0.1)' : 'rgba(0,0,0,0.03)', color: st.action_type === 'api_call' ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                        {st.action_type}
                      </span>
                      {st.requires_approval && (
                        <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontWeight: '500' }}>
                          🔒 Security HITL
                        </span>
                      )}
                    </div>
                    
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{st.description}</p>
                    
                    {st.action_type === 'api_call' && st.tool_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        <Play size={10} /> Tool operation: <strong style={{ color: 'var(--color-primary)' }}>{st.tool_name}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {stepsList.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border-neon)', borderRadius: '12px', background: 'rgba(0,0,0,0.01)' }}>
                  <HelpCircle size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px auto' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No steps parsed yet. Type or generate YAML code.</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT WORKSPACE: YAML Raw Code Editor */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#faf9f6' }}>
          
          {/* Editor Header Status Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-neon)', background: 'var(--color-bg-paper)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={14} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                YAML Code Editor (Interactive overrides allowed)
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              {validationStatus.valid ? (
                <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={12} /> {validationStatus.message}
                </span>
              ) : (
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
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
              color: '#3f3f3f',
              resize: 'none',
              outline: 'none',
              borderRadius: '0'
            }}
            placeholder="# Paste your runbook skill YAML here..."
          />

          {/* Register compile triggers footer */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-neon)', background: 'var(--color-bg-paper)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
              {isProcessing ? 'Registering...' : 'Compile & Save Runbook'}
            </button>
          </div>

        </div>

      </div>

      {/* Premium custom alert/validation Modal */}
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
                <div style={{ padding: '6px', background: 'rgba(225, 29, 72, 0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
                </div>
              ) : (
                <div style={{ padding: '6px', background: 'rgba(13, 148, 136, 0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

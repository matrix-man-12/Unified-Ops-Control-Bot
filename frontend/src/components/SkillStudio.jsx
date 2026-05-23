import React, { useState, useEffect } from 'react';
import { Sparkles, Save, X, Code, Eye, FileCode, CheckCircle, AlertTriangle, Play, HelpCircle } from 'lucide-react';

export default function SkillStudio({ portalId, skill, onClose, onSaveSuccess }) {
  const [yamlContent, setYamlContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationStatus, setValidationStatus] = useState({ valid: true, message: 'Ready' });
  const [skillId, setSkillId] = useState('');

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

    // Quick lint check
    try {
      // Basic check for tabs which are illegal in YAML
      if (yamlContent.includes('\t')) {
        setValidationStatus({
          valid: false,
          message: 'Syntax Warning: YAML files cannot contain Tab characters. Please use standard spaces instead.'
        });
        return;
      }
      setValidationStatus({ valid: true, message: 'YAML syntax looks good. Ready to register.' });
    } catch (err) {
      setValidationStatus({ valid: false, message: 'Parsing warning: ' + err.message });
    }
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
          existing_yaml: yamlContent // Pass current editor content for intelligent refinement!
        })
      });

      if (res.ok) {
        const data = await res.json();
        setYamlContent(data.yaml_draft);
        setPrompt(''); // Clear prompt on successful generation
        setValidationStatus({ valid: true, message: 'Refinement completed successfully by Skill Builder Agent!' });
      } else {
        const errData = await res.json();
        alert('Skill Builder Agent error: ' + (errData.detail || 'Failed to refine runbook.'));
      }
    } catch (err) {
      alert('Network error when contacting Skill Builder Agent: ' + err.message);
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
        alert('Skill compiled and registered successfully!');
        onSaveSuccess();
      } else {
        const errorData = await res.json();
        alert('Validation error: ' + errorData.detail);
      }
    } catch (err) {
      alert('Failed to register skill: ' + err.message);
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

            <textarea 
              className="form-input"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={skill ? "e.g., 'Add a third step that triggers perform_user_sync and make step 2 require manual approval...'" : "e.g., 'First collect the corporate username, verify if they exist, then call create_user endpoint with HITL confirmation...'"}
              style={{ height: '80px', fontSize: '12px', resize: 'none', background: 'rgba(255,255,255,0.9)' }}
            />
            
            <button 
              onClick={handleAgentDraftRefine}
              disabled={isProcessing || !prompt.trim()}
              className="btn-gradient"
              style={{ padding: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
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

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Key, Link2, FileCode, CheckCircle2, Upload, Sparkles, Edit2, Globe, BookOpen, MessageSquare, ArrowLeft } from 'lucide-react';

export default function PortalSelector({ 
  activePortalId, 
  onSelectPortal, 
  refreshTrigger, 
  onOpenSkillStudio,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession
}) {
  const [portals, setPortals] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [skills, setSkills] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('portals'); // 'portals', 'skills', 'history'
  const [selectedPortalForSpecs, setSelectedPortalForSpecs] = useState(null);
  
  // Add form states
  const [portalId, setPortalId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [headers, setHeaders] = useState([{ key: 'Authorization', value: 'Bearer ' }]);
  const [swaggerDoc, setSwaggerDoc] = useState('');
  
  const [uploadingSkill, setUploadingSkill] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Skill Builder Agent states
  const [showSkillBuilder, setShowSkillBuilder] = useState(false);
  const [skillPrompt, setSkillPrompt] = useState('');
  const [draftingSkill, setDraftingSkill] = useState(false);
  const [yamlDraft, setYamlDraft] = useState('');
  const [generatedSkillId, setGeneratedSkillId] = useState('');

  useEffect(() => {
    fetchPortals();
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedPortalForSpecs) {
      const found = portals.find(p => p.id === selectedPortalForSpecs.id);
      if (found) {
        setSelectedPortalForSpecs(found);
      } else {
        setSelectedPortalForSpecs(null);
      }
    }
  }, [portals]);

  useEffect(() => {
    if (activePortalId) {
      fetchSkills(activePortalId);
    } else {
      setSkills([]);
    }
  }, [activePortalId, refreshTrigger]);

  const fetchPortals = async () => {
    try {
      const res = await fetch('/api/portals');
      const data = await res.json();
      setPortals(data);
      if (data.length > 0 && !activePortalId) {
        onSelectPortal(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load portals list', err);
    }
  };

  const fetchSkills = async (pid) => {
    try {
      const res = await fetch(`/api/skills?portal_id=${pid}`);
      const data = await res.json();
      setSkills(data);
    } catch (err) {
      console.error('Failed to load skills for portal', err);
    }
  };

  const handleHeaderChange = (index, key, val) => {
    const next = [...headers];
    next[index][key] = val;
    setHeaders(next);
  };

  const addHeaderField = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeaderField = (index) => {
    setHeaders(headers.filter((_, idx) => idx !== index));
  };

  const handleSavePortal = async (e) => {
    e.preventDefault();
    if (!portalId || !name || !baseUrl) return;

    // Convert list to dictionary object
    const headersObj = {};
    headers.forEach(h => {
      if (h.key.trim()) {
        headersObj[h.key.trim()] = h.value.trim();
      }
    });

    const payload = {
      id: portalId.trim().toLowerCase().replace(/\s+/g, '-'),
      name: name.trim(),
      base_url: baseUrl.trim(),
      headers: headersObj,
      swagger_doc: swaggerDoc.trim() || null
    };

    try {
      const res = await fetch('/api/portals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddForm(false);
        setIsEditing(false);
        // Reset states
        setPortalId('');
        setName('');
        setBaseUrl('');
        setHeaders([{ key: 'Authorization', value: 'Bearer ' }]);
        setSwaggerDoc('');
        fetchPortals();
      }
    } catch (err) {
      alert('Failed to register portal: ' + err.message);
    }
  };

  const handleDeletePortal = async (pid, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this portal?')) return;
    try {
      const res = await fetch(`/api/portals/${pid}`, { method: 'DELETE' });
      if (res.ok) {
        if (activePortalId === pid) {
          onSelectPortal(null);
        }
        fetchPortals();
      }
    } catch (err) {
      console.error('Delete portal error', err);
    }
  };

  const handleEditPortal = (p, e) => {
    e.stopPropagation();
    setPortalId(p.id);
    setName(p.name);
    setBaseUrl(p.base_url);
    
    // Map headers dictionary back to dynamic key-value list [{key, value}]
    const mappedHeaders = Object.entries(p.headers).map(([key, value]) => ({ key, value }));
    setHeaders(mappedHeaders.length > 0 ? mappedHeaders : [{ key: '', value: '' }]);
    
    setSwaggerDoc(p.swagger_doc || '');
    setIsEditing(true);
    setShowAddForm(true);
  };

  const handleSkillUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activePortalId) return;

    setUploadingSkill(true);
    const formData = new FormData();
    formData.append('portal_id', activePortalId);
    formData.append('file', file);

    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchSkills(activePortalId);
      } else {
        const errorData = await res.json();
        alert('Skill upload error: ' + errorData.detail);
      }
    } catch (err) {
      alert('Failed to upload skill file.');
    } finally {
      setUploadingSkill(false);
    }
  };

  const handleGenerateSkill = async () => {
    if (!skillPrompt.trim() || !activePortalId) return;
    setDraftingSkill(true);
    setYamlDraft('');
    try {
      const res = await fetch('/api/skills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal_id: activePortalId,
          prompt: skillPrompt,
          model_provider: 'gemini'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setYamlDraft(data.yaml_draft);
        
        // Extract a clean unique ID from the drafted yaml if possible
        const idMatch = data.yaml_draft.match(/^id:\s*([^\s\n]+)/m);
        if (idMatch && idMatch[1]) {
          setGeneratedSkillId(idMatch[1].trim());
        } else {
          setGeneratedSkillId(`custom_skill_${Math.random().toString(36).substring(5)}`);
        }
      } else {
        alert('Skill Builder Agent returned an error.');
      }
    } catch (err) {
      alert('Failed to contact Skill Builder Agent.');
    } finally {
      setDraftingSkill(false);
    }
  };

  const handleSaveDraftedSkill = async () => {
    if (!yamlDraft.trim() || !activePortalId) return;
    
    // Create File block directly from string
    const blob = new Blob([yamlDraft], { type: 'text/yaml' });
    const file = new File([blob], `${generatedSkillId || 'skill_runbook'}.yaml`, { type: 'text/yaml' });
    
    setUploadingSkill(true);
    const formData = new FormData();
    formData.append('portal_id', activePortalId);
    formData.append('file', file);

    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setYamlDraft('');
        setSkillPrompt('');
        setShowSkillBuilder(false);
        fetchSkills(activePortalId);
      } else {
        const errorData = await res.json();
        alert('Validation error: ' + errorData.detail);
      }
    } catch (err) {
      alert('Failed to register generated runbook.');
    } finally {
      setUploadingSkill(false);
    }
  };

  return (
    <div className="sidebar-config glass-panel" style={{ gap: '20px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Sleek Segmented Top Nav tabs for Sidebar */}
      <div style={{ 
        display: 'flex', 
        background: 'rgba(255,255,255,0.02)', 
        border: '1px solid var(--border-neon)', 
        borderRadius: '10px', 
        padding: '3px',
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0
      }}>
        <button
          onClick={() => { setShowAddForm(false); setActiveSubTab('portals'); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '7px',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            background: activeSubTab === 'portals' ? 'var(--gradient-brand)' : 'transparent',
            color: activeSubTab === 'portals' ? '#ffffff' : 'var(--text-secondary)'
          }}
          className={activeSubTab === 'portals' ? '' : 'hover-accent'}
        >
          <Globe size={13} />
          <span>Portals</span>
        </button>

        <button
          onClick={() => { setShowAddForm(false); setActiveSubTab('skills'); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '7px',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            background: activeSubTab === 'skills' ? 'var(--gradient-brand)' : 'transparent',
            color: activeSubTab === 'skills' ? '#ffffff' : 'var(--text-secondary)'
          }}
          className={activeSubTab === 'skills' ? '' : 'hover-accent'}
        >
          <BookOpen size={13} />
          <span>Skills</span>
        </button>

        <button
          onClick={() => { setShowAddForm(false); setActiveSubTab('history'); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '7px',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            background: activeSubTab === 'history' ? 'var(--gradient-brand)' : 'transparent',
            color: activeSubTab === 'history' ? '#ffffff' : 'var(--text-secondary)'
          }}
          className={activeSubTab === 'history' ? '' : 'hover-accent'}
        >
          <MessageSquare size={13} />
          <span>History</span>
        </button>
      </div>

      <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }} className="custom-scrollbar">
        
        {/* TAB 1: PORTALS SECTION */}
        {activeSubTab === 'portals' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {showAddForm ? (
              // View 1: Register or Edit Portal Form (takes priority)
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <form onSubmit={handleSavePortal} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-header)', color: 'var(--color-primary)', marginBottom: '4px' }}>
                    {isEditing ? 'Edit Portal Configuration' : 'Register New Portal'}
                  </h4>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Portal Nickname ID (e.g. ops-admin)</label>
                    <input required disabled={isEditing} className="form-input" value={portalId} onChange={e => setPortalId(e.target.value)} placeholder="portal-id" />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Display Title</label>
                    <input required className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Operations Portal" />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Base Target API URL</label>
                    <input required className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8081" />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      Authentication Headers
                      <span onClick={addHeaderField} style={{ color: 'var(--color-secondary)', cursor: 'pointer', fontSize: '10px' }}>+ Add Key</span>
                    </label>
                    {headers.map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                        <input className="form-input" style={{ flex: '1' }} value={h.key} onChange={e => handleHeaderChange(i, 'key', e.target.value)} placeholder="Authorization" />
                        <input className="form-input" style={{ flex: '1.5' }} value={h.value} onChange={e => handleHeaderChange(i, 'value', e.target.value)} placeholder="Bearer token..." />
                        {headers.length > 1 && (
                          <button type="button" onClick={() => removeHeaderField(i)} style={{ background: 'transparent', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: '0 4px' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>OpenAPI Swagger Spec (JSON String)</label>
                    <textarea className="form-input" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '100px', resize: 'vertical' }} value={swaggerDoc} onChange={e => setSwaggerDoc(e.target.value)} placeholder='{ "openapi": "3.0.0", ... }' />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" className="btn-gradient" style={{ flex: '1', padding: '10px', fontSize: '12px' }}>
                      {isEditing ? 'Update Config' : 'Register'}
                    </button>
                    <button type="button" onClick={() => { setShowAddForm(false); setIsEditing(false); }} className="btn-outline" style={{ flex: '1', padding: '10px', fontSize: '12px' }}>Cancel</button>
                  </div>
                </form>
              </div>
            ) : selectedPortalForSpecs ? (
              // View 2: Portal Specifications Inspector (if a portal card is active)
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Premium Breadcrumb Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span 
                    onClick={() => setSelectedPortalForSpecs(null)} 
                    style={{ cursor: 'pointer', color: 'var(--color-primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                    className="hover-accent"
                  >
                    <ArrowLeft size={11} /> Portals
                  </span>
                  <span>&gt;</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {selectedPortalForSpecs.name}
                  </span>
                </div>

                {/* Specs Sheet Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(179,139,77,0.04)', padding: '10px 14px', border: '1px solid var(--border-neon)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px' }}>{selectedPortalForSpecs.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ID: {selectedPortalForSpecs.id}</span>
                  </div>

                  {activePortalId === selectedPortalForSpecs.id ? (
                    <span style={{ fontSize: '10.5px', background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-success)', padding: '3px 8px', borderRadius: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={11} /> Active
                    </span>
                  ) : (
                    <button 
                      onClick={() => onSelectPortal(selectedPortalForSpecs.id)}
                      className="btn-gradient" 
                      style={{ padding: '4px 10px', fontSize: '10.5px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* API Endpoint Specs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                    API Endpoint Specifications
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#ffffff', border: '1px solid var(--border-neon)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Target Base Address</label>
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--color-primary)' }}>{selectedPortalForSpecs.base_url}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '8px' }}>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Active Auth Headers</label>
                      {Object.entries(selectedPortalForSpecs.headers || {}).length > 0 ? (
                        Object.entries(selectedPortalForSpecs.headers).map(([key, val]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'rgba(0,0,0,0.02)', padding: '4px 8px', borderRadius: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{key}:</span>
                            <span style={{ color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }} title={val}>{val}</span>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No custom headers registered</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ingested OpenAPI Specs Parser */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                    Ingested Operations Spec
                  </span>
                  
                  {(() => {
                    const swaggerStr = selectedPortalForSpecs.swagger_doc;
                    if (!swaggerStr) {
                      return (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '12px', border: '1px dashed var(--border-neon)', borderRadius: '10px', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
                          No OpenAPI Specification compiled. The agent will rely on taught Project Skills runbooks.
                        </div>
                      );
                    }
                    try {
                      const spec = JSON.parse(swaggerStr);
                      const paths = spec.paths || {};
                      const endpoints = [];
                      
                      Object.entries(paths).forEach(([path, pathObj]) => {
                        Object.entries(pathObj).forEach(([method, op]) => {
                          if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                            endpoints.push({
                              path,
                              method: method.toUpperCase(),
                              operationId: op.operationId || `${method}_${path}`,
                              summary: op.summary || op.description || ''
                            });
                          }
                        });
                      });

                      if (endpoints.length === 0) {
                        return (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '10px', border: '1px dashed var(--border-neon)', borderRadius: '10px', textAlign: 'center' }}>
                            Zero active endpoints found in uploaded spec.
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                          {endpoints.map((ep, idx) => {
                            let badgeBg = 'rgba(13, 148, 136, 0.08)';
                            let badgeColor = 'var(--color-success)';
                            if (ep.method === 'POST') {
                              badgeBg = 'rgba(168, 95, 26, 0.08)';
                              badgeColor = 'var(--color-primary)';
                            } else if (ep.method === 'DELETE') {
                              badgeBg = 'rgba(225, 29, 72, 0.08)';
                              badgeColor = 'var(--color-error)';
                            } else if (ep.method === 'PUT' || ep.method === 'PATCH') {
                              badgeBg = 'rgba(217, 119, 6, 0.08)';
                              badgeColor = 'var(--color-warning)';
                            }

                            return (
                              <div key={idx} style={{ padding: '6px 10px', background: '#ffffff', border: '1px solid var(--border-neon)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '8px', fontWeight: 'bold', background: badgeBg, color: badgeColor, padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                                    {ep.method}
                                  </span>
                                  <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '210px', color: 'var(--text-primary)' }} title={ep.path}>
                                    {ep.path}
                                  </span>
                                </div>
                                {ep.summary && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={ep.summary}>
                                    {ep.summary}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    } catch (e) {
                      return (
                        <div style={{ fontSize: '11px', color: 'var(--color-error)', padding: '10px', border: '1px dashed var(--color-error)', borderRadius: '10px', background: 'rgba(225, 29, 72, 0.02)' }}>
                          ⚠️ Specifications parse exception: Uploaded OpenAPI spec is not valid JSON.
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Operations buttons */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-neon)', paddingTop: '14px', marginTop: '4px' }}>
                  <button 
                    onClick={(e) => handleEditPortal(selectedPortalForSpecs, e)} 
                    className="btn-outline" 
                    style={{ flex: 1, padding: '8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  
                  <button 
                    onClick={(e) => {
                      const pid = selectedPortalForSpecs.id;
                      handleDeletePortal(pid, e);
                    }} 
                    className="btn-outline" 
                    style={{ flex: 1, padding: '8px', fontSize: '11.5px', borderColor: 'rgba(225, 29, 72, 0.3)', color: 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>

                <button 
                  onClick={() => setSelectedPortalForSpecs(null)}
                  className="btn-outline"
                  style={{ padding: '8px', fontSize: '11.5px', justifyContent: 'center', display: 'flex', gap: '4px' }}
                >
                  Back to List
                </button>

              </div>
            ) : (
              // View 3: Standard Portals List View (default)
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🌐 Control Portals
                  </h3>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setPortalId('');
                      setName('');
                      setBaseUrl('');
                      setHeaders([{ key: 'Authorization', value: 'Bearer ' }]);
                      setSwaggerDoc('');
                      setShowAddForm(true);
                    }}
                    className="btn-outline" 
                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', gap: '4px', borderRadius: '6px' }}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {portals.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => {
                        onSelectPortal(p.id);
                        setSelectedPortalForSpecs(p);
                      }}
                      className={`glass-panel animate-fade-in ${activePortalId === p.id ? 'glass-panel-active' : ''}`}
                      style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: activePortalId === p.id ? '3px solid var(--color-secondary)' : '1px solid var(--border-neon)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '13.5px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{p.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.03)', padding: '1px 6px', borderRadius: '4px' }}>Specs</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        <Link2 size={12} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>{p.base_url}</span>
                      </div>
                      {p.id === activePortalId && (
                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: '8px', marginTop: '2px' }}>
                          <span style={{ fontSize: '10px', background: 'rgba(13, 148, 136, 0.08)', color: 'var(--color-success)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}>
                            <CheckCircle2 size={10} /> Connected
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {portals.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No portals registered. Click 'Add' above.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SKILLS SECTION */}
        {activeSubTab === 'skills' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ Portal Skills
            </h3>

            {!activePortalId ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', border: '1px dashed var(--border-neon)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', display: 'block' }}>
                  No portal connected. Please switch to the **Portals** tab and connect a portal first.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {skills.map(s => (
                    <div key={s.id} className="hover-neon-border" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-neon)', borderRadius: '8px', fontSize: '12px' }}>
                      <FileCode size={14} style={{ color: 'var(--color-primary)' }} />
                      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.id}.yaml</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button 
                          onClick={() => onOpenSkillStudio(s)} 
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                          title="Edit and Refine Skill Runbook"
                        >
                          <Edit2 size={13} className="hover-accent" />
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('Are you sure you want to delete this skill runbook?')) return;
                            try {
                              const res = await fetch(`/api/skills/${s.id}`, { method: 'DELETE' });
                              if (res.ok) {
                                fetchSkills(activePortalId);
                              } else {
                                alert('Failed to delete skill.');
                              }
                            } catch (err) {
                              alert('Error: ' + err.message);
                            }
                          }} 
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                          title="Remove Skill"
                        >
                          <Trash2 size={13} className="hover-accent" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {skills.length === 0 && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', padding: '10px 0' }}>
                      No custom skills taught yet for this portal profile.
                    </span>
                  )}
                </div>

                <label className="btn-outline" style={{ display: 'flex', gap: '6px', cursor: 'pointer', padding: '10px', justifyContent: 'center', fontSize: '12px', borderRadius: '8px' }}>
                  <Upload size={14} />
                  {uploadingSkill ? 'Analyzing...' : 'Teach Portal a Skill (.yaml)'}
                  <input type="file" accept=".yaml,.yml" onChange={handleSkillUpload} style={{ display: 'none' }} />
                </label>

                <div style={{ borderTop: '1px solid var(--border-neon)', paddingTop: '16px', display: 'flex', flexDirection: 'column' }}>
                  <button 
                    onClick={() => onOpenSkillStudio(null)}
                    className="btn-outline animate-glow" 
                    style={{ display: 'flex', gap: '6px', justifyContent: 'center', fontSize: '12px', borderColor: 'rgba(179,139,77,0.4)', background: 'rgba(179,139,77,0.06)', borderRadius: '8px', padding: '10px' }}
                  >
                    <Sparkles size={14} style={{ color: 'var(--color-secondary)' }} />
                    🤖 Ask Agent to Write Runbook
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CHAT HISTORY SECTION */}
        {activeSubTab === 'history' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💬 Chat History
              </h3>
              {activePortalId && (
                <button 
                  onClick={onCreateSession}
                  className="btn-outline"
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '11px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    borderColor: 'rgba(179,139,77,0.4)', 
                    background: 'rgba(179,139,77,0.04)',
                    borderRadius: '6px'
                  }}
                  title="Create a new persistent operations chat session"
                >
                  <Plus size={11} /> New Chat
                </button>
              )}
            </div>

            {!activePortalId ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', border: '1px dashed var(--border-neon)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', display: 'block' }}>
                  No portal connected. Please switch to the **Portals** tab and connect a portal first.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sessions.map(sess => (
                  <div 
                    key={sess.id}
                    onClick={() => onSelectSession(sess.id)}
                    className={`hover-neon-border ${activeSessionId === sess.id ? 'glass-panel-active' : ''}`}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '8px 12px', 
                      background: activeSessionId === sess.id ? 'rgba(179, 139, 77, 0.08)' : 'rgba(255,255,255,0.01)', 
                      border: activeSessionId === sess.id ? '1px solid var(--border-neon-active)' : '1px dashed var(--border-neon)', 
                      borderRadius: '8px', 
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>💬</span>
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ 
                        fontWeight: activeSessionId === sess.id ? '700' : '500', 
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        whiteSpace: 'nowrap',
                        color: activeSessionId === sess.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}>
                        {sess.title}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                        {new Date(sess.created_at).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    
                    <button 
                      onClick={(e) => onDeleteSession(sess.id, e)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      title="Delete Chat Session"
                    >
                      <Trash2 size={13} className="hover-accent" />
                    </button>
                  </div>
                ))}

                {sessions.length === 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', padding: '10px 0' }}>
                    No operations chats yet. Click 'New Chat' above.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Key, Link2, FileCode, CheckCircle2, Upload } from 'lucide-react';

export default function PortalSelector({ activePortalId, onSelectPortal, refreshTrigger }) {
  const [portals, setPortals] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [skills, setSkills] = useState([]);
  
  // Add form states
  const [portalId, setPortalId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [headers, setHeaders] = useState([{ key: 'Authorization', value: 'Bearer ' }]);
  const [swaggerDoc, setSwaggerDoc] = useState('');
  
  const [uploadingSkill, setUploadingSkill] = useState(false);

  useEffect(() => {
    fetchPortals();
  }, [refreshTrigger]);

  useEffect(() => {
    if (activePortalId) {
      fetchSkills(activePortalId);
    } else {
      setSkills([]);
    }
  }, [activePortalId]);

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

  return (
    <div className="sidebar-config glass-panel" style={{ gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-header)' }}>
          <Settings size={20} style={{ color: 'var(--color-secondary)' }} />
          Control Portals
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-outline" 
          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', gap: '4px' }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {showAddForm ? (
        <form onSubmit={handleSavePortal} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Portal Nickname ID (e.g. ops-admin)</label>
            <input required className="form-input" value={portalId} onChange={e => setPortalId(e.target.value)} placeholder="portal-id" />
          </div>
          
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Display Title</label>
            <input required className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Operations Portal" />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Base Target API URL</label>
            <input required className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8081" />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              Authentication Headers
              <span onClick={addHeaderField} style={{ color: 'var(--color-secondary)', cursor: 'pointer', fontSize: '11px' }}>+ Add Key</span>
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
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>OpenAPI Swagger Spec (JSON String)</label>
            <textarea className="form-input" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '100px', resize: 'vertical' }} value={swaggerDoc} onChange={e => setSwaggerDoc(e.target.value)} placeholder='{ "openapi": "3.0.0", ... }' />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button type="submit" className="btn-gradient" style={{ flex: '1', padding: '10px' }}>Register</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-outline" style={{ flex: '1', padding: '10px' }}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {portals.map(p => (
            <div 
              key={p.id} 
              onClick={() => onSelectPortal(p.id)}
              className={`glass-panel animate-fade-in ${activePortalId === p.id ? 'glass-panel-active' : ''}`}
              style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: activePortalId === p.id ? '3px solid var(--color-secondary)' : '1px solid var(--border-neon)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '14px', letterSpacing: '-0.01em' }}>{p.name}</span>
                <button onClick={(e) => handleDeletePortal(p.id, e)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} className="hover:text-red-500">
                  <Trash2 size={13} className="hover-accent" />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                <Link2 size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>{p.base_url}</span>
              </div>
              {p.id === activePortalId && (
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle2 size={10} /> Active Spec
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
      )}

      {activePortalId && (
        <div className="animate-fade-in" style={{ borderTop: '1px solid var(--border-neon)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Uploaded Portal Skills
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {skills.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-neon)', borderRadius: '8px', fontSize: '12px' }}>
                <FileCode size={14} style={{ color: 'var(--color-primary)' }} />
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '500' }}>{s.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.id}.yaml</span>
                </div>
              </div>
            ))}
            
            {skills.length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '4px' }}>No custom workflows taught yet.</span>
            )}
          </div>

          <label className="btn-outline" style={{ display: 'flex', gap: '6px', cursor: 'pointer', padding: '10px', justifyContent: 'center', fontSize: '12px' }}>
            <Upload size={14} />
            {uploadingSkill ? 'Analyzing...' : 'Teach Portal a Skill (.yaml)'}
            <input type="file" accept=".yaml,.yml" onChange={handleSkillUpload} style={{ display: 'none' }} />
          </label>
        </div>
      )}
    </div>
  );
}

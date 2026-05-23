import React, { useState } from 'react';
import { HelpCircle, ChevronRight } from 'lucide-react';

export default function DynamicForm({ stepId, title, fields, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => {
    const initial = {};
    fields.forEach(field => {
      initial[field.name] = field.options ? field.options[0] : '';
    });
    return initial;
  });

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div 
      className="glass-panel pulse-glowing" 
      style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        width: '500px', 
        padding: '28px', 
        zIndex: '100', 
        background: 'var(--bg-panel-solid)',
        border: '1px solid var(--border-neon-active)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
          <HelpCircle size={18} style={{ color: 'var(--color-secondary)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-header)', marginBottom: '4px' }}>Inputs Collection Required</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{title || 'Please fill in the details below to proceed.'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {fields.map((field) => (
            <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', display: 'flex', gap: '4px' }}>
                {field.name}
                {field.required && <span style={{ color: 'var(--color-accent)' }}>*</span>}
              </label>
              
              {field.options ? (
                <select 
                  className="form-input" 
                  value={formData[field.name]} 
                  onChange={(e) => handleChange(field.name, e.target.value)}
                >
                  {field.options.map(opt => (
                    <option key={opt} value={opt} style={{ background: '#0e0e18', color: '#fff' }}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input 
                  required={field.required}
                  type={field.type === 'integer' || field.type === 'number' ? 'number' : 'text'}
                  className="form-input"
                  value={formData[field.name]}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.description || `Enter ${field.name}...`}
                />
              )}
              {field.description && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{field.description}</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button type="submit" className="btn-gradient" style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Submit Details <ChevronRight size={16} />
          </button>
          <button type="button" onClick={onCancel} className="btn-outline" style={{ flex: '0.5' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

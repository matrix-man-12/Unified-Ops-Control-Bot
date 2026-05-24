import React, { useState } from 'react';
import { HelpCircle, ChevronRight, ChevronLeft, Layers, Users } from 'lucide-react';

export default function DynamicForm({ 
  stepId, 
  title, 
  fields, 
  onSubmit, 
  onCancel, 
  inline = false,
  executionMode = "single",
  loopCount = 1,
  parameterList = []
}) {
  const isLoop = executionMode === "loop" && loopCount > 1;

  // 1. Initial State Setup
  const [formData, setFormData] = useState(() => {
    const initial = {};
    fields.forEach(field => {
      initial[field.name] = field.options ? field.options[0] : '';
    });
    return initial;
  });

  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [itemsData, setItemsData] = useState(() => {
    const list = [];
    for (let i = 0; i < loopCount; i++) {
      // Pull pre-extracted values if they exist in parameterList (such as email)
      const existing = (parameterList && parameterList[i]) || {};
      const item = { ...existing };
      fields.forEach(field => {
        if (item[field.name] === undefined) {
          item[field.name] = field.options ? field.options[0] : '';
        }
      });
      list.push(item);
    }
    return list;
  });

  // 2. Field Value Handlers
  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleItemFieldChange = (name, value) => {
    const next = [...itemsData];
    next[activeItemIndex] = { ...next[activeItemIndex], [name]: value };
    setItemsData(next);
  };

  // 3. Submissions Action
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isLoop) {
      onSubmit(null, itemsData);
    } else {
      onSubmit(formData, null);
    }
  };

  const checkItemFilled = (item) => {
    return fields.every(f => !f.required || (item[f.name] !== undefined && item[f.name] !== ''));
  };

  const completedCount = itemsData.filter(checkItemFilled).length;

  const containerStyle = inline ? {
    width: '100%',
    padding: '24px',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-neon-active)',
    borderRadius: '16px',
    boxShadow: '0 10px 30px -5px rgba(139, 123, 102, 0.15)',
    overflowY: 'auto',
    maxHeight: '450px'
  } : {
    position: 'absolute', 
    top: '50%', 
    left: '50%', 
    transform: 'translate(-50%, -50%)', 
    width: '560px', 
    padding: '30px', 
    zIndex: '100', 
    background: 'var(--bg-panel-solid)',
    border: '1px solid var(--border-neon-active)',
    borderRadius: '16px'
  };

  return (
    <div className="glass-panel pulse-glowing" style={containerStyle}>
      {/* Form Header Context */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(179, 139, 77, 0.1)', border: '1px solid rgba(179, 139, 77, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
          {isLoop ? <Users size={18} style={{ color: 'var(--color-primary)' }} /> : <HelpCircle size={18} style={{ color: 'var(--color-primary)' }} />}
        </div>
        <div>
          <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-header)', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px' }}>
            {isLoop ? `Bulk Input Collection Required (${loopCount} Items)` : 'Input Collection Required'}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {isLoop ? `Please specify parameter variables for each item in the batch runbook.` : (title || 'Please fill in the details below to proceed.')}
          </p>
        </div>
      </div>

      {/* Segmented Progress selector for Loop Items */}
      {isLoop && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.04)' }} className="custom-scrollbar">
            {itemsData.map((item, idx) => {
              const isFilled = checkItemFilled(item);
              const isActive = idx === activeItemIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveItemIndex(idx)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--border-neon)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--gradient-brand)' : isFilled ? 'rgba(13, 148, 136, 0.05)' : '#ffffff',
                    color: isActive ? '#ffffff' : isFilled ? 'var(--color-success)' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isFilled ? '✓ ' : ''}Item {idx + 1}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>
            <span>Tally: {completedCount} of {loopCount} items filled</span>
            {completedCount === loopCount && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>Ready for execution!</span>}
          </div>
        </div>
      )}

      {/* Form Content Body */}
      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {fields.map((field) => {
            const currentVal = isLoop ? (itemsData[activeItemIndex]?.[field.name] || '') : (formData[field.name] || '');
            const onValChange = (val) => {
              if (isLoop) {
                handleItemFieldChange(field.name, val);
              } else {
                handleChange(field.name, val);
              }
            };

            return (
              <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', gap: '4px' }}>
                  {field.name}
                  {field.required && <span style={{ color: 'var(--color-accent)' }}>*</span>}
                  {isLoop && <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 'normal' }}>(Item {activeItemIndex + 1})</span>}
                </label>
                
                {field.options ? (
                  <select 
                    className="form-input" 
                    value={currentVal} 
                    onChange={(e) => onValChange(e.target.value)}
                    style={{ background: '#ffffff', color: 'var(--text-primary)' }}
                  >
                    {field.options.map(opt => (
                      <option key={opt} value={opt} style={{ background: '#ffffff', color: 'var(--text-primary)' }}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input 
                    required={field.required}
                    type={field.type === 'integer' || field.type === 'number' ? 'number' : 'text'}
                    className="form-input"
                    value={currentVal}
                    onChange={(e) => onValChange(e.target.value)}
                    placeholder={field.description || `Enter ${field.name}...`}
                  />
                )}
                {field.description && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{field.description}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Premium Operations Actions Footbar */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: '16px' }}>
          {isLoop ? (
            <>
              {activeItemIndex > 0 ? (
                <button 
                  type="button" 
                  onClick={() => setActiveItemIndex(activeItemIndex - 1)} 
                  className="btn-outline" 
                  style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ChevronLeft size={14} /> Back
                </button>
              ) : (
                <button type="button" onClick={onCancel} className="btn-outline" style={{ flex: '0.4', fontSize: '12.5px' }}>
                  Cancel
                </button>
              )}

              {activeItemIndex < loopCount - 1 ? (
                <button 
                  type="button" 
                  onClick={() => setActiveItemIndex(activeItemIndex + 1)} 
                  className="btn-gradient" 
                  style={{ flex: '1', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  Next Item <ChevronRight size={14} />
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={handleSubmit} 
                  disabled={completedCount < loopCount}
                  className="btn-gradient" 
                  style={{ 
                    flex: '1', 
                    fontSize: '12.5px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px',
                    opacity: completedCount < loopCount ? 0.6 : 1,
                    cursor: completedCount < loopCount ? 'not-allowed' : 'pointer'
                  }}
                >
                  Submit All {loopCount} Items <ChevronRight size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                type="button" 
                onClick={handleSubmit} 
                className="btn-gradient" 
                style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                Submit Details <ChevronRight size={16} />
              </button>
              <button type="button" onClick={onCancel} className="btn-outline" style={{ flex: '0.4' }}>
                Cancel
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import { HelpCircle, ChevronRight, ChevronLeft, ShieldCheck, ListTodo, Users, ArrowRight, Play } from 'lucide-react';

export default function PlanVerificationCard({ 
  title, 
  steps = [], 
  executionMode = "single", 
  loopCount = 1, 
  fields = [], 
  parameterList = [], 
  onApprove, 
  onCancel 
}) {
  const isLoop = executionMode === "loop" && loopCount > 1;

  // 1. Inputs Form State Setup
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

  const handleFieldChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleItemFieldChange = (name, value) => {
    const next = [...itemsData];
    next[activeItemIndex] = { ...next[activeItemIndex], [name]: value };
    setItemsData(next);
  };

  const checkItemFilled = (item) => {
    return fields.every(f => !f.required || (item[f.name] !== undefined && item[f.name] !== ''));
  };

  const checkSingleFilled = () => {
    return fields.every(f => !f.required || (formData[f.name] !== undefined && formData[f.name] !== ''));
  };

  const completedCount = isLoop ? itemsData.filter(checkItemFilled).length : (checkSingleFilled() ? 1 : 0);
  const isReady = isLoop ? completedCount === loopCount : checkSingleFilled();

  const handleExecute = () => {
    if (isLoop) {
      onApprove(null, itemsData);
    } else {
      onApprove(formData, null);
    }
  };

  return (
    <div className="glass-panel pulse-glowing" style={{
      width: '100%',
      padding: '24px',
      background: 'rgba(253, 251, 247, 0.98)',
      border: '1.5px solid var(--border-neon-active)',
      borderRadius: '16px',
      boxShadow: 'var(--shadow-neon), var(--shadow-glow)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      maxHeight: '480px',
      overflowY: 'auto'
    }}>
      {/* Header Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '14px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(168, 95, 26, 0.1)', border: '1px solid rgba(168, 95, 26, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ListTodo size={18} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-secondary)', fontWeight: '700', letterSpacing: '0.05em' }}>
            Upfront Plan Verification
          </span>
          <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-header)', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
            {title || 'Proposed Runbook Execution Plan'}
          </h3>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* SECTION 1: Plan Stepper Display */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.01)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--border-neon)' }}>
          <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Proposed Execution Runbook Checklist ({steps.length} Steps)
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '200px' }} className="custom-scrollbar">
            {steps.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12px', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-neon)' }}>
                <span style={{ fontWeight: '800', color: 'var(--color-secondary)', background: 'rgba(179, 139, 77, 0.08)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '10.5px' }}>
                  {s.step}
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{s.id}</span>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '3px', background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                      {s.action_type}
                    </span>
                    {s.method && (
                      <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '3px', background: s.method === 'post' ? 'rgba(168,95,26,0.1)' : 'rgba(13,148,136,0.1)', color: s.method === 'post' ? 'var(--color-primary)' : 'var(--color-success)' }}>
                        {s.method}
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.4' }}>{s.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: Dynamic Form Fields Collection */}
        {fields.length > 0 && (
          <div style={{ flex: '1.2 1 340px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-neon)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '8px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {isLoop ? `Batch parameters collection (${loopCount} items)` : 'Missing parameters collection'}
              </h4>
              {isLoop && (
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  Tally: {completedCount} of {loopCount} filled
                </span>
              )}
            </div>

            {/* Loop Item Pagination Selector */}
            {isLoop && (
              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px' }} className="custom-scrollbar">
                {itemsData.map((item, idx) => {
                  const isFilled = checkItemFilled(item);
                  const isActive = idx === activeItemIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveItemIndex(idx)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--border-neon)',
                        borderRadius: '6px',
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
            )}

            {/* Parameter Input Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '150px', overflowY: 'auto' }} className="custom-scrollbar">
              {fields.map((field) => {
                const currentVal = isLoop ? (itemsData[activeItemIndex]?.[field.name] || '') : (formData[field.name] || '');
                const onValChange = (val) => {
                  if (isLoop) {
                    handleItemFieldChange(field.name, val);
                  } else {
                    handleFieldChange(field.name, val);
                  }
                };

                return (
                  <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', gap: '4px' }}>
                      {field.name}
                      {field.required && <span style={{ color: 'var(--color-accent)' }}>*</span>}
                    </label>
                    
                    {field.options ? (
                      <select 
                        className="form-input" 
                        value={currentVal} 
                        onChange={(e) => onValChange(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      >
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
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
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Loop Slider Pagination Buttons */}
            {isLoop && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: '8px' }}>
                {activeItemIndex > 0 && (
                  <button 
                    type="button" 
                    onClick={() => setActiveItemIndex(activeItemIndex - 1)} 
                    className="btn-outline" 
                    style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ChevronLeft size={12} /> Prev Item
                  </button>
                )}
                {activeItemIndex < loopCount - 1 && (
                  <button 
                    type="button" 
                    onClick={() => setActiveItemIndex(activeItemIndex + 1)} 
                    className="btn-outline" 
                    style={{ padding: '4px 10px', fontSize: '11.5px', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Next Item <ChevronRight size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upfront Approvals Actions panel */}
      <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '16px', marginTop: '4px' }}>
        <button 
          onClick={handleExecute}
          disabled={!isReady}
          className="btn-gradient" 
          style={{ 
            flex: '1.2', 
            background: isReady ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'var(--text-muted)',
            cursor: isReady ? 'pointer' : 'not-allowed',
            opacity: isReady ? 1 : 0.6,
            boxShadow: isReady ? '0 4px 14px rgba(168, 95, 26, 0.2)' : 'none',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 24px',
            fontSize: '13px'
          }}
        >
          <Play size={14} fill="currentColor" /> Approve & Execute Runbook Sequence
        </button>
        <button 
          onClick={onCancel} 
          className="btn-outline" 
          style={{ flex: '0.6', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

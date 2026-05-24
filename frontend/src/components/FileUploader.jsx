import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Film, Image, Check, AlertCircle, X } from 'lucide-react';

export default function FileUploader({ onUploadComplete, activePortalId, showToast }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
 
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (selectedFile) => {
    if (!activePortalId) {
      if (showToast) {
        showToast("Please select a Portal config first before attaching files.", 'warning');
      } else {
        console.warn("Please select a Portal config first before attaching files.");
      }
      return;
    }
    
    setFile(selectedFile);
    setUploadStatus('uploading');
    setProgress(30);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setProgress(60);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setProgress(100);
        setUploadStatus('success');
        onUploadComplete(data.saved_path, selectedFile.name);
      } else {
        setUploadStatus('error');
      }
    } catch (err) {
      setUploadStatus('error');
    }
  };

  const clearFile = () => {
    setFile(null);
    setUploadStatus('idle');
    setProgress(0);
    onUploadComplete(null, null);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['csv', 'xlsx', 'xls', 'json'].includes(ext)) {
      return <FileSpreadsheet size={24} style={{ color: 'var(--color-secondary)' }} />;
    }
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
      return <Film size={24} style={{ color: 'var(--color-primary)' }} />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      return <Image size={24} style={{ color: 'var(--color-accent)' }} />;
    }
    return <UploadCloud size={24} style={{ color: 'var(--text-secondary)' }} />;
  };

  return (
    <div style={{ width: '100%' }}>
      {uploadStatus === 'idle' ? (
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
          style={{
            border: '2px dashed var(--border-neon)',
            borderColor: dragActive ? 'var(--color-secondary)' : 'var(--border-neon)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragActive ? 'rgba(179, 139, 77, 0.05)' : 'rgba(139, 123, 102, 0.03)',
            transition: 'var(--transition-smooth)'
          }}
          className="hover:border-[var(--color-secondary)]"
        >
          <input 
            ref={fileInputRef}
            type="file" 
            style={{ display: 'none' }}
            onChange={handleChange}
            accept=".csv,.xlsx,.xls,.json,.png,.jpg,.jpeg,.mp4"
          />
          <UploadCloud size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', marginInline: 'auto' }} />
          <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
            Drag and drop your operational attachments
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Supports CSV, Excel, JSON bulk data, or image/video uploads
          </p>
        </div>
      ) : (
        <div 
          className="glass-panel animate-fade-in"
          style={{ 
            padding: '14px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px',
            background: '#ffffff'
          }}
        >
          {getFileIcon(file.name)}
          
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
              <span>•</span>
              {uploadStatus === 'uploading' && <span style={{ color: 'var(--color-secondary)' }}>Uploading {progress}%...</span>}
              {uploadStatus === 'success' && <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '2px' }}><Check size={10} /> Active Attachment</span>}
              {uploadStatus === 'error' && <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '2px' }}><AlertCircle size={10} /> Upload failed</span>}
            </div>
            
            {uploadStatus === 'uploading' && (
              <div style={{ width: '100%', height: '3px', background: 'rgba(0,0,0,0.05)', borderRadius: '9px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--gradient-brand)', borderRadius: '9px', transition: 'var(--transition-smooth)' }} />
              </div>
            )}
          </div>

          <button 
            onClick={clearFile}
            style={{ 
              background: 'rgba(139, 123, 102, 0.08)', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              width: '24px', 
              height: '24px', 
              borderRadius: '50%', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

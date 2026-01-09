import React, { useState, useRef, useCallback } from 'react';
import './DocumentUploader.css';

interface UploadedFile {
  id: string;
  name: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  category: string;
  createdAt: string;
}

interface DocumentUploaderProps {
  projectId: string;
  userId?: string;
  onUploadComplete?: (file: UploadedFile) => void;
  onError?: (error: string) => void;
  allowedTypes?: string[];
  maxFileSize?: number; // in bytes
  multiple?: boolean;
  showProgress?: boolean;
}

const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const CATEGORIES = [
  { value: 'General', label: 'General', icon: '📄' },
  { value: 'Photo', label: 'Site Photos', icon: '📷' },
  { value: 'Design', label: 'Design Files', icon: '🎨' },
  { value: 'Contract', label: 'Contracts', icon: '📝' },
  { value: 'Invoice', label: 'Invoices', icon: '💰' },
  { value: 'Inspiration', label: 'Inspiration', icon: '✨' }
];

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  projectId,
  userId,
  onUploadComplete,
  onError,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxFileSize = 25 * 1024 * 1024, // 25MB
  multiple = false,
  showProgress = true
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const validateFile = useCallback((file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `File type "${file.type}" is not supported`;
    }
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)} limit`;
    }
    return null;
  }, [allowedTypes, maxFileSize]);

  const handleFiles = useCallback((fileList: FileList) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach(file => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      if (multiple) {
        setFiles(prev => [...prev, ...validFiles]);
      } else {
        setFiles([validFiles[0]]);
      }
      setError(null);
    }
  }, [multiple, validateFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('category', category);
    formData.append('description', description);
    if (userId) {
      formData.append('userId', userId);
    }

    const response = await fetch(
      `${API_URL}/api/projects/${projectId}/images`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Upload failed');
    }

    const data = await response.json();
    return data.deliverable;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    const results: UploadedFile[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await uploadFile(files[i]);
        if (result) {
          results.push(result);
          onUploadComplete?.(result);
        }
        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        errors.push(`${files[i].name}: ${errorMsg}`);
        onError?.(errorMsg);
      }
    }

    setUploadedFiles(prev => [...results, ...prev]);

    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      // Success - reset form
      setFiles([]);
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }

    setUploading(false);
    setProgress(0);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('document')) return '📘';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📗';
    return '📄';
  };

  return (
    <div className="document-uploader">
      {/* Header */}
      <div className="uploader-header">
        <h3>📤 Upload Files</h3>
        <p>Share documents and images with your project team</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="upload-error" role="alert">
          <span className="error-icon">⚠️</span>
          <pre className="error-message">{error}</pre>
          <button
            className="dismiss-error"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="uploader-form">
        {/* Drop Zone */}
        <div
          className={`drop-zone ${dragActive ? 'drag-active' : ''} ${
            files.length > 0 ? 'has-files' : ''
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Click or drag files to upload"
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleInputChange}
            accept={allowedTypes.join(',')}
            multiple={multiple}
            disabled={uploading}
            className="file-input"
          />

          {files.length === 0 ? (
            <div className="drop-zone-content">
              <span className="upload-icon">☁️</span>
              <span className="upload-text">
                {dragActive
                  ? 'Drop files here'
                  : 'Click or drag files to upload'}
              </span>
              <span className="upload-hint">
                Max {formatFileSize(maxFileSize)} per file
              </span>
            </div>
          ) : (
            <div className="selected-files">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="selected-file">
                  <span className="file-icon">{getFileIcon(file.type)}</span>
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="remove-file"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    disabled={uploading}
                    aria-label={`Remove ${file.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {multiple && (
                <div className="add-more">
                  <span>+ Add more files</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Selection */}
        <div className="form-group">
          <label htmlFor="category" className="form-label">
            Category
          </label>
          <div className="category-grid">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                className={`category-button ${
                  category === cat.value ? 'selected' : ''
                }`}
                onClick={() => setCategory(cat.value)}
                disabled={uploading}
              >
                <span className="category-icon">{cat.icon}</span>
                <span className="category-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description <span className="optional">(optional)</span>
          </label>
          <textarea
            id="description"
            className="form-textarea"
            placeholder="Add notes about these files..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={uploading}
            rows={3}
          />
        </div>

        {/* Progress Bar */}
        {showProgress && uploading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="progress-text">{progress}% uploaded</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-button"
          disabled={files.length === 0 || uploading}
        >
          {uploading ? (
            <>
              <span className="spinner" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <span>📤</span>
              <span>
                Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Files'}
              </span>
            </>
          )}
        </button>
      </form>

      {/* Recently Uploaded */}
      {uploadedFiles.length > 0 && (
        <div className="recently-uploaded">
          <h4>✅ Recently Uploaded</h4>
          <div className="uploaded-list">
            {uploadedFiles.slice(0, 5).map(file => (
              <div key={file.id} className="uploaded-item">
                <span className="file-icon">{getFileIcon(file.fileType)}</span>
                <span className="file-name">{file.name}</span>
                <span className="file-category">{file.category}</span>
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-link"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;

import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './ManageDocuments.css';

const ManageDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [documentContent, setDocumentContent] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      // Get documents from knowledge_base_documents table
      const response = await apiClient.get('/admin/rag/documents');
      setDocuments(response.data || []);
    } catch (err) {
      // If endpoint doesn't exist, show empty state
      setDocuments([]);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      setUploading(true);
      await apiClient.post('/admin/rag/upload-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setSelectedFile(null);
      fetchDocuments(); // Refresh the list
      alert('Document uploaded successfully!');
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const viewDocument = async (doc) => {
    try {
      setViewingDocument(doc);
      // Get document chunks to reconstruct content
      const response = await apiClient.get(`/admin/rag/document/${doc.id}/content`);
      setDocumentContent(response.data.content || 'Content not available');
    } catch (err) {
      // Fallback: show document info only
      setDocumentContent(`Document: ${doc.file_name}\nType: ${doc.file_type}\nUploaded: ${new Date(doc.uploaded_at).toLocaleString()}\n\nContent preview not available.`);
    }
  };

  const deleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await apiClient.delete(`/admin/rag/document/${docId}`);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (err) {
      alert('Failed to delete document: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <h1 className="page-header">Knowledge Base Documents</h1>
      
      <div className="upload-section">
        <h3>Upload New Document</h3>
        <form onSubmit={handleFileUpload} className="upload-form">
          <div className="file-input-group">
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="file-input"
            />
            <button 
              type="submit" 
              disabled={!selectedFile || uploading}
              className="btn-upload"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
          <p className="file-help">Supported formats: PDF, TXT, MD (max 20MB)</p>
        </form>
      </div>

      <div className="documents-section">
        <h3>Uploaded Documents</h3>
        {loading && <p>Loading documents...</p>}
        {error && <div className="error-message">{error}</div>}
        
        {!loading && documents.length === 0 && (
          <p className="no-data">No documents uploaded yet. Upload your first document above.</p>
        )}
        
        {documents.length > 0 && (
          <table className="documents-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Chunks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.file_name}</td>
                  <td className="file-type">{doc.file_type.toUpperCase()}</td>
                  <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                  <td>{doc.chunk_count || 0}</td>
                  <td>
                    <button 
                      className="btn-view"
                      onClick={() => viewDocument(doc)}
                    >
                      View
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => deleteDocument(doc.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Document Viewer Modal */}
      {viewingDocument && (
        <div className="modal-overlay" onClick={() => setViewingDocument(null)}>
          <div className="modal-content document-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📄 {viewingDocument.file_name}</h2>
              <button className="modal-close" onClick={() => setViewingDocument(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="document-info">
                <p><strong>Type:</strong> {viewingDocument.file_type.toUpperCase()}</p>
                <p><strong>Uploaded:</strong> {new Date(viewingDocument.uploaded_at).toLocaleString()}</p>
                <p><strong>Chunks:</strong> {viewingDocument.chunk_count} processed</p>
              </div>
              <div className="document-content">
                <h4>Content Preview:</h4>
                <pre className="content-preview">{documentContent}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDocuments;

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient'; // Assuming supabase client is set up for auth token
import './ManageDocumentsPage.css';

const ManageDocumentsPage = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false); // For delete/re-index actions
  const [notification, setNotification] = useState({ type: '', message: '' }); // type: 'success' or 'error'

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setNotification({ type: '', message: '' });
    try {
      const { data, error: fetchError } = await supabase
        .from('knowledge_base_documents')
        .select('id, file_name, file_type, uploaded_at, last_indexed_at')
        .order('uploaded_at', { ascending: false });
      if (fetchError) throw fetchError;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setNotification({ type: 'error', message: "Failed to load documents: " + err.message });
    }
    setIsLoadingDocs(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setNotification({ type: '', message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setNotification({ type: 'error', message: 'Please select a file to upload.' });
      return;
    }
    setUploading(true);
    setNotification({ type: '', message: '' });

    const formData = new FormData();
    formData.append('document', file);

    try {
      const sessionData = await supabase.auth.getSession();
      const session = sessionData?.data?.session;
      if (!session) {
        setNotification({ type: 'error', message: 'Authentication error. Please log in again.' });
        setUploading(false);
        return;
      }

      const response = await axios.post('/api/admin/rag/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      setNotification({ type: 'success', message: response.data.message || 'Document uploaded successfully!' });
      setFile(null);
      if (e.target.reset) e.target.reset(); // Reset the form using the event target
      fetchDocuments(); 
    } catch (err) {
      console.error("Upload error:", err.response?.data || err.message);
      setNotification({ 
        type: 'error', 
        message: `Upload failed: ${err.response?.data?.details || err.response?.data?.error || err.message}` 
      });
    }
    setUploading(false);
  };
  
  const handleDeleteDocument = async (documentId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}" and all its chunks? This cannot be undone.`)) {
      return;
    }

    setIsLoadingAction(true);
    setNotification({ type: '', message: '' });

    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData?.data?.session?.access_token;
      if (!token) {
        throw new Error('No active session. Please log in again.');
      }
      
      const response = await axios.delete(`/api/admin/rag/document/${documentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 200 && response.data.message) {
        setNotification({ type: 'success', message: response.data.message });
        fetchDocuments(); 
      } else {
        throw new Error(response.data?.error || response.data?.message || 'Failed to delete document.');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      setNotification({ 
        type: 'error', 
        message: `Delete failed: ${err.response?.data?.error || err.message}`
      });
    }
    setIsLoadingAction(false);
  };

  return (
    <div className="manage-documents-container"> {/* Consistent container name */}
      <h1 className="page-header">Manage Knowledge Base Documents</h1>
      
      {notification.message && (
        <div className={`${notification.type === 'success' ? 'success' : 'error'}-message`}>
          {notification.message}
        </div>
      )}

      <div className="card mb-2"> {/* Card for upload form */}
        <div className="card-header">Upload New Document</div>
        <form onSubmit={handleSubmit} style={{ paddingTop: '15px'}}>
          <p style={{ marginTop: 0, marginBottom: '15px', fontSize: '0.9em' }}>Supported types: PDF, TXT, MD. Max size: 20MB.</p>
          <div className="form-group">
            <label htmlFor="documentUpload">Select Document</label>
            <input type="file" id="documentUpload" onChange={handleFileChange} accept=".pdf,.txt,.md" />
          </div>
          <button type="submit" disabled={uploading || !file || isLoadingAction} className="button">
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
      </div>

      <div className="card"> {/* Card for documents list */}
        <div className="card-header">Uploaded Documents</div>
        {isLoadingDocs ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>Loading documents...</p>
        ) : documents.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>No documents uploaded yet.</p>
        ) : (
          <div className="table-responsive"> {/* For smaller screens */}
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Uploaded At</th>
                  <th>Last Indexed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td data-label="File Name">{doc.file_name}</td>
                    <td data-label="Type">{doc.file_type}</td>
                    <td data-label="Uploaded At">{new Date(doc.uploaded_at).toLocaleString()}</td>
                    <td data-label="Last Indexed">{doc.last_indexed_at ? new Date(doc.last_indexed_at).toLocaleString() : 'Never'}</td>
                    <td data-label="Actions" className="actions-cell">
                      <button 
                        onClick={() => handleDeleteDocument(doc.id, doc.file_name)} 
                        disabled={isLoadingAction} 
                        className="button secondary small-button">
                          Delete
                      </button>
                      {/* <button disabled={isLoadingAction} className="button small-button">Re-index</button> */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageDocumentsPage; 
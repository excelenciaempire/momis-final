import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient'; // Assuming supabase client is set up for auth token
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa'; // Add icons import
import './ManageDocumentsPage.css';

const ManageDocumentsPage = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false); // For delete/re-index actions
  const [notification, setNotification] = useState({ type: '', message: '' }); // type: 'success' or 'error'

  // Helper to get token, lenient for preview
  const getToken = async () => {
    const sessionData = await supabase.auth.getSession();
    const session = sessionData?.data?.session;
    if (session) {
      return session.access_token;
    }
    console.warn("ManageDocumentsPage: No active session, proceeding for preview. API calls may fail if auth is enforced by backend.");
    return null; // Return null if no session
  };

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setNotification({ type: '', message: '' });
    try {
      // Fetching documents doesn't require admin token for read if RLS allows general read access 
      // or if using service key on backend. For now, assume public read or RLS handles it.
      const { data, error: fetchError } = await supabase
        .from('knowledge_base_documents')
        .select('id, file_name, file_type, uploaded_at, last_indexed_at, storage_path')
        .order('uploaded_at', { ascending: false });
      if (fetchError) throw fetchError;

      // Enhance documents with public URLs
      const documentsWithUrls = await Promise.all(data.map(async (doc) => {
        const { data: urlData } = await supabase
          .storage
          .from('knowledge_base_files')
          .getPublicUrl(doc.storage_path);
        
        return {
          ...doc,
          public_url: urlData.publicUrl,
        };
      }));

      setDocuments(documentsWithUrls || []);
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
    let token = null;
    try {
      token = await getToken();
      // if (!token) { // Removed strict check for preview
      //   setNotification({ type: 'error', message: 'Authentication error. Please log in again.' });
      //   setUploading(false);
      //   return;
      // }

      const response = await axios.post('/api/admin/rag/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token && { 'Authorization': `Bearer ${token}` }) // Conditionally add auth header
        }
      });
      setNotification({ type: 'success', message: response.data.message || 'Document uploaded successfully!' });
      setFile(null);
      if (e.target.reset) e.target.reset();
      fetchDocuments(); 
    } catch (err) {
      console.error("Upload error:", err.response?.data || err.message);
      let errMsg = `Upload failed: ${err.response?.data?.details || err.response?.data?.error || err.message}`;
      if (!token && err.response?.status === 401) {
        errMsg = "Upload failed: Authentication error. Backend may require login.";
      }
      setNotification({ type: 'error', message: errMsg });
    }
    setUploading(false);
  };
  
  const handleDeleteDocument = async (documentId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}" and all its chunks? This cannot be undone.`)) {
      return;
    }

    setIsLoadingAction(true);
    setNotification({ type: '', message: '' });
    let token = null;
    try {
      token = await getToken();
      // if (!token) { // Removed strict check for preview
      //   throw new Error('No active session. Please log in again.');
      // }
      
      const response = await axios.delete(`/api/admin/rag/document/${documentId}`, {
        headers: { ...(token && { 'Authorization': `Bearer ${token}` }) } // Conditionally add auth header
      });

      if (response.status === 200 && response.data.message) {
        setNotification({ type: 'success', message: response.data.message });
        fetchDocuments(); 
      } else {
        throw new Error(response.data?.error || response.data?.message || 'Failed to delete document.');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      let errMsg = `Delete failed: ${err.response?.data?.error || err.message}`;
      if (!token && err.response?.status === 401) {
        errMsg = "Delete failed: Authentication error. Backend may require login.";
      }
      setNotification({ type: 'error', message: errMsg });
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
                  <th>Indexed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td data-label="File Name">
                      <a href={doc.public_url} target="_blank" rel="noopener noreferrer" className="document-link">
                        {doc.file_name}
                      </a>
                    </td>
                    <td data-label="Type">{doc.file_type}</td>
                    <td data-label="Uploaded At">{new Date(doc.uploaded_at).toLocaleString()}</td>
                    <td data-label="Last Indexed">{doc.last_indexed_at ? new Date(doc.last_indexed_at).toLocaleString() : 'Never'}</td>
                    <td data-label="Indexed" className="indexed-status">
                      {doc.last_indexed_at ? (
                        <FaCheckCircle className="indexed-icon indexed-yes" title="Document is indexed" />
                      ) : (
                        <FaTimesCircle className="indexed-icon indexed-no" title="Document not indexed" />
                      )}
                    </td>
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
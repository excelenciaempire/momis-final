import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient'; // Assuming supabase client is set up for auth token
import './ManageDocumentsPage.css';

const ManageDocumentsPage = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('knowledge_base_documents')
        .select('id, file_name, file_type, uploaded_at, last_indexed_at')
        .order('uploaded_at', { ascending: false });
      if (fetchError) throw fetchError;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError("Failed to load documents. " + err.message);
    }
    setIsLoadingDocs(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setUploading(true);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('document', file);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        setError('Authentication error. Please log in again.');
        setUploading(false);
        return;
      }

      // TODO: In a real app, the backend endpoint /api/admin/rag/upload-document
      // should be protected and require this token for an admin user.
      // For now, we send it, but backend protection is not yet implemented.
      const response = await axios.post('/api/admin/rag/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${session.access_token}` // Send token for protected route
        }
      });
      setMessage(response.data.message || 'Document uploaded successfully!');
      setFile(null);
      e.target.reset(); // Reset the form
      fetchDocuments(); // Refresh the list
    } catch (err) {
      console.error("Upload error:", err.response?.data || err.message);
      setError(`Upload failed: ${err.response?.data?.details || err.response?.data?.error || err.message}`);
    }
    setUploading(false);
  };
  
  const handleDeleteDocument = async (documentId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete the document "${fileName}" and all its associated text chunks? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setNotification(null);

    try {
      const session = await supabase.auth.getSession();
      if (!session?.data?.session?.access_token) {
        throw new Error('No active session. Please log in again.');
      }
      const token = session.data.session.access_token;

      // Call the new backend endpoint for deletion
      const response = await axios.delete(`/api/admin/rag/document/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 200) {
        setNotification(`Document "${fileName}" and its chunks deleted successfully.`);
        // Refresh the documents list
        fetchDocuments(); 
      } else {
        // The backend should ideally return a non-200 status for errors handled by it
        // but if it doesn't, we check the response data for an error message.
        throw new Error(response.data.error || 'Failed to delete document from backend.');
      }

    } catch (err) {
      console.error('Error deleting document:', err);
      let detailedError = 'Failed to delete document.';
      if (err.response?.data?.error) {
        detailedError = err.response.data.error;
      } else if (err.message) {
        detailedError = err.message;
      }
      setError(detailedError);
      setNotification(null);
    }
    setLoading(false);
  };

  return (
    <div className="manage-documents-page">
      <h2>Manage Knowledge Base Documents</h2>
      
      <form onSubmit={handleSubmit} className="upload-form">
        <h3>Upload New Document</h3>
        <p>Supported types: PDF, TXT, MD</p>
        <div className="form-group">
          <label htmlFor="documentUpload">Select Document</label>
          <input type="file" id="documentUpload" onChange={handleFileChange} accept=".pdf,.txt,.md" />
        </div>
        <button type="submit" disabled={uploading || !file} className="upload-button">
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </form>

      <div className="documents-list">
        <h3>Uploaded Documents</h3>
        {isLoadingDocs ? (
          <p>Loading documents...</p>
        ) : documents.length === 0 ? (
          <p>No documents uploaded yet.</p>
        ) : (
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
                  <td>{doc.file_name}</td>
                  <td>{doc.file_type}</td>
                  <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                  <td>{doc.last_indexed_at ? new Date(doc.last_indexed_at).toLocaleString() : 'Never'}</td>
                  <td>
                    <button onClick={() => handleDeleteDocument(doc.id, doc.file_name)} className="delete-button">Delete</button>
                    {/* TODO: Add Re-index button */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ManageDocumentsPage; 
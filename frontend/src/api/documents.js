import api, { API_BASE_URL } from './client';

export const documentsApi = {
  getDocuments: async (params = {}) => {
    const response = await api.get('/documents', { params });
    return response.data;
  },

  getDocument: async (documentId) => {
    const response = await api.get(`/documents/${documentId}`);
    return response.data;
  },

  uploadDocument: async (file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  },

  retryDocument: async (documentId) => {
    const response = await api.post(`/documents/${documentId}/retry`);
    return response.data;
  },

  deleteDocument: async (documentId) => {
    const response = await api.delete(`/documents/${documentId}`);
    return response.data;
  },

  getPreviewBlob: async (documentId) => {
    const response = await api.get(`/documents/${documentId}/preview`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getPreviewUrl: (documentId) => {
    const token = localStorage.getItem('docrag_access_token');
    return `${API_BASE_URL}/documents/${documentId}/preview${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  downloadOriginal: async (documentId, fallbackFilename = 'document') => {
    const response = await api.get(`/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    let filename = fallbackFilename;
    const disposition = response.headers?.['content-disposition'];
    if (disposition) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getDocumentChunks: async (documentId) => {
    const response = await api.get(`/documents/${documentId}/chunks`);
    return response.data;
  },
};

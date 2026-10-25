import api from './client';

export const chatApi = {
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },

  createConversation: async (title = 'New Conversation') => {
    const response = await api.post('/chat/conversations', { title });
    return response.data;
  },

  getConversation: async (conversationId) => {
    const response = await api.get(`/chat/conversations/${conversationId}`);
    return response.data;
  },

  updateConversation: async (conversationId, payload) => {
    // Supports title string or object { title, is_pinned, is_archived }
    const body = typeof payload === 'string' ? { title: payload } : payload;
    const response = await api.patch(`/chat/conversations/${conversationId}`, body);
    return response.data;
  },

  getArchivedConversations: async () => {
    const response = await api.get('/chat/conversations?archived=true');
    return response.data;
  },

  searchConversations: async (query, archived = false) => {
    const response = await api.get('/chat/conversations/search', {
      params: { q: query, archived },
    });
    return response.data;
  },

  createShare: async (conversationId, payload = {}) => {
    const response = await api.post(`/chat/conversations/${conversationId}/share`, payload);
    return response.data;
  },

  getShare: async (conversationId) => {
    const response = await api.get(`/chat/conversations/${conversationId}/share`);
    return response.data;
  },

  revokeShare: async (conversationId) => {
    const response = await api.delete(`/chat/conversations/${conversationId}/share`);
    return response.data;
  },

  getSharedConversation: async (shareToken) => {
    const response = await api.get(`/shared/${shareToken}`);
    return response.data;
  },

  deleteConversation: async (conversationId) => {
    const response = await api.delete(`/chat/conversations/${conversationId}`);
    return response.data;
  },

  sendQuery: async ({ question, conversation_id, document_ids, top_k, similarity_threshold }) => {
    const response = await api.post('/chat/query', {
      question,
      conversation_id,
      document_ids,
      top_k,
      similarity_threshold,
    });
    return response.data;
  },

  editMessage: async (conversationId, messageId, { content, document_ids, top_k, similarity_threshold }) => {
    const response = await api.post(`/chat/conversations/${conversationId}/messages/${messageId}/edit`, {
      content,
      document_ids,
      top_k,
      similarity_threshold,
    });
    return response.data;
  },

  exportPdf: async (conversationId) => {
    const response = await api.get(`/chat/conversations/${conversationId}/export-pdf`, {
      responseType: 'blob',
    });
    return response;
  },
};

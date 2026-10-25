import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { chatApi } from '../api/chat';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch all user conversations
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingConversations(true);
    try {
      const data = await chatApi.getConversations();
      setConversations(data || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    } else {
      setConversations([]);
      setActiveConvId(null);
      setActiveConversation(null);
      setMessages([]);
    }
  }, [isAuthenticated, fetchConversations]);

  // Start a fresh, clean conversation (New Chat)
  const startNewChat = useCallback((navigate) => {
    setActiveConvId(null);
    setActiveConversation(null);
    setMessages([]);
    if (navigate) {
      navigate('/chat');
    }
  }, []);

  // Select an existing conversation and restore its messages
  const selectConversation = useCallback(async (convId, navigate) => {
    if (!convId) return;
    setActiveConvId(convId);
    setLoadingMessages(true);
    if (navigate) {
      navigate('/chat');
    }
    try {
      const data = await chatApi.getConversation(convId);
      setActiveConversation(data);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(async (convId) => {
    if (!convId) return;
    try {
      await chatApi.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      throw err;
    }
  }, [activeConvId, startNewChat]);

  // Rename a conversation
  const renameConversation = useCallback(async (convId, newTitle) => {
    if (!convId || !newTitle.trim()) return;
    try {
      const updated = await chatApi.updateConversation(convId, { title: newTitle.trim() });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: updated.title } : c))
      );
      if (activeConvId === convId) {
        setActiveConversation((prev) => (prev ? { ...prev, title: updated.title } : null));
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      throw err;
    }
  }, [activeConvId]);

  // Pin or unpin a conversation
  const pinConversation = useCallback(async (convId, isPinned) => {
    if (!convId) return;
    try {
      const updated = await chatApi.updateConversation(convId, { is_pinned: isPinned });
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === convId ? { ...c, is_pinned: updated.is_pinned } : c));
        // Sort: pinned first, then updated_at desc
        return next.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
        });
      });
      if (activeConvId === convId) {
        setActiveConversation((prev) => (prev ? { ...prev, is_pinned: updated.is_pinned } : null));
      }
    } catch (err) {
      console.error('Failed to pin/unpin conversation:', err);
      throw err;
    }
  }, [activeConvId]);

  // Archive a conversation
  const archiveConversation = useCallback(async (convId) => {
    if (!convId) return;
    try {
      await chatApi.updateConversation(convId, { is_archived: true });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to archive conversation:', err);
      throw err;
    }
  }, [activeConvId, startNewChat]);

  // Restore an archived conversation
  const restoreConversation = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const restored = await chatApi.updateConversation(convId, { is_archived: false });
      await fetchConversations();
      return restored;
    } catch (err) {
      console.error('Failed to restore conversation:', err);
      throw err;
    }
  }, [fetchConversations]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConvId,
        activeConversation,
        messages,
        loadingConversations,
        loadingMessages,
        startNewChat,
        selectConversation,
        deleteConversation,
        renameConversation,
        pinConversation,
        archiveConversation,
        restoreConversation,
        fetchConversations,
        setMessages,
        setActiveConvId,
        setActiveConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

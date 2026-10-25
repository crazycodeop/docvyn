import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { chatApi } from '../api/chat';
import { documentsApi } from '../api/documents';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import DocvynLogo from '../components/common/DocvynLogo';
import MarkdownRenderer from '../components/chat/MarkdownRenderer';
import FindInChatBar from '../components/chat/FindInChatBar';
import ShareConversationModal from '../components/chat/ShareConversationModal';
import ArchivedModal from '../components/chat/ArchivedModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { highlightMatchesInContainer, removeHighlights, setActiveMatch } from '../utils/findInChat';
import { useChat } from '../context/ChatContext';
import { useSidebar } from '../context/SidebarContext';
import {
  MessageSquare,
  Plus,
  ArrowUp,
  Trash2,
  Edit2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Check,
  User,
  Copy,
  Download,
  Folder,
  Search,
  Mic,
  Share2,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  X as CloseIcon,
  PanelLeftOpen,
  MoreVertical,
} from 'lucide-react';

const ALLOWED_EXTS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.tiff'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export default function ChatPage() {
  const {
    conversations,
    activeConvId,
    activeConversation,
    messages,
    startNewChat,
    selectConversation,
    renameConversation,
    fetchConversations,
    setMessages,
    setActiveConvId,
  } = useChat();

  const [inputQuestion, setInputQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Document filter scope ('landing' | 'thread' | 'header' | null)
  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [docFilterAnchor, setDocFilterAnchor] = useState(null);
  const isDocFilterOpen = Boolean(docFilterAnchor);
  const setIsDocFilterOpen = (val) => {
    if (typeof val === 'function') {
      setDocFilterAnchor((prev) => (val(Boolean(prev)) ? 'landing' : null));
    } else {
      setDocFilterAnchor(val ? 'landing' : null);
    }
  };

  // Attached files state (multi-file with upload tracking)
  const [attachments, setAttachments] = useState([]);
  const [isDraggingLanding, setIsDraggingLanding] = useState(false);
  const [isDraggingThread, setIsDraggingThread] = useState(false);

  // Rename modal
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');

  // Citation modal
  const [selectedCitation, setSelectedCitation] = useState(null);

  // Message copy state tracker
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  // Find in Chat state
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [findMatches, setFindMatches] = useState([]);

  // Message edit state (like ChatGPT)
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false);

  // Mobile Top Actions Menu (...)
  const [showMobileActionsMenu, setShowMobileActionsMenu] = useState(false);

  // Archived Modal
  const [showArchivedModal, setShowArchivedModal] = useState(false);

  // Dialog alert modal (replacing window.alert)
  const [dialogAlert, setDialogAlert] = useState(null);

  // Speech-to-Text
  const handleTranscript = useCallback((text) => {
    setInputQuestion((prev) => (prev ? `${prev.trim()} ${text}` : text));
  }, []);

  const { isListening, isSupported: isSpeechSupported, speechError, setSpeechError, toggleListening } =
    useSpeechToText({
      onTranscript: handleTranscript,
    });

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatThreadRef = useRef(null);
  const fileInputRefLanding = useRef(null);
  const fileInputRefThread = useRef(null);
  const docFilterRef = useRef(null);
  const mobileActionsMenuRef = useRef(null);
  const { isSidebarCollapsed, toggleSidebarCollapse } = useSidebar();

  // Close document filter dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!docFilterAnchor) return;

    const handleClickOutside = (e) => {
      if (docFilterRef.current && !docFilterRef.current.contains(e.target)) {
        if (e.target.closest && e.target.closest('[data-doc-filter-toggle="true"]')) {
          return;
        }
        setDocFilterAnchor(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDocFilterAnchor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [docFilterAnchor]);

  // Close mobile actions menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!showMobileActionsMenu) return;

    const handleClickOutside = (e) => {
      if (mobileActionsMenuRef.current && !mobileActionsMenuRef.current.contains(e.target)) {
        setShowMobileActionsMenu(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowMobileActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMobileActionsMenu]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll for document status if any document is processing or if attachments are active
  useEffect(() => {
    const hasProcessing = availableDocs.some(
      (d) => d.status === 'processing' || d.status === 'queued'
    );
    const hasUploadingAttach = attachments.some(
      (a) => a.status === 'uploading'
    );

    if (hasProcessing || hasUploadingAttach) {
      const interval = setInterval(() => {
        fetchDocuments();
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [availableDocs, attachments]);

  const fetchDocuments = async () => {
    try {
      const data = await documentsApi.getDocuments({ size: 100 });
      setAvailableDocs(data.items || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  // Multi-file processing and instant upload
  const processFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;

    for (const file of Array.from(filesList)) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      const attachId = 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

      if (!ALLOWED_EXTS.includes(ext)) {
        setAttachments((prev) => [
          ...prev,
          {
            id: attachId,
            name: file.name,
            size: file.size,
            ext,
            status: 'error',
            error: `Unsupported format ${ext}`,
          },
        ]);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setAttachments((prev) => [
          ...prev,
          {
            id: attachId,
            name: file.name,
            size: file.size,
            ext,
            status: 'error',
            error: 'Exceeds 25 MB limit',
          },
        ]);
        continue;
      }

      // Add uploading attachment chip
      setAttachments((prev) => [
        ...prev,
        {
          id: attachId,
          name: file.name,
          size: file.size,
          ext,
          status: 'uploading',
          progress: 0,
        },
      ]);

      try {
        const uploadedDoc = await documentsApi.uploadDocument(file, (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || file.size || 1)
          );
          setAttachments((curr) =>
            curr.map((item) => (item.id === attachId ? { ...item, progress: percent } : item))
          );
        });

        // Set as ready and bind doc ID
        setAttachments((curr) =>
          curr.map((item) =>
            item.id === attachId
              ? { ...item, status: 'ready', progress: 100, docId: uploadedDoc.id }
              : item
          )
        );

        // Auto-select this uploaded document for chat scope
        setSelectedDocIds((curr) =>
          curr.includes(uploadedDoc.id) ? curr : [...curr, uploadedDoc.id]
        );
        fetchDocuments();
      } catch (err) {
        const errMsg = err.response?.data?.detail || 'Upload failed';
        setAttachments((curr) =>
          curr.map((item) =>
            item.id === attachId ? { ...item, status: 'error', error: errMsg } : item
          )
        );
      }
    }
  };

  const removeAttachment = (attachId, docId) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachId));
    if (docId) {
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
    }
  };

  const handleOpenRename = () => {
    if (!activeConvId) return;
    setRenameTitle(activeConversation?.title || '');
    setRenameModalOpen(true);
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameTitle.trim() || !activeConvId) return;
    try {
      await renameConversation(activeConvId, renameTitle.trim());
      setRenameModalOpen(false);
    } catch (err) {
      setDialogAlert({
        title: 'Rename Failed',
        message: 'Failed to rename conversation. Please try again.',
      });
    }
  };

  const handleCopyMessage = async (msgId, text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (err) {
      console.error('Failed to copy response text:', err);
    }
  };

  const handleExportPdf = async () => {
    if (!activeConvId || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const response = await chatApi.exportPdf(activeConvId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (activeConversation?.title || 'conversation')
        .toLowerCase()
        .replace(/[^a-z0-9_\- ]/gi, '_')
        .trim();
      a.setAttribute('download', `${safeTitle}.pdf`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setDialogAlert({
        title: 'Export Failed',
        message: 'Unable to generate PDF report. Please try again.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadOriginalDoc = async (docId, fallbackName) => {
    if (!docId || docId === 'ref') return;
    try {
      await documentsApi.downloadOriginal(docId, fallbackName);
    } catch (err) {
      console.error('Failed to download document:', err);
      setDialogAlert({
        title: 'Download Failed',
        message: 'Could not download original file. The document may not exist or access was denied.',
      });
    }
  };

  // Ctrl+F / Cmd+F handler to open Find in Chat only when an active conversation has messages
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (activeConvId && messages.length > 0) {
          e.preventDefault();
          setShowFindBar(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeConvId, messages.length]);

  // Reset Find in Chat when switching conversations or starting a new chat
  useEffect(() => {
    setShowFindBar(false);
    setFindQuery('');
    setFindMatches([]);
    setActiveMatchIndex(0);
    if (chatThreadRef.current) {
      removeHighlights(chatThreadRef.current);
    }
  }, [activeConvId]);

  // Update DOM highlights when findQuery, messages, or showFindBar changes
  useEffect(() => {
    if (!showFindBar || !chatThreadRef.current) {
      if (chatThreadRef.current) {
        removeHighlights(chatThreadRef.current);
      }
      setFindMatches([]);
      setActiveMatchIndex(0);
      return;
    }

    const marks = highlightMatchesInContainer(chatThreadRef.current, findQuery);
    setFindMatches(marks);
    if (marks.length > 0) {
      setActiveMatchIndex(0);
      setActiveMatch(marks, 0);
    } else {
      setActiveMatchIndex(0);
    }
  }, [findQuery, showFindBar, messages]);

  const handleFindNext = useCallback(() => {
    if (findMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % findMatches.length;
    setActiveMatchIndex(nextIdx);
    setActiveMatch(findMatches, nextIdx);
  }, [activeMatchIndex, findMatches]);

  const handleFindPrev = useCallback(() => {
    if (findMatches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + findMatches.length) % findMatches.length;
    setActiveMatchIndex(prevIdx);
    setActiveMatch(findMatches, prevIdx);
  }, [activeMatchIndex, findMatches]);

  const handleCloseFind = useCallback(() => {
    setShowFindBar(false);
    setFindQuery('');
    if (chatThreadRef.current) {
      removeHighlights(chatThreadRef.current);
    }
    setFindMatches([]);
  }, []);

  const handleSendMessage = async (textToSend) => {
    const questionText = (textToSend || inputQuestion).trim();
    if (!questionText || isSending) return;

    setInputQuestion('');
    setAttachments([]); // clear temporary chips after sending question

    const userMsg = {
      id: 'temp-user-' + Date.now(),
      role: 'user',
      content: questionText,
      created_at: new Date().toISOString(),
    };

    // Check if any selected document is still processing
    const processingSelected = availableDocs.filter(
      (d) => selectedDocIds.includes(d.id) && (d.status === 'processing' || d.status === 'queued')
    );
    if (processingSelected.length > 0) {
      const docName = processingSelected[0].title || processingSelected[0].filename;
      const warningMsg = {
        id: 'warn-' + Date.now(),
        role: 'assistant',
        content: `**${docName}** is currently being processed and indexed. Please wait a few moments for indexing to finish before asking questions about it.`,
        citations_json: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, warningMsg]);
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const response = await chatApi.sendQuery({
        question: questionText,
        conversation_id: activeConvId || undefined,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });

      // If this was a fresh conversation, register its newly assigned ID
      if (!activeConvId && response.conversation_id) {
        setActiveConvId(response.conversation_id);
      }

      const assistantMsg = {
        id: response.message_id || 'msg-' + Date.now(),
        role: 'assistant',
        content: response.answer,
        citations_json: response.citations || [],
        created_at: new Date().toISOString(),
      };

      setMessages((prev) =>
        prev
          .map((m) =>
            m.id === userMsg.id
              ? { ...m, id: response.user_message_id || m.id }
              : m
          )
          .concat(assistantMsg)
      );
      fetchConversations();
    } catch (err) {
      const errorMsg = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content:
          'Unable to complete your request. Please check your connection and try again.',
        citations_json: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleDocSelection = (docId) => {
    if (selectedDocIds.includes(docId)) {
      setSelectedDocIds(selectedDocIds.filter((id) => id !== docId));
    } else {
      setSelectedDocIds([...selectedDocIds, docId]);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEditedMessage = async (messageId) => {
    const trimmed = editingContent.trim();
    if (!trimmed || isSubmittingEdit) return;

    const currentMsg = messages.find((m) => m.id === messageId);
    if (currentMsg && currentMsg.content.trim() === trimmed) {
      handleCancelEdit();
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const targetIndex = messages.findIndex((m) => m.id === messageId);
      if (targetIndex === -1) {
        handleCancelEdit();
        return;
      }

      // If message ID is temporary, reload conversation first to obtain DB UUID
      let realMsgId = messageId;
      if (typeof messageId === 'string' && messageId.startsWith('temp-user-')) {
        const fullConv = await chatApi.getConversation(activeConvId);
        const matched = fullConv.messages?.find(
          (m) => m.content === currentMsg.content && m.role === 'user'
        );
        if (matched) {
          realMsgId = matched.id;
        }
      }

      const response = await chatApi.editMessage(activeConvId, realMsgId, {
        content: trimmed,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });

      const updatedUserMsg = {
        ...currentMsg,
        id: response.user_message_id || realMsgId,
        content: trimmed,
      };

      const newAssistantMsg = {
        id: response.message_id || 'msg-' + Date.now(),
        role: 'assistant',
        content: response.answer,
        citations_json: response.citations || [],
        created_at: new Date().toISOString(),
      };

      // Truncate message history: retain turns prior to targetIndex + updated message + new assistant response
      const updatedMessages = [
        ...messages.slice(0, targetIndex),
        updatedUserMsg,
        newAssistantMsg,
      ];

      setMessages(updatedMessages);
      handleCancelEdit();
      fetchConversations();
    } catch (err) {
      console.error('Failed to edit message and regenerate response:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Render attachment chips component
  const renderAttachmentChips = () => {
    if (attachments.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 px-2 pb-2">
        {attachments.map((att) => {
          const isImg = ['.png', '.jpg', '.jpeg', '.tiff'].includes(att.ext);
          return (
            <div
              key={att.id}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs border transition ${
                att.status === 'error'
                  ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
                  : att.status === 'uploading'
                  ? 'bg-[#222222] border-[#383838] text-[#cccccc]'
                  : 'bg-[#202020] border-[#333333] text-white'
              }`}
            >
              {isImg ? (
                <ImageIcon className="w-3.5 h-3.5 text-[#a0a0a0] shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#a0a0a0] shrink-0" />
              )}
              <span className="truncate max-w-[130px] font-sans" title={att.name}>
                {att.name}
              </span>
              {att.status === 'uploading' && (
                <span className="flex items-center gap-1 text-[10px] text-[#8e8e8e] font-mono">
                  <Spinner size="sm" />
                  {att.progress}%
                </span>
              )}
              {att.status === 'ready' && (
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
              {att.status === 'error' && (
                <span className="text-[10px] text-rose-400 truncate max-w-[90px]" title={att.error}>
                  {att.error}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(att.id, att.docId)}
                className="text-[#707070] hover:text-white transition p-0.5 rounded cursor-pointer"
                title="Remove attachment"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Render document scope popover dropdown content
  const renderDocScopeDropdownContent = (anchor) => {
    if (docFilterAnchor !== anchor) return null;

    const isUpward = anchor === 'thread';

    return (
      <div
        ref={docFilterRef}
        className={`absolute ${
          isUpward
            ? 'bottom-full mb-2 left-0'
            : anchor === 'header'
            ? 'top-full mt-2 right-0 sm:right-auto sm:left-0'
            : 'top-full mt-2 left-0'
        } w-80 max-w-[90vw] bg-[#1c1c1c] rounded-xl shadow-2xl border border-[#2e2e2e] p-3 z-50 animate-slide-up select-none`}
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#282828] text-xs font-heading font-semibold text-white px-1">
          <span>Scope to Indexed Documents</span>
          {selectedDocIds.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDocIds([]);
              }}
              className="text-[11px] text-[#8e8e8e] hover:text-white hover:underline cursor-pointer"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* All Documents option (unscoped) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDocIds([]);
            setDocFilterAnchor(null);
          }}
          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition mb-1 ${
            selectedDocIds.length === 0
              ? 'bg-[#2a2a2a] text-white font-medium'
              : 'hover:bg-[#222222] text-[#a0a0a0]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-white/70" />
            <span>All Documents (unscoped)</span>
          </div>
          {selectedDocIds.length === 0 && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {availableDocs.length === 0 ? (
            <div className="p-3 text-center text-xs text-[#8e8e8e] font-sans">
              <p>No documents uploaded yet.</p>
              <p className="text-[11px] text-[#666666] mt-1">
                Upload documents via the + button or the Documents page.
              </p>
            </div>
          ) : (
            availableDocs.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              const isProcessing = doc.status === 'processing' || doc.status === 'queued';
              const isFailed = doc.status === 'failed';
              return (
                <div
                  key={doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDocSelection(doc.id);
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#2a2a2a] text-white font-medium'
                      : 'hover:bg-[#222222] text-[#a0a0a0]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate pr-2 font-sans min-w-0">
                    <span className="truncate">{doc.title || doc.filename}</span>
                    {isProcessing && (
                      <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                        Processing...
                      </span>
                    )}
                    {isFailed && (
                      <span className="text-[10px] text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded shrink-0">
                        Failed
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121212] overflow-hidden relative font-sans">
      {/* Top Header Controls Bar - shown during active conversation */}
      {messages.length > 0 ? (
        <div className="h-11 w-full px-4 sm:px-6 flex items-center justify-between border-b border-[#202020] bg-[#121212] shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                className="hidden md:flex p-1.5 -ml-1 mr-1 rounded-lg text-[#757575] hover:text-[#d4d4d4] hover:bg-[#20201f] transition cursor-pointer shrink-0"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <span className="font-medium text-[13px] text-[#ededed] truncate">
              {activeConversation?.title || 'Playground'}
            </span>
            {activeConvId && (
              <button
                onClick={handleOpenRename}
                className="p-1 rounded text-[#707070] hover:text-[#f0f0f0] transition cursor-pointer"
                title="Rename conversation"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Right Controls: Find, Share, PDF Export & Document Scope Filter */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop Action Buttons: Find, Share, PDF Export */}
            <div className="hidden sm:flex items-center gap-2">
              {/* Find in Chat Button */}
              <button
                onClick={() => setShowFindBar(!showFindBar)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-medium transition cursor-pointer select-none ${
                  showFindBar
                    ? 'bg-[#262626] border-[#383838] text-white'
                    : 'border-[#262626] bg-[#1a1a1a] hover:bg-[#242424] text-[#8a8a8a] hover:text-white'
                }`}
                title="Find in conversation (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5 text-white/80" />
                <span>Find</span>
                <span className="text-[9px] bg-[#222222] text-[#8e8e8e] px-1 py-0.5 rounded font-mono border border-[#2e2e2e]">
                  Ctrl F
                </span>
              </button>

              {/* Share Conversation Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#262626] bg-[#1a1a1a] hover:bg-[#242424] text-[12px] font-medium text-[#8a8a8a] hover:text-white transition cursor-pointer"
                title="Share conversation link"
              >
                <Share2 className="w-3.5 h-3.5 text-white/80" />
                <span>Share</span>
              </button>

              {/* PDF Export Button */}
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#262626] bg-[#1a1a1a] hover:bg-[#242424] text-[12px] font-medium text-[#8a8a8a] hover:text-white transition cursor-pointer disabled:opacity-40"
                title="Download entire conversation as PDF"
              >
                {isExportingPdf ? (
                  <>
                    <Spinner size="sm" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-white/80" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>

            {/* Mobile Actions Dropdown Trigger (...) */}
            <div className="relative sm:hidden" ref={mobileActionsMenuRef}>
              <button
                type="button"
                onClick={() => setShowMobileActionsMenu((prev) => !prev)}
                className="p-1.5 rounded-lg border border-[#262626] bg-[#1a1a1a] text-[#8a8a8a] hover:text-white transition cursor-pointer"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMobileActionsMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-2xl p-1.5 z-50 animate-slide-up">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileActionsMenu(false);
                      setShowFindBar(!showFindBar);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#d4d4d4] hover:bg-[#282828] hover:text-white transition text-left cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-white/80" />
                    <span>Find in Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileActionsMenu(false);
                      setShowShareModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#d4d4d4] hover:bg-[#282828] hover:text-white transition text-left cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-white/80" />
                    <span>Share Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileActionsMenu(false);
                      handleExportPdf();
                    }}
                    disabled={isExportingPdf}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#d4d4d4] hover:bg-[#282828] hover:text-white transition text-left cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-white/80" />
                    <span>{isExportingPdf ? 'Exporting...' : 'Download PDF'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Document Scope Selector in Header */}
            <div className="relative">
              <button
                type="button"
                data-doc-filter-toggle="true"
                onClick={() => {
                  fetchDocuments();
                  setDocFilterAnchor((prev) => (prev === 'header' ? null : 'header'));
                }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg border text-[12px] font-sans font-medium transition cursor-pointer select-none ${
                  selectedDocIds.length > 0 || docFilterAnchor === 'header'
                    ? 'bg-[#242424] border-white/20 text-white'
                    : 'border-[#262626] bg-[#1a1a1a] hover:bg-[#242424] text-[#a3a3a3] hover:text-white'
                }`}
                title="Filter query retrieval to specific indexed documents"
              >
                <Folder className="w-3.5 h-3.5 text-white/80" />
                <span className="hidden sm:inline">
                  {selectedDocIds.length === 0
                    ? 'All Documents'
                    : `${selectedDocIds.length} Selected`}
                </span>
                <span className="sm:hidden font-mono text-[11px]">
                  {selectedDocIds.length === 0 ? 'All' : selectedDocIds.length}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-[#8e8e8e] transition-transform duration-200 ${
                    docFilterAnchor === 'header' ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {renderDocScopeDropdownContent('header')}
            </div>
          </div>
        </div>
      ) : (
        /* Seamless borderless landing header matching Kimi */
        <div className="h-10 w-full px-4 flex items-center justify-between shrink-0 z-20">
          <div>
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                className="hidden md:flex p-1.5 rounded-lg text-[#757575] hover:text-[#d4d4d4] hover:bg-[#20201f] transition cursor-pointer shrink-0"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Viewport */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Find In Chat Bar Overlay - conversation-specific only */}
          {showFindBar && activeConvId && messages.length > 0 && (
            <FindInChatBar
              isOpen={showFindBar}
              query={findQuery}
              onQueryChange={setFindQuery}
              totalMatches={findMatches.length}
              activeIndex={activeMatchIndex}
              onNext={handleFindNext}
              onPrev={handleFindPrev}
              onClose={handleCloseFind}
            />
          )}

          {messages.length === 0 ? (
            /* ======================================================== */
            /* LANDING FRESH STATE                                      */
            /* ======================================================== */
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 sm:px-6 py-8">
              <div className="w-full max-w-[680px] flex flex-col items-center text-center space-y-5">
                {/* Minimalist Docvyn Identity Logo */}
                <div className="mb-2 transition-transform hover:scale-105 duration-200">
                  <DocvynLogo width="160" height="42" className="text-white fill-white" />
                </div>

                <p className="font-sans text-xs sm:text-sm text-[#8e8e8e] max-w-md leading-relaxed">
                  Ask grounded questions across your PDFs, Word documents, and high-resolution images.
                </p>

                {/* Main Prominent Landing Composer */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingLanding(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingLanding(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingLanding(false);
                    if (e.dataTransfer.files?.length) {
                      processFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`w-full rounded-[16px] bg-[#1f1f1f] border p-4 shadow-xl transition-all duration-200 text-left ${
                    isDraggingLanding
                      ? 'border-white/40 bg-[#252525]'
                      : 'border-[#2f2f2f] hover:border-[#3a3a3a] focus-within:border-[#454545]'
                  }`}
                >
                  {/* Hidden file input for Landing Composer */}
                  <input
                    ref={fileInputRefLanding}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.png,.jpg,.jpeg,.tiff"
                    onChange={(e) => {
                      processFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  {/* Render Removable Attachment Chips */}
                  {renderAttachmentChips()}

                  {/* Input Prompt */}
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask anything, or attach documents..."
                    className="w-full bg-transparent text-[13.5px] font-normal text-[#ededed] placeholder-[#666666] outline-none resize-none px-1 py-1 leading-relaxed"
                  />

                  {/* Speech to text active status / error banners */}
                  {isListening && (
                    <div className="flex items-center gap-2 mt-2 px-2 py-1 rounded bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                      <span>Listening... speak now. Click microphone to finish.</span>
                    </div>
                  )}
                  {speechError && (
                    <div className="flex items-center justify-between mt-2 px-2 py-1 rounded bg-rose-950/40 border border-rose-900/60 text-[11px] text-rose-300">
                      <span>{speechError}</span>
                      <button
                        type="button"
                        onClick={() => setSpeechError(null)}
                        className="text-rose-400 hover:text-white ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Dock Controls Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]/60 mt-1">
                    <div className="flex items-center gap-2">
                      {/* Plus (+) Attachment Button -> Real File Picker */}
                      <button
                        type="button"
                        onClick={() => fileInputRefLanding.current?.click()}
                        title="Attach files (PDF, DOCX, PNG, JPEG, TIFF)"
                        className="w-7 h-7 rounded-full bg-[#282828] hover:bg-[#323232] text-[#8e8e8e] hover:text-[#d4d4d4] flex items-center justify-center transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[1.75]" />
                      </button>

                      {/* Scoped Document Pill -> Scope selector */}
                      <div className="relative">
                        <button
                          type="button"
                          data-doc-filter-toggle="true"
                          onClick={() => {
                            fetchDocuments();
                            setDocFilterAnchor((prev) => (prev === 'landing' ? null : 'landing'));
                          }}
                          className={`px-3 py-1 rounded-full border text-[12px] font-normal flex items-center gap-1.5 transition cursor-pointer ${
                            selectedDocIds.length > 0 || docFilterAnchor === 'landing'
                              ? 'bg-[#2e2e2e] border-white/20 text-white'
                              : 'bg-[#262626] hover:bg-[#303030] border-[#333333] text-[#999999] hover:text-[#d4d4d4]'
                          }`}
                          title="Scope query to indexed documents"
                        >
                          <Folder className="w-3.5 h-3.5 text-[#888888]" />
                          <span>
                            {selectedDocIds.length > 0
                              ? `${selectedDocIds.length} Docs`
                              : 'All documents'}
                          </span>
                          <ChevronDown
                            className={`w-3 h-3 text-[#707070] transition-transform duration-200 ${
                              docFilterAnchor === 'landing' ? 'rotate-180 text-white' : ''
                            }`}
                          />
                        </button>

                        {renderDocScopeDropdownContent('landing')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Speech to text microphone button */}
                      <button
                        type="button"
                        onClick={toggleListening}
                        title={
                          !isSpeechSupported
                            ? 'Speech recognition is not supported in this browser'
                            : isListening
                            ? 'Listening... click to stop'
                            : 'Voice input (Speech to text)'
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
                          isListening
                            ? 'bg-rose-600 text-white animate-pulse shadow-md'
                            : 'bg-[#262626] hover:bg-[#303030] text-[#787878] hover:text-[#d4d4d4]'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5 stroke-[1.75]" />
                      </button>

                      {/* Upward Send Button */}
                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        disabled={!inputQuestion.trim() && attachments.length === 0}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 shrink-0 ${
                          inputQuestion.trim() || attachments.length > 0
                            ? 'bg-white hover:bg-neutral-200 text-black shadow-md cursor-pointer active:scale-95'
                            : 'bg-[#262626] text-[#4d4d4d] cursor-not-allowed'
                        }`}
                      >
                        {isSending ? (
                          <Spinner size="sm" />
                        ) : (
                          <ArrowUp className="w-3.5 h-3.5 stroke-[2.2]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Disclaimer Footer matching Kimi */}
                <div className="text-[11px] font-normal text-[#4d4d4d] text-center pt-8 select-none">
                  AI-generated, for reference only • docvyn
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* ACTIVE CONVERSATION THREAD                               */
            /* ======================================================== */
            <div
              ref={chatThreadRef}
              className="flex-1 overflow-y-auto w-full select-text relative"
            >
              <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                {/* Archived Conversation Read-only Banner */}
                {activeConversation?.is_archived && (
                  <div className="bg-[#1c1800] border border-amber-900/60 rounded-xl p-3 flex items-center justify-between text-xs text-amber-200 select-none">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Archived conversation:</span>
                      <span>This conversation is read-only unless restored from the sidebar.</span>
                    </div>
                  </div>
                )}

                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const msgId = msg.id || index;
                  const isCopied = copiedMsgId === msgId;

                  return (
                    <div
                      key={msgId}
                      className={`flex flex-col animate-slide-up w-full min-w-0 ${
                        isUser ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 sm:gap-3 max-w-3xl w-full min-w-0">
                        {!isUser && (
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#242424] text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-1 border border-[#333333] select-none text-[11px] sm:text-xs font-bold font-aleo">
                            d
                          </div>
                        )}

                        <div
                          className={`w-full min-w-0 select-text ${
                            isUser ? 'ml-auto max-w-[85%] sm:max-w-2xl flex flex-col items-end group' : ''
                          }`}
                        >
                          {isUser ? (
                            editingMessageId === msgId ? (
                              /* Inline Edit Mode (matching ChatGPT) */
                              <div className="w-full flex flex-col gap-2.5 rounded-2xl bg-[#222222] border border-[#383838] p-3 sm:p-3.5 shadow-sm text-left">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveEditedMessage(msgId);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      handleCancelEdit();
                                    }
                                  }}
                                  rows={Math.max(2, editingContent.split('\n').length)}
                                  className="w-full bg-[#181817] border border-[#383838] focus:border-[#555555] rounded-xl p-2.5 sm:p-3 text-sm text-white outline-none resize-none leading-relaxed font-sans"
                                  autoFocus
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={isSubmittingEdit}
                                    className="px-3 py-1.5 rounded-lg text-xs font-normal text-[#8e8e8e] hover:text-white hover:bg-[#282828] transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedMessage(msgId)}
                                    disabled={!editingContent.trim() || isSubmittingEdit}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                                      editingContent.trim() && !isSubmittingEdit
                                        ? 'bg-white hover:bg-neutral-200 text-black shadow'
                                        : 'bg-[#282828] text-[#555555] cursor-not-allowed'
                                    }`}
                                  >
                                    {isSubmittingEdit ? (
                                      <>
                                        <Spinner size="sm" />
                                        <span>Regenerating...</span>
                                      </>
                                    ) : (
                                      <span>Save & Submit</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Normal User Message Display: Bubble + Outside Action Buttons Below (Image 2) */
                              <div className="flex flex-col items-end w-full min-w-0">
                                <div className="rounded-3xl sm:rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3.5 text-sm leading-relaxed shadow-sm w-full select-text bg-[#262626] sm:bg-[#222222] border border-[#333333] sm:border-[#2e2e2e] text-white rounded-br-sm sm:rounded-tr-sm text-left break-words">
                                  <p className="whitespace-pre-wrap font-sans text-sm select-text text-white break-words">
                                    {msg.content}
                                  </p>
                                </div>

                                {/* Actions OUTSIDE below the user message bubble (matching Image 2) */}
                                {!activeConversation?.is_archived && (
                                  <div className="flex items-center gap-3 pt-1.5 pr-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity select-none">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(msg)}
                                      className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-white transition cursor-pointer"
                                      title="Edit message and regenerate response"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyMessage(msgId, msg.content)}
                                      className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-white transition cursor-pointer"
                                      title="Copy message"
                                    >
                                      {isCopied ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          <span className="text-emerald-400">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          ) : (
                            <div className="rounded-2xl p-0 sm:px-5 sm:py-3.5 text-sm leading-relaxed shadow-none sm:shadow-sm w-full min-w-0 max-w-full select-text bg-transparent sm:bg-[#1a1a1a] border-0 sm:border border-transparent sm:border-[#262626] text-[#ededed] text-left break-words">
                              {/* Assistant Markdown Renderer */}
                              <div className="w-full min-w-0 max-w-full overflow-hidden break-words">
                                <MarkdownRenderer content={msg.content} />
                              </div>

                              {/* Response Actions Bar (Unobtrusive Copy button) */}
                              <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[#222222] sm:border-[#262626] select-none">
                                <span className="text-[10px] text-[#707070] font-mono">
                                  {msg.created_at
                                    ? new Date(msg.created_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : ''}
                                </span>

                                <button
                                  onClick={() => handleCopyMessage(msgId, msg.content)}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[#8e8e8e] hover:text-white hover:bg-[#202020] text-xs transition cursor-pointer"
                                  title="Copy response to clipboard"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-400 font-sans text-xs">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span className="font-sans text-xs">Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <div className="hidden sm:flex w-7 h-7 rounded-full bg-[#222222] text-[#8e8e8e] items-center justify-center shrink-0 mt-1 select-none border border-[#2c2c2c]">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                    {/* Grounded Citations with Download Action */}
                    {!isUser && msg.citations_json && msg.citations_json.length > 0 && (
                      <div className="mt-3 pl-8 sm:pl-10 max-w-3xl w-full min-w-0 select-text">
                        <p className="font-sans text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
                          <Bookmark className="w-3.5 h-3.5 text-white/80" />
                          <span>Sources ({msg.citations_json.length})</span>
                        </p>
                        <div className="flex sm:grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 snap-x scrollbar-thin">
                          {msg.citations_json.map((citation, citIdx) => (
                            <div
                              key={citIdx}
                              className="min-w-[260px] sm:min-w-0 snap-start shrink-0 sm:shrink bg-[#1a1a1a] border border-[#282828] hover:border-[#383838] p-3 rounded-xl transition shadow-sm group select-text"
                            >
                              <div className="flex items-center justify-between gap-2 select-none">
                                <span className="text-[10px] font-semibold tracking-wider text-white bg-[#262626] px-2 py-0.5 rounded border border-[#333333]">
                                  Source {citIdx + 1}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {citation.page_number && (
                                    <span className="text-[11px] text-[#707070]">
                                      Page {citation.page_number}
                                    </span>
                                  )}
                                  {citation.document_id && citation.document_id !== 'ref' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadOriginalDoc(
                                          citation.document_id,
                                          citation.document_title
                                        );
                                      }}
                                      title="Download original uploaded file"
                                      className="p-1 rounded text-[#707070] hover:text-white hover:bg-[#282828] transition cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p
                                onClick={() => setSelectedCitation(citation)}
                                className="font-heading font-medium text-xs text-white mt-2 truncate group-hover:text-white transition cursor-pointer select-text"
                              >
                                {citation.document_title}
                              </p>
                              <p
                                onClick={() => setSelectedCitation(citation)}
                                className="font-sans text-[11px] text-[#8e8e8e] mt-1 line-clamp-2 leading-relaxed cursor-pointer select-text"
                              >
                                {citation.snippet}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-center gap-3 text-[#8e8e8e] text-xs font-medium pl-10 animate-fade-in select-none">
                  <Spinner size="sm" />
                  <span className="font-sans text-[12px] text-[#a0a0a0]">
                    Searching your documents and generating response...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

          {/* Floating Bottom Dock (when in active chat thread) */}
          {messages.length > 0 && (
            <div className="p-2.5 sm:p-4 bg-[#121212] border-t border-[#202020] shrink-0">
              <div className="max-w-4xl mx-auto">
                {isListening && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 font-sans animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                    <span>Listening... speak clearly. Click microphone to stop.</span>
                  </div>
                )}
                {speechError && (
                  <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 font-sans">
                    <span>{speechError}</span>
                    <button
                      type="button"
                      onClick={() => setSpeechError(null)}
                      className="text-rose-400 hover:text-white ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Scoped Document Indicator (Mobile Chip) */}
                {selectedDocIds.length > 0 && (
                  <div className="sm:hidden flex items-center justify-between text-[11px] text-[#a0a0a0] mb-2 px-2.5 py-1 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Folder className="w-3 h-3 text-white/80 shrink-0" />
                      <span className="truncate">
                        Scoped to {selectedDocIds.length} doc{selectedDocIds.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDocIds([])}
                      className="text-[11px] text-[#8e8e8e] hover:text-white ml-2 shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Thread Composer Container */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingThread(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingThread(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingThread(false);
                    if (e.dataTransfer.files?.length) {
                      processFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`rounded-3xl sm:rounded-2xl bg-[#1e1e1e] sm:bg-[#1f1f1f] border shadow-xl p-2 sm:p-3 transition-all ${
                    isDraggingThread
                      ? 'border-white bg-[#262626]'
                      : 'border-[#2d2d2d] focus-within:border-[#424242]'
                  }`}
                >
                  {/* Hidden file input for Thread Composer */}
                  <input
                    ref={fileInputRefThread}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.png,.jpg,.jpeg,.tiff"
                    onChange={(e) => {
                      processFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  {/* Render Removable Attachment Chips */}
                  {renderAttachmentChips()}

                  <div className="flex items-center gap-1.5 sm:gap-2.5">
                    {/* Plus (+) Button -> Real File Picker */}
                    <button
                      type="button"
                      onClick={() => fileInputRefThread.current?.click()}
                      title="Attach documents or images"
                      className="w-7 h-7 rounded-full bg-[#2a2a2a] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* Scoped Document Pill on Desktop */}
                    <div className="relative shrink-0 hidden sm:block">
                      <button
                        type="button"
                        data-doc-filter-toggle="true"
                        onClick={() => {
                          fetchDocuments();
                          setDocFilterAnchor((prev) => (prev === 'thread' ? null : 'thread'));
                        }}
                        className={`px-2.5 py-1 rounded-full border text-[12px] font-sans flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                          selectedDocIds.length > 0 || docFilterAnchor === 'thread'
                            ? 'bg-[#2e2e2e] border-white/20 text-white'
                            : 'bg-[#282828] hover:bg-[#333333] border-[#333333] text-[#a0a0a0] hover:text-white'
                        }`}
                        title="Scope query to indexed documents"
                      >
                        <Folder className="w-3 h-3 text-white/80" />
                        <span>
                          {selectedDocIds.length > 0
                            ? `${selectedDocIds.length} Docs`
                            : 'All documents'}
                        </span>
                        <ChevronUp
                          className={`w-3 h-3 text-[#707070] transition-transform duration-200 ${
                            docFilterAnchor === 'thread' ? 'rotate-180 text-white' : ''
                          }`}
                        />
                      </button>

                      {renderDocScopeDropdownContent('thread')}
                    </div>

                    <textarea
                      rows={1}
                      value={inputQuestion}
                      onChange={(e) => setInputQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask docvyn..."
                      className="font-sans flex-1 min-w-0 bg-transparent text-[14px] text-[#ededed] placeholder-[#737373] outline-none resize-none px-2 py-1 leading-normal"
                    />

                    {/* Speech to text microphone button */}
                    <button
                      type="button"
                      onClick={toggleListening}
                      title={
                        !isSpeechSupported
                          ? 'Speech recognition is not supported in this browser'
                          : isListening
                          ? 'Listening... click to stop'
                          : 'Voice input (Speech to text)'
                      }
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
                        isListening
                          ? 'bg-rose-600 text-white animate-pulse shadow-md'
                          : 'bg-[#2a2a2a] hover:bg-[#333333] text-[#8e8e8e] hover:text-white'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputQuestion.trim() && attachments.length === 0}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 shrink-0 ${
                        inputQuestion.trim() || attachments.length > 0
                          ? 'bg-white hover:bg-neutral-200 text-black shadow-md cursor-pointer active:scale-95'
                          : 'bg-[#2a2a2a] text-[#555555] cursor-not-allowed'
                      }`}
                    >
                      {isSending ? (
                        <Spinner size="sm" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rename Conversation Modal */}
      {renameModalOpen && (
        <Modal
          isOpen={renameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          title="Rename Conversation"
        >
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#555555] outline-none"
              placeholder="Conversation title"
              required
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRenameModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Citation Detail Modal with Download Original Document */}
      {selectedCitation && (
        <Modal
          isOpen={Boolean(selectedCitation)}
          onClose={() => setSelectedCitation(null)}
          title={selectedCitation.document_title || 'Document Source'}
        >
          <div className="space-y-3 font-sans text-xs text-[#a0a0a0]">
            {selectedCitation.page_number && (
              <div className="text-[#8e8e8e]">
                Found on page <strong className="text-white">{selectedCitation.page_number}</strong>
              </div>
            )}
            <div className="p-3.5 rounded-xl bg-[#161616] border border-[#282828] text-[#d4d4d4] leading-relaxed select-text">
              "{selectedCitation.snippet}"
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#242424]">
              {selectedCitation.document_id && selectedCitation.document_id !== 'ref' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleDownloadOriginalDoc(
                      selectedCitation.document_id,
                      selectedCitation.document_title
                    )
                  }
                  className="flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Original Document</span>
                </Button>
              ) : (
                <div />
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCitation(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Share Conversation Modal */}
      {showShareModal && (
        <ShareConversationModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          conversationId={activeConvId}
          conversationTitle={activeConversation?.title || 'Conversation'}
          messages={messages}
        />
      )}

      {/* Archived Conversations Modal */}
      {showArchivedModal && (
        <ArchivedModal
          isOpen={showArchivedModal}
          onClose={() => setShowArchivedModal(false)}
          onSelectConversation={(id) => selectConversation(id)}
        />
      )}

      {/* Error / Notice Dialog Alert Modal */}
      {dialogAlert && (
        <ConfirmationModal
          isOpen={Boolean(dialogAlert)}
          onClose={() => setDialogAlert(null)}
          title={dialogAlert.title}
          message={dialogAlert.message}
          type="error"
        />
      )}
    </div>
  );
}

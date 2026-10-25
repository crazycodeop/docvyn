import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Archive, RotateCcw, MessageSquare, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import ConfirmationModal from '../common/ConfirmationModal';
import { chatApi } from '../../api/chat';
import { useChat } from '../../context/ChatContext';

export default function ArchivedModal({ isOpen, onClose, onSelectConversation }) {
  const { restoreConversation, deleteConversation } = useChat();
  const [archivedList, setArchivedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  const loadArchived = async () => {
    setLoading(true);
    try {
      const data = await chatApi.getArchivedConversations();
      setArchivedList(data || []);
    } catch (err) {
      console.error('Failed to load archived conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadArchived();
    }
  }, [isOpen]);

  const handleRestore = async (e, convId) => {
    e.stopPropagation();
    setRestoringId(convId);
    try {
      await restoreConversation(convId);
      setArchivedList((prev) => prev.filter((c) => c.id !== convId));
    } catch (err) {
      setErrorNotice('Failed to restore conversation. Please try again.');
    } finally {
      setRestoringId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteConversation(deleteTarget.id);
      setArchivedList((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setErrorNotice('Failed to delete conversation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpen = (convId) => {
    if (onSelectConversation) {
      onSelectConversation(convId);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Archived Conversations">
      <div className="space-y-3 font-sans">
        <p className="text-xs text-[#8e8e8e]">
          Archived conversations are hidden from your active chats list. Their messages, citations, and document references are fully preserved.
        </p>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-[#8e8e8e]">
            <Spinner size="md" />
          </div>
        ) : archivedList.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#707070] space-y-1">
            <Archive className="w-6 h-6 mx-auto text-[#555555] stroke-[1.5]" />
            <p>No archived conversations</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {archivedList.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleOpen(conv.id)}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#262626] cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <MessageSquare className="w-4 h-4 text-[#707070] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {conv.title || 'Untitled chat'}
                    </p>
                    <p className="text-[10px] text-[#707070]">
                      {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : ''} · {conv.message_count || 0} messages
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleRestore(e, conv.id)}
                    disabled={restoringId === conv.id}
                    title="Restore conversation to active chats"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#262626] hover:bg-[#333333] text-[11px] text-[#d4d4d4] hover:text-white transition cursor-pointer"
                  >
                    {restoringId === conv.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <RotateCcw className="w-3 h-3 text-white/80" />
                    )}
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(conv);
                    }}
                    title="Permanently delete"
                    className="p-1 rounded-lg text-[#707070] hover:text-rose-400 hover:bg-[#262626] transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#242424]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmationModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => !isDeleting && setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Delete Archived Chat"
          message={`Are you sure you want to permanently delete "${deleteTarget.title || 'this conversation'}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          isLoading={isDeleting}
        />
      )}

      {/* Error Alert Modal */}
      {errorNotice && (
        <ConfirmationModal
          isOpen={Boolean(errorNotice)}
          onClose={() => setErrorNotice(null)}
          title="Notice"
          message={errorNotice}
          type="error"
        />
      )}
    </Modal>
  );
}

ArchivedModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectConversation: PropTypes.func,
};

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Share2, Link as LinkIcon, Check, Trash2, Eye, ShieldCheck } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import ConfirmationModal from '../common/ConfirmationModal';
import { chatApi } from '../../api/chat';

export default function ShareConversationModal({
  isOpen,
  onClose,
  conversationId,
  conversationTitle = 'Conversation',
  messages = [],
}) {
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState([]);
  const [shareFull, setShareFull] = useState(true);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState(null);

  useEffect(() => {
    if (isOpen && conversationId) {
      loadExistingShare();
      setSelectedMsgIds(messages.map((m) => m.id));
      setShareFull(true);
    }
  }, [isOpen, conversationId, messages]);

  const loadExistingShare = async () => {
    setLoading(true);
    try {
      const data = await chatApi.getShare(conversationId);
      setShareData(data || null);
    } catch (err) {
      console.error('Failed to check share status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    setCreating(true);
    try {
      const payload = {
        title: conversationTitle,
        message_ids: shareFull ? [] : selectedMsgIds,
      };
      const created = await chatApi.createShare(conversationId, payload);
      setShareData(created);
    } catch (err) {
      setErrorModalMsg('Failed to generate share link. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const confirmRevokeShare = async () => {
    setLoading(true);
    setShowRevokeConfirm(false);
    try {
      await chatApi.revokeShare(conversationId);
      setShareData(null);
    } catch (err) {
      setErrorModalMsg('Failed to revoke share link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fullShareUrl = shareData
    ? `${window.location.origin}${shareData.share_url}`
    : '';

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullShareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullShareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy link error:', err);
    }
  };

  const toggleMsgSelection = (msgId) => {
    if (selectedMsgIds.includes(msgId)) {
      if (selectedMsgIds.length === 1) return; // keep at least 1
      setSelectedMsgIds(selectedMsgIds.filter((id) => id !== msgId));
    } else {
      setSelectedMsgIds([...selectedMsgIds, msgId]);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Conversation">
      <div className="space-y-4 font-sans text-xs text-[#a0a0a0]">
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#181818] border border-[#262626]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-semibold text-white">Read-only & Secure: </span>
            Visitors can read the conversation and citations, but cannot send questions, download your original files, or modify chat history.
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Spinner size="md" />
          </div>
        ) : shareData && !shareData.is_revoked ? (
          /* Active Share State */
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#8e8e8e] mb-1.5">
                Share Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={fullShareUrl}
                  className="w-full bg-[#161616] border border-[#2e2e2e] rounded-xl px-3 py-2 text-xs text-white font-mono select-all outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={copied ? Check : LinkIcon}
                  onClick={handleCopyLink}
                  className="shrink-0 whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#242424]">
              <span className="text-[11px] text-[#707070]">
                Link created on {new Date(shareData.created_at).toLocaleDateString()}
              </span>
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Revoke Link</span>
              </button>
            </div>
          </div>
        ) : (
          /* Create Share Link State */
          <div className="space-y-3">
            <div>
              <p className="font-medium text-white text-xs mb-1">
                Conversation: <span className="font-semibold">{conversationTitle}</span>
              </p>
              <p className="text-[11px] text-[#8e8e8e]">
                {messages.length} messages in this thread
              </p>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-medium text-[#d4d4d4] block">
                Messages to share:
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white">
                  <input
                    type="radio"
                    name="shareScope"
                    checked={shareFull}
                    onChange={() => setShareFull(true)}
                    className="accent-white"
                  />
                  <span>Entire conversation</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white">
                  <input
                    type="radio"
                    name="shareScope"
                    checked={!shareFull}
                    onChange={() => setShareFull(false)}
                    className="accent-white"
                  />
                  <span>Select messages ({selectedMsgIds.length})</span>
                </label>
              </div>
            </div>

            {!shareFull && (
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl bg-[#161616] border border-[#242424]">
                {messages.map((m, idx) => {
                  const isSelected = selectedMsgIds.includes(m.id);
                  return (
                    <div
                      key={m.id || idx}
                      onClick={() => toggleMsgSelection(m.id)}
                      className={`p-2 rounded-lg text-xs cursor-pointer flex items-start gap-2 transition ${
                        isSelected
                          ? 'bg-[#242424] text-white'
                          : 'opacity-50 hover:opacity-80 text-[#8e8e8e]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 accent-white"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-[10px] uppercase text-[#707070]">
                          {m.role}:{' '}
                        </span>
                        <span className="truncate block font-sans">{m.content}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#242424]">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Share2}
                isLoading={creating}
                onClick={handleCreateShare}
                disabled={creating || (!shareFull && selectedMsgIds.length === 0)}
                className="whitespace-nowrap"
              >
                Create Share Link
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Revoke Confirmation Modal */}
      {showRevokeConfirm && (
        <ConfirmationModal
          isOpen={showRevokeConfirm}
          onClose={() => setShowRevokeConfirm(false)}
          onConfirm={confirmRevokeShare}
          title="Revoke Share Link"
          message="Are you sure you want to revoke this link? Anyone with the link will immediately lose access to this conversation."
          confirmText="Revoke Link"
          variant="danger"
          isLoading={loading}
        />
      )}

      {/* Error Alert Modal */}
      {errorModalMsg && (
        <ConfirmationModal
          isOpen={Boolean(errorModalMsg)}
          onClose={() => setErrorModalMsg(null)}
          title="Notice"
          message={errorModalMsg}
          type="error"
        />
      )}
    </Modal>
  );
}

ShareConversationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  conversationId: PropTypes.string,
  conversationTitle: PropTypes.string,
  messages: PropTypes.array,
};

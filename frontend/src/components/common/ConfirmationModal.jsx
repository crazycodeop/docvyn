import React from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'primary'
  type = 'confirm', // 'confirm' | 'error' | 'info'
  isLoading = false,
}) {
  const isAlert = !onConfirm || type === 'error' || type === 'info';

  const getIcon = () => {
    if (variant === 'danger' || type === 'error') {
      return (
        <div className="w-10 h-10 rounded-full bg-rose-950/50 border border-rose-900/60 text-rose-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-[#242424] border border-[#333333] text-white flex items-center justify-center shrink-0">
        <Info className="w-5 h-5" />
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-[#cccccc] leading-relaxed select-text font-sans">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-[#262626]">
          {isAlert ? (
            <Button variant="secondary" size="sm" onClick={onClose}>
              Dismiss
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <Button
                variant={variant}
                size="sm"
                onClick={onConfirm}
                isLoading={isLoading}
                disabled={isLoading}
              >
                {confirmText}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.string,
  type: PropTypes.string,
  isLoading: PropTypes.bool,
};

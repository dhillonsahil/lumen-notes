import React, { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, RotateCcw, Info } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  icon?: 'trash' | 'warning' | 'restore' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  icon = 'trash',
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when opened
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const renderIcon = () => {
    switch (icon) {
      case 'trash':
        return <Trash2 size={22} className="confirm-modal-icon-svg" />;
      case 'warning':
        return <AlertTriangle size={22} className="confirm-modal-icon-svg" />;
      case 'restore':
        return <RotateCcw size={22} className="confirm-modal-icon-svg" />;
      case 'info':
      default:
        return <Info size={22} className="confirm-modal-icon-svg" />;
    }
  };

  return (
    <div
      className="confirm-modal-backdrop"
      onClick={onCancel}
      data-testid="confirm-modal-backdrop"
      role="presentation"
    >
      <div
        className="confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        data-testid="confirm-modal"
      >
        <div className={`confirm-modal-icon-wrapper ${isDestructive ? 'is-destructive' : 'is-neutral'}`}>
          {renderIcon()}
        </div>

        <h3 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h3>

        <p id="confirm-modal-message" className="confirm-modal-message">
          {message}
        </p>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-btn confirm-modal-btn-cancel"
            onClick={onCancel}
            data-testid="confirm-modal-cancel"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`confirm-modal-btn ${
              isDestructive ? 'confirm-modal-btn-destructive' : 'confirm-modal-btn-primary'
            }`}
            onClick={onConfirm}
            data-testid="confirm-modal-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Optional description below title */
  description?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Placement variant. mobile-sheet anchors to the bottom on phones and centers on larger screens. */
  placement?: 'center' | 'mobile-sheet';
  /** Whether clicking backdrop closes modal */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Optional footer content (action buttons) */
  footer?: React.ReactNode;
  /** Additional className for the modal content panel */
  className?: string;
  /** Override body layout for a dialog with its own scrolling region. */
  bodyClassName?: string;
  /** Keep a phone search sheet above the software keyboard. */
  fitVisualViewport?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  placement = 'center',
  closeOnBackdrop = true,
  closeOnEscape = true,
  footer,
  className = '',
  bodyClassName = '',
  fitVisualViewport = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useId();
  const titleId = title ? generatedTitleId : undefined;

  useEffect(() => {
    const viewport = window.visualViewport;
    const container = containerRef.current;
    const panel = panelRef.current;
    if (!open || !fitVisualViewport || !viewport || !container || !panel) return;
    // Dynamic viewport units alone do not track the iOS software keyboard.
    const update = () => {
      const phone = viewport.width < 640;
      container.style.height = phone ? `${viewport.height}px` : '';
      container.style.top = phone ? `${viewport.offsetTop}px` : '';
      container.style.bottom = phone ? 'auto' : '';
      panel.style.maxHeight = phone ? `${Math.max(0, viewport.height - 16)}px` : '';
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      container.style.height = container.style.top = container.style.bottom = '';
      panel.style.maxHeight = '';
    };
  }, [open, fitVisualViewport]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Focus management: capture previous focus, focus panel on open, restore on close
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  // Focus trapping
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [],
  );

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  const containerClass = placement === 'mobile-sheet'
    ? 'fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 animate-in fade-in duration-150'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150';
  const panelShapeClass = placement === 'mobile-sheet'
    ? 'rounded-t-xl sm:rounded-xl max-h-[92dvh] sm:max-h-[90dvh]'
    : 'rounded-xl max-h-[90vh]';

  return createPortal(
    <div
      ref={containerRef}
      className={containerClass}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`
          relative z-10 w-full ${sizeClasses[size]}
          bg-surface-card border border-border shadow-xl
          animate-in fade-in zoom-in-95 duration-150
          flex flex-col ${panelShapeClass}
          focus:outline-none
          ${className}
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id={titleId}
                  className="text-lg font-semibold text-content-primary tracking-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-content-muted mt-0.5">{description}</p>
              )}
            </div>
            <Button variant="ghost"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 min-h-11 min-w-11 !p-2 -m-1.5"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

        {/* Body */}
        <div className={`min-h-0 flex-1 overflow-y-auto p-5 ${bodyClassName}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-5 pt-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

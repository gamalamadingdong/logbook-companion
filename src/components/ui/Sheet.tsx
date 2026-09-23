import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  /** Whether the sheet is visible */
  open: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Accessible title for the sheet */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Sheet content */
  children: React.ReactNode;
  /** Whether clicking the backdrop closes the sheet */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the sheet */
  closeOnEscape?: boolean;
  /** Additional className for the sheet panel */
  className?: string;
}

/**
 * Bottom-anchored sheet for mobile navigation and account menus.
 *
 * Layers above the bottom navigation bar so an open sheet is never rendered
 * beneath the very controls used to dismiss it.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const titleId = 'sheet-title';
  const descriptionId = description ? 'sheet-description' : undefined;

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else if (previousFocusRef.current instanceof HTMLElement) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center animate-in fade-in duration-150">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`
          relative z-10 flex w-full max-h-[85vh] flex-col
          rounded-t-2xl border-t border-border bg-surface-card shadow-2xl
          animate-in slide-in-from-bottom duration-200
          focus:outline-none
          ${className}
        `}
      >
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="px-5 pb-2">
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-content-primary">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-sm text-content-muted">
              {description}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

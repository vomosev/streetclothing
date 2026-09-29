'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let modalCounter = 0;

export default function Modal({ open, onClose, title, children, footer }) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleIdRef = useRef(null);

  if (titleIdRef.current === null) {
    modalCounter += 1;
    titleIdRef.current = `modal-title-${modalCounter}`;
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  // Focus management: move focus in, restore on close
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const node = dialogRef.current;
      if (!node) return;
      const focusables = node.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        node.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const toRestore = previouslyFocused.current;
      if (toRestore && typeof toRestore.focus === 'function' && document.contains(toRestore)) {
        try {
          toRestore.focus();
        } catch (err) {
          /* focus restore is best-effort */
        }
      }
    };
  }, [open]);

  // Escape to close + focus trap
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const node = dialogRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !node.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, handleClose]);

  if (!mounted || !open || typeof document === 'undefined') return null;

  function onBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onBackdropMouseDown}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleIdRef.current : undefined}
        aria-label={title ? undefined : 'Dialog'}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal__header">
          {title ? (
            <h2 className="modal__title" id={titleIdRef.current}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="modal__close"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="modal__body user-text">{children}</div>

        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
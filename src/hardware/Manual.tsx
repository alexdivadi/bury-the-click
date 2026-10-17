import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Manual({
  title,
  className,
  onClose,
  children,
}: {
  title: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const priorFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        card.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      priorFocus?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={card}
        className={`overlay-card ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          ref={closeButton}
          className="close-button"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

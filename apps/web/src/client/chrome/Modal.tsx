import { type ReactNode, useEffect, useRef } from 'react';

/** Native <dialog> modal (focus trap, Esc, backdrop) driven by a boolean. */
export function Modal({
  open,
  onClose,
  labelledBy,
  testId,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  testId?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal-wide' : ''}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
      data-testid={testId}
    >
      {open && children}
    </dialog>
  );
}

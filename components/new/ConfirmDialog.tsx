import React, { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { HoldButton } from '../kokonutui/hold-button';
import { Drawer, SCRIM_CLASS, useMediaQuery } from './Drawer';
import { Button } from './ui';

/*
 * Confirmation for the New pages (UI_UX_DESIGN_REFERENCE.md D5, D15). `confirmNew()` returns a promise that
 * resolves true when confirmed. Danger confirmations use a Hold Button (D5: every permanent action). A centred
 * dialog from 768px, a bottom sheet on phones. Reversible changes never ask: they use an Undo toast (D6).
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** A permanent action: confirmed with a Hold Button. */
  danger?: boolean;
}

interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

let enqueue: ((p: Pending) => void) | null = null;

/** Asks for confirmation. Resolves false if no host is mounted. */
export const confirmNew = (options: ConfirmOptions): Promise<boolean> =>
  new Promise(resolve => {
    if (!enqueue) { resolve(false); return; }
    enqueue({ ...options, resolve });
  });

/** Mounted once by ShellNew. */
export const ConfirmHostNew: React.FC = () => {
  const [pending, setPending] = useState<Pending | null>(null);
  const desktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    enqueue = p => setPending(current => { current?.resolve(false); return p; });
    return () => { enqueue = null; };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const actions = pending && (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={() => close(false)}>{pending.cancelLabel ?? 'Cancel'}</Button>
      {pending.danger
        ? <HoldButton onHoldComplete={() => setTimeout(() => close(true), 350)} completeLabel="Confirmed" resetAfter={0}>{pending.confirmLabel ?? 'Hold to delete'}</HoldButton>
        : <Button variant="primary" onClick={() => close(true)}>{pending.confirmLabel ?? 'Confirm'}</Button>}
    </div>
  );

  if (!desktop) {
    return (
      <Drawer open={!!pending} onOpenChange={open => { if (!open) close(false); }} title={pending?.title ?? ''} description={pending?.message}>
        <div className="pb-2 pt-4">{actions}</div>
      </Drawer>
    );
  }

  return (
    <Dialog.Root open={!!pending} onOpenChange={open => { if (!open) close(false); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={SCRIM_CLASS} />
        <Dialog.Popup className="crystal-new fixed left-1/2 top-1/2 z-modal w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-nv-card bg-nv-surface p-6 shadow-nv-float transition-[opacity,transform] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="text-xl font-semibold text-nv-ink">{pending?.title}</Dialog.Title>
          {pending?.message && <Dialog.Description className="mt-2 text-[15px] text-nv-muted">{pending.message}</Dialog.Description>}
          <div className="mt-6">{actions}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

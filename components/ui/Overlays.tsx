import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover as AriaPopover,
} from 'react-aria-components';
import { motion, useDragControls, type PanInfo } from 'motion/react';
import Icon from './Icon';
import { Button, IconButton } from './Actions';
import { TextInput } from './Fields';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

export type SheetHeight = 'content' | 'half' | 'full';

const SHEET_HEIGHTS: Record<SheetHeight, string> = {
  content: 'max-h-[92dvh]',
  half: 'h-[56dvh] max-h-[92dvh]',
  full: 'h-[calc(100dvh-env(safe-area-inset-top,0px)-16px)]',
};

const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 500;
const GROW_DISTANCE = 72;

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  height?: SheetHeight;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Peek, half or full height. Drag to resize or close, or use Close, or tap the scrim. */
export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, description, height = 'content', footer, children, className }) => {
  const [current, setCurrent] = useState(height);
  const controls = useDragControls();

  useEffect(() => { if (isOpen) setCurrent(height); }, [isOpen, height]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onClose();
    else if (info.offset.y < -GROW_DISTANCE) setCurrent('full');
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => { if (!open) onClose(); }}
      isDismissable
      className="crystal-scrim fixed inset-0 z-[var(--z-overlay)] flex items-end"
    >
      <Modal className="crystal-sheet w-full outline-none">
        <motion.div
          drag="y"
          dragListener={false}
          dragControls={controls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.08, bottom: 0.7 }}
          dragSnapToOrigin
          onDragEnd={handleDragEnd}
          className={cn('flex flex-col rounded-t-[var(--radius-2xl)] bg-surface shadow-lg', SHEET_HEIGHTS[current], className)}
        >
          <AriaDialog className="flex min-h-0 flex-1 flex-col outline-none">
            <div
              onPointerDown={e => controls.start(e)}
              className="flex shrink-0 touch-none cursor-grab justify-center pb-1 pt-2.5"
              aria-hidden="true"
            >
              <span className="h-1 w-10 rounded-full bg-line-strong" />
            </div>
            <header
              onPointerDown={e => controls.start(e)}
              className="flex shrink-0 touch-none items-center justify-between gap-3 px-5 pb-2"
            >
              <div className="min-w-0">
                <Heading slot="title" className="type-section-title truncate text-ink">{title}</Heading>
                {description && <p className="type-caption text-muted">{description}</p>}
              </div>
              <IconButton icon="close" label="Close" onPress={onClose} onPointerDown={e => e.stopPropagation()} />
            </header>
            <div className="scroll-touch min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">{children}</div>
            {footer && (
              <footer className="shrink-0 border-t border-line px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">{footer}</footer>
            )}
          </AriaDialog>
        </motion.div>
      </Modal>
    </ModalOverlay>
  );
};

export type OverlayKind = 'dialog' | 'side' | 'full';

export interface ResponsiveOverlayProps {
  /** D-024: a short task is a dialog, a record is a side panel, long or multi-step work is a full panel. */
  kind: OverlayKind;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Side panel width. Use 640 for transaction detail with a map. */
  width?: 480 | 640;
  /** With unsaved changes, closing asks first (D-068). */
  isDirty?: boolean;
  children: React.ReactNode;
}

const OVERLAY_SHAPE: Record<OverlayKind, string> = {
  dialog: 'crystal-dialog m-4 max-h-[calc(100dvh-32px)] w-full max-w-[480px] rounded-[var(--radius-xl)]',
  side: 'crystal-side ml-auto h-dvh w-full rounded-l-[var(--radius-xl)]',
  full: 'crystal-dialog h-dvh w-full',
};

/** Writes each form once: a dialog or panel on larger screens, a bottom sheet on phones. */
export const ResponsiveOverlay: React.FC<ResponsiveOverlayProps> = ({ kind, isOpen, onClose, title, description, footer, width = 480, isDirty, children }) => {
  const isPhone = useIsMobile();
  const [isAsking, setAsking] = useState(false);

  const requestClose = useCallback(() => {
    if (isDirty) setAsking(true);
    else onClose();
  }, [isDirty, onClose]);

  const guard = (
    <ConfirmDialog
      isOpen={isAsking}
      onClose={() => setAsking(false)}
      onConfirm={onClose}
      title="Discard your changes?"
      message="You haven't saved them."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      isDestructive
    />
  );

  if (isPhone) {
    return (
      <>
        <BottomSheet
          isOpen={isOpen}
          onClose={requestClose}
          title={title}
          description={description}
          footer={footer}
          height={kind === 'dialog' ? 'content' : 'full'}
        >
          {children}
        </BottomSheet>
        {isDirty && guard}
      </>
    );
  }

  return (
    <>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={open => { if (!open) requestClose(); }}
        isDismissable
        className={cn('crystal-scrim fixed inset-0 z-[var(--z-overlay)] flex', kind === 'dialog' && 'items-center justify-center')}
      >
        <Modal
          className={cn('flex flex-col bg-surface shadow-lg outline-none', OVERLAY_SHAPE[kind])}
          style={kind === 'side' ? { maxWidth: width } : undefined}
        >
          <AriaDialog className="flex min-h-0 flex-1 flex-col outline-none">
            <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-3 pt-5">
              <div className={cn('min-w-0', kind === 'full' && 'mx-auto w-full max-w-[960px]')}>
                <Heading slot="title" className="type-section-title text-ink">{title}</Heading>
                {description && <div className="type-body mt-1 text-muted">{description}</div>}
              </div>
              <IconButton icon="close" label="Close" onPress={requestClose} />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              <div className={cn(kind === 'full' && 'mx-auto max-w-[960px]')}>{children}</div>
            </div>
            {footer && (
              <footer className="shrink-0 border-t border-line px-6 py-4">
                <div className={cn(kind === 'full' && 'mx-auto max-w-[960px]')}>{footer}</div>
              </footer>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
      {isDirty && guard}
    </>
  );
};

export type OverlayProps = Omit<ResponsiveOverlayProps, 'kind'>;
export const Dialog: React.FC<Omit<OverlayProps, 'width'>> = props => <ResponsiveOverlay kind="dialog" {...props} />;
export const SidePanel: React.FC<OverlayProps> = props => <ResponsiveOverlay kind="side" {...props} />;
export const FullPanel: React.FC<Omit<OverlayProps, 'width'>> = props => <ResponsiveOverlay kind="full" {...props} />;

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  /** Type-to-confirm: the button stays off until this exact text is typed. */
  requireText?: string;
}

/** A plain confirmation, and type-to-confirm for accounts. Ordinary deletes use HoldButton instead. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel, cancelLabel = 'Cancel', isDestructive, requireText }) => {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!isOpen) setTyped(''); }, [isOpen]);

  return (
    <ResponsiveOverlay
      kind="dialog"
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={onClose} block={false}>{cancelLabel}</Button>
          <Button
            variant={isDestructive ? 'destructive' : 'primary'}
            isDisabled={!!requireText && typed !== requireText}
            onPress={() => { onClose(); onConfirm(); }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {message && <p className="type-body text-muted">{message}</p>}
      {requireText && (
        <TextInput
          className="mt-4"
          label={<>Type <strong className="font-bold">{requireText}</strong> to confirm</>}
          value={typed}
          onChange={setTyped}
        />
      )}
    </ResponsiveOverlay>
  );
};

export const popoverStyles =
  'crystal-pop rounded-[var(--radius-lg)] border border-line bg-surface shadow-sm outline-none';

/** A small anchored picker or filter. A bottom sheet on phones. */
export const Popover: React.FC<{
  trigger: React.ReactElement;
  title: string;
  placement?: React.ComponentProps<typeof AriaPopover>['placement'];
  children: React.ReactNode;
  className?: string;
}> = ({ trigger, title, placement = 'bottom start', children, className }) => {
  const isPhone = useIsMobile();
  const [isOpen, setOpen] = useState(false);
  const headingId = useId();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setOpen}>
      {trigger}
      {isPhone ? (
        <BottomSheet isOpen={isOpen} onClose={() => setOpen(false)} title={title}>{children}</BottomSheet>
      ) : (
        <AriaPopover placement={placement} offset={8} className={cn(popoverStyles, 'p-3', className)}>
          <AriaDialog aria-labelledby={headingId} className="outline-none">
            <span id={headingId} className="sr-only">{title}</span>
            {children}
          </AriaDialog>
        </AriaPopover>
      )}
    </DialogTrigger>
  );
};

/** Small icon + title + value row used inside sheets and panels. */
export const SheetRow: React.FC<{
  icon: string;
  label: string;
  value?: React.ReactNode;
  onPress: () => void;
  isCurrent?: boolean;
  tone?: 'default' | 'danger';
}> = ({ icon, label, value, onPress, isCurrent, tone = 'default' }) => (
  <button
    type="button"
    onClick={onPress}
    aria-current={isCurrent ? 'page' : undefined}
    className={cn(
      'flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-left type-body-strong active:bg-inset',
      tone === 'danger' ? 'text-money-out' : 'text-ink',
      isCurrent && 'bg-primary-soft'
    )}
  >
    <Icon name={icon} size={20} weight={isCurrent ? 'bold' : 'regular'} />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {value && <span className="type-body shrink-0 text-muted">{value}</span>}
  </button>
);

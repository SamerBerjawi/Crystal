import React, { useEffect } from 'react';
import { Toaster, sileo, type SileoPosition } from 'sileo';
import { registerToastSink, type AppToastKind, type AppToastOptions, type ToastSink } from '../../utils/toastBridge';
import { useMediaQuery } from './Drawer';

/*
 * Toasts for the New pages (UI_UX_DESIGN_REFERENCE.md D4, D6). Sileo is the one host while the New shell is
 * mounted: bottom centre (above the dock on phones), moved to the top while a phone bottom sheet is open
 * (`data-nv-sheet` on <html>, set by Drawer), about 6 s (8 s for errors).
 */

const keyed = new Map<string, string>();

const position = (): SileoPosition =>
  typeof document !== 'undefined' && document.documentElement.hasAttribute('data-nv-sheet') ? 'top-center' : 'bottom-center';

const show = (kind: AppToastKind, title: string, options: AppToastOptions = {}): string => {
  const previous = options.id ? keyed.get(options.id) : undefined;
  if (previous) sileo.dismiss(previous);
  const duration = options.duration === Infinity ? null : options.duration ?? (kind === 'error' ? 8000 : 6000);
  let id = '';
  id = sileo[kind]({
    title,
    description: options.description,
    duration,
    position: position(),
    button: options.action
      ? { title: options.action.label, onClick: () => { sileo.dismiss(id); options.action?.onClick(); } }
      : undefined,
  });
  if (options.id) keyed.set(options.id, id);
  return id;
};

const dismiss = (idOrKey: string) => {
  const id = keyed.get(idOrKey) ?? idOrKey;
  keyed.delete(idOrKey);
  sileo.dismiss(id);
};

/** The New pages' toast API. Returns the toast id. */
export const toast = {
  success: (message: string, options?: AppToastOptions) => show('success', message, options),
  error: (message: string, options?: AppToastOptions) => show('error', message, options),
  info: (message: string, options?: AppToastOptions) => show('info', message, options),
  warning: (message: string, options?: AppToastOptions) => show('warning', message, options),
  /** A reversible change that already happened (D6): Undo puts it back. */
  undo: (message: string, onUndo: () => void, options?: Omit<AppToastOptions, 'action'>) =>
    show('success', message, { ...options, action: { label: 'Undo', onClick: onUndo } }),
  dismiss,
};

const sink: ToastSink = { show: (kind, message, options) => { show(kind, message, options); }, dismiss };

/** Mounted once by ShellNew. Also receives App-level toasts through the toast bridge. */
export const ToastHostNew: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const desktop = useMediaQuery('(min-width: 1024px)');
  useEffect(() => registerToastSink(sink), []);
  return <Toaster position="bottom-center" theme={theme} offset={{ bottom: desktop ? 24 : 108, top: 16 }} />;
};

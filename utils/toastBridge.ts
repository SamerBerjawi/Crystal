/**
 * Where app-level toasts go (UI_UX_DESIGN_REFERENCE.md D4). App.tsx raises toasts for saves, sync and undo
 * without knowing which UI is showing. While the New shell is mounted it registers its Sileo host here and
 * gets them; otherwise App.tsx falls back to Sonner. Neutral on purpose: neither UI owns this module.
 */

export type AppToastKind = 'success' | 'error' | 'info' | 'warning';

export interface AppToastOptions {
  /** Stable key: a new toast with the same id replaces the old one, and `dismiss(id)` removes it. */
  id?: string;
  /** Milliseconds; `Infinity` keeps the toast until dismissed. */
  duration?: number;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export interface ToastSink {
  show: (kind: AppToastKind, message: string, options?: AppToastOptions) => void;
  dismiss: (id: string) => void;
}

let activeSink: ToastSink | null = null;

/** Registers the sink that receives app-level toasts. Returns the unregister function. */
export const registerToastSink = (sink: ToastSink): (() => void) => {
  activeSink = sink;
  return () => { if (activeSink === sink) activeSink = null; };
};

export const getToastSink = (): ToastSink | null => activeSink;

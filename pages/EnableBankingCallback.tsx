import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EnableBankingConnection, EnableBankingSyncOptions, Page } from '../types';
import { loadPendingConnection, removePendingConnection } from '../utils/enableBankingStorage';
import Icon from '../components/ui/Icon';
import { Button } from '../components/ui/Actions';

interface EnableBankingCallbackProps {
  connections: EnableBankingConnection[];
  setConnections: React.Dispatch<React.SetStateAction<EnableBankingConnection[]>>;
  onSync: (connectionId: string, connectionOverride?: EnableBankingConnection, syncOptions?: EnableBankingSyncOptions) => Promise<void>;
  setCurrentPage: (page: Page) => void;
}

const CONNECTION_LOOKUP_GRACE_MS = 6000;

const EnableBankingCallback: React.FC<EnableBankingCallbackProps> = ({
  connections,
  setConnections,
  onSync,
  setCurrentPage,
}) => {
  const [message, setMessage] = useState('Finishing the connection…');
  const [error, setError] = useState<string | null>(null);

  const hasProcessed = useRef(false);
  // The single-use code must be exchanged once: the effect re-runs whenever `connections` changes while we resolve.
  const resolving = useRef(false);
  // Saved connections can arrive after this page mounts; only report a missing one after a short wait.
  const notFoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackParamsRef = useRef<{ code: string | null; state: string | null; error: string | null; errorDescription: string | null } | null>(null);

  useEffect(() => () => { if (notFoundTimer.current) clearTimeout(notFoundTimer.current); }, []);

  useEffect(() => {
    if (hasProcessed.current || resolving.current) return;

    if (!callbackParamsRef.current) {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      // Enable Banking redirects back with exactly: code, state, error, error_description.
      callbackParamsRef.current = {
        code: params.get('code') || hashParams.get('code'),
        state: params.get('state') || hashParams.get('state'),
        error: params.get('error') || hashParams.get('error'),
        errorDescription: params.get('error_description') || hashParams.get('error_description'),
      };
    }

    const { code, state, error: oauthError, errorDescription } = callbackParamsRef.current;

    if (oauthError && !code) {
      hasProcessed.current = true;
      const errMsg = errorDescription || `Bank authorization failed (${oauthError}).`;
      if (state) {
        removePendingConnection(state);
        fetch(`/api/enable-banking/pending/${encodeURIComponent(state)}`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => {});
        setConnections(prev => prev.map(conn => conn.id === state ? {
          ...conn,
          status: 'requires_update',
          lastError: errMsg,
        } : conn));
      }
      setError(errMsg);
      return;
    }

    if (!code) {
      setError('Missing authorization code in callback.');
      return;
    }
    if (!state) {
      setError('The bank did not return a connection reference. Start the connection again.');
      return;
    }

    const resolveConnection = async () => {
      resolving.current = true;
      let connection: EnableBankingConnection | undefined;

      if (state) {
        connection = connections.find(c => c.id === state);
      }

      if (!connection && state) {
        const pendingConnection = loadPendingConnection(state);
        if (pendingConnection) {
          connection = pendingConnection;
          setConnections(prev => prev.some(conn => conn.id === pendingConnection.id) ? prev : [...prev, pendingConnection]);
        }
      }

      if (!connection && state) {
        try {
          const response = await fetch(`/api/enable-banking/pending/${encodeURIComponent(state)}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.connection) {
              connection = data.connection;
              setConnections(prev => prev.some(conn => conn.id === data.connection.id) ? prev : [...prev, data.connection]);
            }
          }
        } catch (error) {
          console.warn('Failed to load pending Enable Banking connection from server', error);
        }
      }

      if (!connection) {
        // Connections may still be loading; the effect runs again when they arrive.
        resolving.current = false;
        if (notFoundTimer.current) clearTimeout(notFoundTimer.current);
        notFoundTimer.current = setTimeout(() => setError('Missing code or connection reference in callback.'), CONNECTION_LOOKUP_GRACE_MS);
        return;
      }

      if (notFoundTimer.current) clearTimeout(notFoundTimer.current);
      setError(null);
      hasProcessed.current = true;

      const exchangeSession = async () => {
        try {
          setMessage('Confirming access with your bank…');
          const response = await fetch('/api/enable-banking/session', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              applicationId: connection.applicationId,
              requiredPsuHeaders: connection.requiredPsuHeaders,
              code,
            }),
          });

          let session: any = null;
          if (!response.ok) {
            const text = await response.text();
            try {
              const parsed = JSON.parse(text);
              throw new Error(parsed?.message || 'Unable to create session');
            } catch {
              const fallback = text?.replace(/<[^>]+>/g, '').trim() || 'Unable to create session';
              throw new Error(fallback);
            }
          } else {
            try {
              session = await response.json();
            } catch (parseError) {
              throw new Error('Received an invalid response while creating session');
            }
          }

          const sessionId = session?.session_id || session?.sessionId || session?.id;
          const sessionExpiresAt = session?.access?.valid_until || session?.access?.validUntil;

          if (!sessionId) {
            throw new Error('Session identifier missing from response');
          }

          const updatedConnection: EnableBankingConnection = {
            ...connection,
            sessionId,
            sessionExpiresAt,
            authorizationId: undefined,
            status: 'ready',
          };

          setConnections(prev => prev.map(conn => conn.id === connection.id ? updatedConnection : conn));
          // Reconnecting creates a new session; close the previous one so its consent doesn't linger at the bank.
          if (connection.sessionId && connection.sessionId !== sessionId) {
            fetch(`/api/enable-banking/session/${encodeURIComponent(connection.sessionId)}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ applicationId: connection.applicationId, requiredPsuHeaders: connection.requiredPsuHeaders }),
            }).catch(error => console.warn('Failed to revoke the previous Enable Banking session', error));
          }
          removePendingConnection(connection.id);
          fetch(`/api/enable-banking/pending/${encodeURIComponent(connection.id)}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(error => console.warn('Failed to remove pending Enable Banking connection from server', error));

          setMessage('Connected. Getting your accounts…');
          await onSync(connection.id, updatedConnection);

          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
          setMessage('Done. Taking you back to Connections…');
          toast.success('Bank connected', { description: 'Your accounts are up to date.', duration: 5000 });
          setTimeout(() => setCurrentPage('Integrations'), 800);
        } catch (err: any) {
          console.error(err);
          setConnections(prev => prev.map(conn => conn.id === connection?.id ? {
            ...conn,
            status: 'requires_update',
            lastError: err?.message || 'Failed to complete Enable Banking connection',
          } : conn));
          setError(err?.message || 'Failed to complete Enable Banking connection');
        }
      };

      exchangeSession();
    };

    resolveConnection();
  }, [connections, onSync, setConnections, setCurrentPage]);

  return (
    <main className="mx-auto mt-20 max-w-md px-4">
      <section className="rounded-[var(--radius-xl)] surface-card p-8 text-center max-md:p-5" aria-live="polite">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-inset text-muted">
          <Icon name={error ? 'alert-02' : 'bank'} size={24} />
        </span>
        <h1 className="type-section-title text-ink">{error ? "Couldn't connect your bank" : 'Connecting your bank'}</h1>
        {error ? (
          <>
            <p className="type-body mt-2 text-muted">{error}</p>
            <Button className="mt-5" onPress={() => setCurrentPage('Integrations')}>Back to Connections</Button>
          </>
        ) : (
          <p className="type-body mt-2 text-muted">{message}</p>
        )}
      </section>
    </main>
  );
};

export default EnableBankingCallback;

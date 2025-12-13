import React, { useEffect, useRef, useState } from 'react';
import { EnableBankingConnection, Page } from '../types';
import { loadPendingConnection, removePendingConnection } from '../utils/enableBankingStorage';

interface EnableBankingCallbackProps {
  connections: EnableBankingConnection[];
  setConnections: React.Dispatch<React.SetStateAction<EnableBankingConnection[]>>;
  onSync: (connectionId: string, connectionOverride?: EnableBankingConnection) => Promise<void>;
  setCurrentPage: (page: Page) => void;
  authToken?: string | null;
}

const EnableBankingCallback: React.FC<EnableBankingCallbackProps> = ({
  connections,
  setConnections,
  onSync,
  setCurrentPage,
  authToken,
}) => {
  const [message, setMessage] = useState('Finalising your Enable Banking connection...');
  const [error, setError] = useState<string | null>(null);

  const hasProcessed = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      setError('Missing code or connection reference in callback.');
      return;
    }

    if (hasProcessed.current) return;

    let connection: EnableBankingConnection | undefined = connections.find(c => c.id === state);
    if (!connection) {
      const pendingConnection = loadPendingConnection(state);
      if (pendingConnection) {
        connection = pendingConnection;
        setConnections(prev => prev.some(conn => conn.id === pendingConnection.id) ? prev : [...prev, pendingConnection]);
      }
    }

    if (!connection) {
      setError('Could not find a matching connection for this callback.');
      return;
    }

    hasProcessed.current = true;

    const exchangeSession = async () => {
      try {
        setMessage('Exchanging authorization code for a session...');
        const response = await fetch('/api/enable-banking/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            applicationId: connection.applicationId,
            clientCertificate: connection.clientCertificate,
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
        removePendingConnection(connection.id);

        setMessage('Session created. Syncing accounts...');
        await onSync(connection.id, updatedConnection);

        setMessage('Sync complete. Redirecting...');
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
  }, [authToken, connections, onSync, setConnections, setCurrentPage]);

  return (
    <div className="max-w-lg mx-auto mt-20 p-6 rounded-xl bg-white dark:bg-dark-surface shadow-lg text-center animate-fade-in-up">
      <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-3xl">sync</span>
      </div>
      <h1 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">Enable Banking</h1>
      {error ? (
        <>
          <p className="text-rose-600 dark:text-rose-300 mb-4">{error}</p>
          <button
            onClick={() => setCurrentPage('Integrations')}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold"
          >
            Back to integrations
          </button>
        </>
      ) : (
        <p className="text-light-text-secondary dark:text-dark-text-secondary">{message}</p>
      )}
    </div>
  );
};

export default EnableBankingCallback;

import React, { useEffect, useState } from 'react';
import { EnableBankingConnection, Page } from '../types';

interface EnableBankingCallbackProps {
  connections: EnableBankingConnection[];
  setConnections: React.Dispatch<React.SetStateAction<EnableBankingConnection[]>>;
  onSync: (connectionId: string) => Promise<void>;
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      setError('Missing code or connection reference in callback.');
      return;
    }

    const connection = connections.find(c => c.id === state);
    if (!connection) {
      setError('Could not find a matching connection for this callback.');
      return;
    }

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

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Unable to create session');
        }

        const session = await response.json();
        setConnections(prev => prev.map(conn => conn.id === connection.id ? {
          ...conn,
          sessionId: session.session_id,
          sessionExpiresAt: session?.access?.valid_until,
          authorizationId: undefined,
          status: 'ready',
        } : conn));

        setMessage('Session created. Syncing accounts...');
        await onSync(connection.id);

        setMessage('Sync complete. Redirecting...');
        setTimeout(() => setCurrentPage('Integrations'), 800);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to complete Enable Banking connection');
      }
    };

    exchangeSession();
  }, [connections, setConnections, onSync, setCurrentPage]);

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

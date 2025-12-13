import React, { useMemo, useState } from 'react';
import Card from './Card';
import { INPUT_BASE_STYLE } from '../constants';
import { Account, EnableBankingConnection } from '../types';

interface EnableBankingIntegrationCardProps {
  connections: EnableBankingConnection[];
  accounts: Account[];
  onCreateConnection: (payload: {
    applicationId: string;
    countryCode: string;
    clientCertificate: string;
    selectedBank: string;
  }) => void;
  onDeleteConnection: (connectionId: string) => void;
  onLinkAccount: (connectionId: string, providerAccountId: string, linkedAccountId: string, syncStartDate: string) => void;
  onTriggerSync: (connectionId: string) => void;
}

const BANK_OPTIONS = [
  { id: 'nordea-fi', name: 'Nordea Finland', country: 'FI' },
  { id: 'danske-dk', name: 'Danske Bank Denmark', country: 'DK' },
  { id: 'seb-se', name: 'SEB Sweden', country: 'SE' },
  { id: 'revolut-eu', name: 'Revolut Europe', country: 'LT' },
];

const EnableBankingIntegrationCard: React.FC<EnableBankingIntegrationCardProps> = ({
  connections,
  accounts,
  onCreateConnection,
  onDeleteConnection,
  onLinkAccount,
  onTriggerSync,
}) => {
  const [formState, setFormState] = useState({
    applicationId: '',
    countryCode: 'FI',
    clientCertificate: '',
    selectedBank: BANK_OPTIONS[0]?.name || '',
  });

  const [linkingState, setLinkingState] = useState<Record<string, { accountId?: string; syncStartDate?: string }>>({});

  const linkedAccounts = useMemo(() => new Set(connections.flatMap(conn => conn.accounts.map(acc => acc.linkedAccountId).filter(Boolean) as string[])), [connections]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleCreate = () => {
    if (!formState.applicationId.trim() || !formState.clientCertificate.trim()) {
      alert('Application ID and client certificate are required to start the Enable Banking flow.');
      return;
    }

    onCreateConnection({
      applicationId: formState.applicationId,
      countryCode: formState.countryCode,
      clientCertificate: formState.clientCertificate,
      selectedBank: formState.selectedBank,
    });

    setFormState(prev => ({ ...prev, applicationId: '', clientCertificate: '' }));
  };

  const handleLinkChange = (key: string, updates: { accountId?: string; syncStartDate?: string }) => {
    setLinkingState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates,
      },
    }));
  };

  const renderStatusBadge = (status: EnableBankingConnection['status']) => {
    const mapping: Record<EnableBankingConnection['status'], { label: string; color: string }> = {
      disconnected: { label: 'Disconnected', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' },
      pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
      ready: { label: 'Ready', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
      requires_update: { label: 'Needs Reauth', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
    };

    const entry = mapping[status];
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${entry.color}`}>{entry.label}</span>;
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Enable Banking</h3>
          </div>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            Configure your Enable Banking credentials, simulate an authorization, and link imported accounts to your existing books with a sync start date.
          </p>
        </div>
        <div className="hidden sm:block text-right text-xs text-light-text-secondary dark:text-dark-text-secondary">
          <div>OAuth-style redirect</div>
          <div>JWT (RS256) auth</div>
          <div>Session-based sync</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-light-text dark:text-dark-text">Create sandbox connection</h4>
          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Bank</label>
          <select
            name="selectedBank"
            value={formState.selectedBank}
            onChange={handleFormChange}
            className={`${INPUT_BASE_STYLE} w-full`}
          >
            {BANK_OPTIONS.map(option => (
              <option key={option.id} value={option.name}>{option.name} ({option.country})</option>
            ))}
          </select>

          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Country code</label>
          <input
            type="text"
            name="countryCode"
            value={formState.countryCode}
            onChange={handleFormChange}
            placeholder="FI"
            className={INPUT_BASE_STYLE}
          />

          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Application ID (kid)</label>
          <input
            type="text"
            name="applicationId"
            value={formState.applicationId}
            onChange={handleFormChange}
            placeholder="app_xxxxx"
            className={INPUT_BASE_STYLE}
          />

          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Client certificate (PEM)</label>
          <textarea
            name="clientCertificate"
            value={formState.clientCertificate}
            onChange={handleFormChange}
            placeholder="-----BEGIN PRIVATE KEY-----"
            rows={4}
            className={`${INPUT_BASE_STYLE} font-mono text-xs min-h-[120px]`}
          />

          <button
            onClick={handleCreate}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            Start authorization & create session
          </button>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            This sandbox flow mocks the Enable Banking redirect and session creation so you can test account linking before wiring a backend.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-light-text dark:text-dark-text">Connections</h4>
          {connections.length === 0 && (
            <div className="p-4 rounded-lg border border-dashed border-black/10 dark:border-white/10 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              No Enable Banking sessions yet. Create one to fetch demo accounts and practice linking.
            </div>
          )}

          {connections.map(connection => {
            const keyPrefix = (accountId: string) => `${connection.id}:${accountId}`;

            return (
              <div key={connection.id} className="p-4 rounded-lg border border-black/5 dark:border-white/10 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-light-text dark:text-dark-text">{connection.selectedBank || 'Bank session'}</h5>
                      {renderStatusBadge(connection.status)}
                    </div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      Session ID: {connection.sessionId || 'pending'} • Expires {connection.sessionExpiresAt ? new Date(connection.sessionExpiresAt).toLocaleDateString() : 'N/A'}
                    </p>
                    {connection.lastSyncedAt && (
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Last synced {new Date(connection.lastSyncedAt).toLocaleString()}</p>
                    )}
                    {connection.lastError && (
                      <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{connection.lastError}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTriggerSync(connection.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <span className="material-symbols-outlined text-sm">sync</span>
                      Trigger sync
                    </button>
                    <button
                      onClick={() => onDeleteConnection(connection.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Remove
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-black/5 dark:border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary text-left">
                      <tr>
                        <th className="px-3 py-2">Provider account</th>
                        <th className="px-3 py-2">Balance</th>
                        <th className="px-3 py-2">Link to account</th>
                        <th className="px-3 py-2">Sync start date</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connection.accounts.map(account => {
                        const rowKey = keyPrefix(account.id);
                        const rowState = linkingState[rowKey] || { accountId: account.linkedAccountId, syncStartDate: account.syncStartDate };
                        const linkedAccount = accounts.find(a => a.id === account.linkedAccountId);

                        return (
                          <tr key={account.id} className="border-t border-black/5 dark:border-white/5">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-light-text dark:text-dark-text">{account.name}</div>
                              <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{account.accountNumber || 'UID available after details fetch'}</div>
                            </td>
                            <td className="px-3 py-2 text-light-text dark:text-dark-text">
                              {account.currency} {account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className={`${INPUT_BASE_STYLE} text-sm`}
                                value={rowState.accountId || ''}
                                onChange={(e) => handleLinkChange(rowKey, { accountId: e.target.value })}
                              >
                                <option value="">Select account to link</option>
                                {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id} disabled={linkedAccounts.has(acc.id) && acc.id !== account.linkedAccountId}>
                                    {acc.name} ({acc.currency})
                                  </option>
                                ))}
                              </select>
                              {linkedAccount && (
                                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                  Linked to {linkedAccount.name}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                className={`${INPUT_BASE_STYLE} text-sm`}
                                value={rowState.syncStartDate || ''}
                                onChange={(e) => handleLinkChange(rowKey, { syncStartDate: e.target.value })}
                              />
                              <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Choose how far back to import.</p>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => {
                                  if (!rowState.accountId || !rowState.syncStartDate) {
                                    alert('Select an account and sync start date before linking.');
                                    return;
                                  }
                                  onLinkAccount(connection.id, account.id, rowState.accountId, rowState.syncStartDate);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700"
                              >
                                <span className="material-symbols-outlined text-sm">link</span>
                                Link
                              </button>
                              {account.lastSyncedAt && (
                                <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Synced {new Date(account.lastSyncedAt).toLocaleDateString()}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default EnableBankingIntegrationCard;

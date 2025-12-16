import React, { useEffect, useMemo, useState } from 'react';
import Card from './Card';
import { INPUT_BASE_STYLE } from '../constants';
import { Account, AccountType, EnableBankingConnection, EnableBankingLinkPayload, EnableBankingSyncOptions } from '../types';
import { toLocalISOString } from '../utils';
import { loadEnableBankingConfig, persistEnableBankingConfig } from '../utils/enableBankingStorage';

interface EnableBankingIntegrationCardProps {
  connections: EnableBankingConnection[];
  accounts: Account[];
  onCreateConnection: (payload: {
    applicationId: string;
    countryCode: string;
    clientCertificate: string;
    selectedBank: string;
    connectionId?: string;
  }) => void;
  onFetchBanks: (payload: { applicationId: string; countryCode: string; clientCertificate: string }) => Promise<
    { id: string; name: string; country?: string }[]
  >;
  onDeleteConnection: (connectionId: string) => void;
  onLinkAccount: (
    connectionId: string,
    providerAccountId: string,
    payload: EnableBankingLinkPayload
  ) => void;
  onTriggerSync: (connectionId: string, connectionOverride?: EnableBankingConnection, options?: EnableBankingSyncOptions) => void | Promise<void>;
}

const ENABLE_SINCE_LAST_MODE = false;

const EnableBankingIntegrationCard: React.FC<EnableBankingIntegrationCardProps> = ({
  connections,
  accounts,
  onCreateConnection,
  onFetchBanks,
  onDeleteConnection,
  onLinkAccount,
  onTriggerSync,
}) => {
  const [formState, setFormState] = useState({
    applicationId: '',
    countryCode: 'FI',
    clientCertificate: '',
    selectedBank: '',
  });

  const updateFormState = (updater: React.SetStateAction<typeof formState>) => {
    setFormState(prev => {
      const nextState = typeof updater === 'function' ? (updater as (prev: typeof formState) => typeof formState)(prev) : updater;
      persistEnableBankingConfig(nextState);
      return nextState;
    });
  };

  const [linkingState, setLinkingState] = useState<
    Record<
      string,
      {
        mode?: 'existing' | 'create';
        accountId?: string;
        syncStartDate?: string;
        newAccountName?: string;
        newAccountType?: AccountType;
      }
    >
  >({});
  const autoSyncedConnections = React.useRef<Set<string>>(new Set());
  const [bankOptions, setBankOptions] = useState<{ id: string; name: string; country?: string }[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [syncPrompt, setSyncPrompt] = useState<{
    connectionId: string;
    transactionMode: EnableBankingSyncOptions['transactionMode'];
    updateBalance: boolean;
  } | null>(null);

  const todayStr = useMemo(() => toLocalISOString(new Date()), []);
  const ninetyDaysAgoStr = useMemo(
    () => toLocalISOString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
    []
  );

  const accountTypeOptions: AccountType[] = useMemo(
    () => ['Checking', 'Savings', 'Credit Card', 'Investment', 'Loan', 'Property', 'Vehicle', 'Other Assets', 'Other Liabilities', 'Lending'],
    []
  );

  const linkedAccounts = useMemo(() => new Set(connections.flatMap(conn => conn.accounts.map(acc => acc.linkedAccountId).filter(Boolean) as string[])), [connections]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateFormState(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const savedConfig = loadEnableBankingConfig();
    if (savedConfig) {
      updateFormState(prev => ({ ...prev, ...savedConfig }));
    }
  }, []);

  const clampSyncDate = (value?: string) => {
    if (!value) return value;
    const parsed = new Date(value);
    const min = new Date(ninetyDaysAgoStr);
    const max = new Date(todayStr);

    if (parsed < min) return ninetyDaysAgoStr;
    if (parsed > max) return todayStr;
    return value;
  };

  const getLastFour = (value?: string | null) => {
    if (!value) return null;
    const cleaned = value.replace(/\s+/g, '');
    if (!cleaned) return null;
    return cleaned.slice(-4);
  };

  const loadBanks = async () => {
    if (!formState.applicationId.trim() || !formState.clientCertificate.trim()) {
      alert('Enter application ID and client certificate before loading banks.');
      return;
    }

    setBanksLoading(true);
    setBanksError(null);

    try {
      const options = await onFetchBanks({
        applicationId: formState.applicationId.trim(),
        countryCode: formState.countryCode.trim().toUpperCase(),
        clientCertificate: formState.clientCertificate.trim(),
      });
      setBankOptions(options);
      updateFormState(prev => ({ ...prev, selectedBank: options[0]?.name || '' }));
    } catch (error: any) {
      console.error('Failed to load banks', error);
      setBankOptions([]);
      setBanksError(error?.message || 'Unable to load banks for the selected country');
    } finally {
      setBanksLoading(false);
    }
  };

  const openSyncPrompt = (connection: EnableBankingConnection) => {
    const hasCompletedSync =
      Boolean(connection.lastSyncedAt) || connection.accounts?.some(acc => acc.lastSyncedAt);

    setSyncPrompt({
      connectionId: connection.id,
      transactionMode: ENABLE_SINCE_LAST_MODE && hasCompletedSync ? 'since_last' : 'full',
      updateBalance: true,
    });
  };

  const confirmSync = () => {
    if (!syncPrompt) return;

    if (syncPrompt.transactionMode === 'none' && !syncPrompt.updateBalance) {
      alert('Select at least one sync option to continue.');
      return;
    }

    const connectionOverride = connections.find(conn => conn.id === syncPrompt.connectionId);
    const resolvedTransactionMode = ENABLE_SINCE_LAST_MODE && syncPrompt.transactionMode !== 'none'
      ? syncPrompt.transactionMode
      : syncPrompt.transactionMode === 'since_last'
        ? 'full'
        : syncPrompt.transactionMode;

    onTriggerSync(syncPrompt.connectionId, connectionOverride, {
      transactionMode: resolvedTransactionMode,
      updateBalance: syncPrompt.updateBalance,
    });

    setSyncPrompt(null);
  };

  const handleCreate = () => {
    if (!formState.applicationId.trim() || !formState.clientCertificate.trim()) {
      alert('Application ID and client certificate are required to start the Enable Banking flow.');
      return;
    }

    if (!formState.selectedBank) {
      alert('Select a bank for the chosen country.');
      return;
    }

    onCreateConnection({
      applicationId: formState.applicationId,
      countryCode: formState.countryCode,
      clientCertificate: formState.clientCertificate,
      selectedBank: formState.selectedBank,
    });

  };

  const handleReauthorize = (connection: EnableBankingConnection) => {
    const resolvedApplicationId = (connection.applicationId || formState.applicationId).trim();
    const resolvedCertificate = (connection.clientCertificate || formState.clientCertificate).trim();
    const resolvedCountry = (connection.countryCode || formState.countryCode).trim().toUpperCase();
    const resolvedBank = connection.selectedBank || formState.selectedBank;

    if (!resolvedApplicationId || !resolvedCertificate) {
      alert('Application ID and client certificate are required to reauthorize this connection.');
      return;
    }

    updateFormState(prev => ({
      ...prev,
      applicationId: resolvedApplicationId,
      clientCertificate: resolvedCertificate,
      countryCode: resolvedCountry,
      selectedBank: resolvedBank || prev.selectedBank,
    }));

    onCreateConnection({
      applicationId: resolvedApplicationId,
      countryCode: resolvedCountry,
      clientCertificate: resolvedCertificate,
      selectedBank: resolvedBank || connection.selectedBank || 'Enable Banking',
      connectionId: connection.id,
    });
  };

  const handleLinkChange = (
    key: string,
    updates: {
      mode?: 'existing' | 'create';
      accountId?: string;
      syncStartDate?: string;
      newAccountName?: string;
      newAccountType?: AccountType;
    }
  ) => {
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

  useEffect(() => {
    connections.forEach(connection => {
      const shouldAutoSync =
        connection.status === 'ready' &&
        connection.sessionId &&
        (!connection.accounts || connection.accounts.length === 0) &&
        !autoSyncedConnections.current.has(connection.id);

      if (!shouldAutoSync) return;

      autoSyncedConnections.current.add(connection.id);
      onTriggerSync(connection.id);
    });
  }, [connections, onTriggerSync]);

  const readyConnections = useMemo(
    () => connections.filter(connection => connection.status === 'ready').length,
    [connections]
  );
  const pendingConnections = useMemo(
    () => connections.filter(connection => connection.status === 'pending').length,
    [connections]
  );
  const linkedAccountTotal = useMemo(
    () => connections.reduce((sum, connection) => sum + (connection.accounts?.length || 0), 0),
    [connections]
  );

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
            Configure your Enable Banking credentials, start a real authorization, and link imported accounts to your existing books with a sync start date.
          </p>
        </div>
        <div className="hidden sm:block text-right text-xs text-light-text-secondary dark:text-dark-text-secondary">
          <div>OAuth-style redirect</div>
          <div>JWT (RS256) auth</div>
          <div>Session-based sync</div>
        </div>
      </div>

      {syncPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-light-text dark:text-dark-text">Sync Enable Banking connection</h4>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  Choose what to sync for this connection. You can import all historical transactions, only the new ones, or just refresh balances.
                </p>
              </div>
              <button
                onClick={() => setSyncPrompt(null)}
                className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text hover:dark:text-white"
                aria-label="Close sync options"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-light-text dark:text-dark-text">Transactions</h5>
              <label className="flex items-start gap-3 text-sm text-light-text dark:text-dark-text">
                <input
                  type="radio"
                  name="enable-banking-transaction-mode"
                  value="full"
                  checked={syncPrompt.transactionMode === 'full'}
                  onChange={() => setSyncPrompt(prev => prev ? { ...prev, transactionMode: 'full' } : prev)}
                  className="mt-1.5 h-4 w-4 text-primary-600"
                />
                <div>
                  <div className="font-semibold">Sync all transactions from the configured start date</div>
                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Use the sync start date set when linking accounts.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 text-sm text-light-text dark:text-dark-text opacity-70">
                <input
                  type="radio"
                  name="enable-banking-transaction-mode"
                  value="since_last"
                  checked={syncPrompt.transactionMode === 'since_last'}
                  onChange={() => setSyncPrompt(prev => prev ? { ...prev, transactionMode: 'since_last' } : prev)}
                  disabled={!ENABLE_SINCE_LAST_MODE}
                  className="mt-1.5 h-4 w-4 text-primary-600 disabled:opacity-50"
                />
                <div>
                  <div className="font-semibold">Sync new transactions since the last completed sync</div>
                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    Only fetch transactions after the most recent successful sync. Currently disabled while we address a service issue.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 text-sm text-light-text dark:text-dark-text">
                <input
                  type="radio"
                  name="enable-banking-transaction-mode"
                  value="none"
                  checked={syncPrompt.transactionMode === 'none'}
                  onChange={() => setSyncPrompt(prev => prev ? { ...prev, transactionMode: 'none' } : prev)}
                  className="mt-1.5 h-4 w-4 text-primary-600"
                />
                <div>
                  <div className="font-semibold">Skip transaction import</div>
                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Use this when you only want to refresh balances.</div>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 text-sm text-light-text dark:text-dark-text">
                <input
                  type="checkbox"
                  checked={syncPrompt.updateBalance}
                  onChange={e => setSyncPrompt(prev => prev ? { ...prev, updateBalance: e.target.checked } : prev)}
                  className="h-4 w-4 text-primary-600"
                />
                <div>
                  <div className="font-semibold">Update balances</div>
                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Refresh balances for any linked accounts.</div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSyncPrompt(null)}
                className="px-4 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-sm font-semibold text-light-text dark:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={confirmSync}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                Start sync
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-black/5 dark:border-white/5">
          <div className="text-xs font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Ready to sync</div>
          <div className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">{readyConnections}</div>
          <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Connections that can sync immediately.</p>
        </div>
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">Pending</div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-200 mt-1">{pendingConnections}</div>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80">Awaiting authorization or a new session.</p>
        </div>
        <div className="p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-200">Linked accounts</div>
          <div className="text-2xl font-bold text-primary-700 dark:text-primary-200 mt-1">{linkedAccountTotal}</div>
          <p className="text-[11px] text-primary-700/80 dark:text-primary-200/80">Provider accounts mapped to your ledger.</p>
        </div>
      </div>


      <div className="space-y-5">
        <div className="p-4 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-black/5 dark:border-white/5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-light-text dark:text-dark-text">Connection setup</h4>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Save your credentials once, load banks for a country, then start a new session.</p>
            </div>
            <span className="px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">Local only</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
            <div>
              <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Country code</label>
              <input
                type="text"
                name="countryCode"
                value={formState.countryCode}
                onChange={handleFormChange}
                placeholder="FI"
                className={INPUT_BASE_STYLE}
              />
            </div>
            <button
              type="button"
              onClick={loadBanks}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface text-sm font-semibold text-light-text dark:text-dark-text border border-black/5 dark:border-white/10"
            >
              {banksLoading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  Loading
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Load banks
                </>
              )}
            </button>
          </div>

          <div>
            <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Bank (loaded per country)</label>
            <select
              name="selectedBank"
              value={formState.selectedBank}
              onChange={handleFormChange}
              className={`${INPUT_BASE_STYLE} w-full`}
              disabled={banksLoading || bankOptions.length === 0}
            >
              {bankOptions.length === 0 && <option value="">Select a country and load banks</option>}
              {bankOptions.map(option => (
                <option key={option.id} value={option.name}>{option.name}{option.country ? ` (${option.country})` : ''}</option>
              ))}
            </select>
            {banksError && <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{banksError}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-light-text dark:text-dark-text">Connections</h4>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Manage each session, then link provider accounts to your ledger entries.</p>
            </div>
            {connections.length > 0 && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary">{connections.length} total</span>
            )}
          </div>
          {connections.length === 0 && (
            <div className="p-4 rounded-lg border border-dashed border-black/10 dark:border-white/10 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              No Enable Banking sessions yet. Create one to start syncing your real bank accounts and link them to existing ledgers.
            </div>
          )}

          {connections.map(connection => {
            const providerAccounts = connection.accounts || [];
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
                    {(connection.status === 'requires_update' || !connection.sessionId) && (
                      <button
                        onClick={() => handleReauthorize(connection)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        Reauthorize
                      </button>
                    )}
                    <button
                      onClick={() => openSyncPrompt(connection)}
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

                <div className="overflow-x-auto rounded-lg border border-black/5 dark:border-white/10">
                  <table className="min-w-[720px] w-full text-sm">
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
                      {providerAccounts.length === 0 && (
                        <tr className="border-t border-black/5 dark:border-white/5">
                          <td className="px-3 py-3 text-sm" colSpan={5}>
                            <div className="text-light-text-secondary dark:text-dark-text-secondary">
                              No accounts fetched yet. Trigger a sync after completing bank authorization to load provider accounts.
                            </div>
                            {connection.lastError && (
                              <p className="mt-2 text-rose-600 dark:text-rose-300">
                                {connection.lastError}
                              </p>
                            )}
                            <button
                              onClick={() => openSyncPrompt(connection)}
                              className="mt-2 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text dark:text-dark-text text-xs font-semibold"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-sm">sync</span>
                              Trigger sync
                            </button>
                          </td>
                        </tr>
                      )}

                      {providerAccounts.map(account => {
                        const linkedAccount = accounts.find(acc => acc.id === account.linkedAccountId);
                        const accountLastFour = account.iban?.slice(-4) || account.accountNumber?.slice(-4);
                        const rowKey = keyPrefix(account.id);

                        const savedState = linkingState[rowKey] || {};
                        const defaultSyncStart = clampSyncDate(
                          savedState.syncStartDate ||
                            account.syncStartDate ||
                            connection.syncStartDate ||
                            ninetyDaysAgoStr
                        );
                        const rowState = {
                          mode: savedState.mode || (account.linkedAccountId ? 'existing' : 'create'),
                          accountId: savedState.accountId ?? account.linkedAccountId ?? '',
                          syncStartDate: defaultSyncStart,
                          newAccountName: savedState.newAccountName ?? account.name,
                          newAccountType: savedState.newAccountType ?? ('Checking' as AccountType),
                        };

                        return (
                          <tr key={account.id} className="border-t border-black/5 dark:border-white/5">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-light-text dark:text-dark-text">{account.name}</div>
                              <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {accountLastFour ? `Ending in ${accountLastFour}` : 'UID available after details fetch'}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-light-text dark:text-dark-text">
                              {account.currency} {account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-light-text dark:text-dark-text">
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`${rowKey}-mode`}
                                      checked={(rowState.mode || 'existing') === 'existing'}
                                      onChange={() => handleLinkChange(rowKey, { mode: 'existing' })}
                                    />
                                    Link to existing
                                  </label>
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`${rowKey}-mode`}
                                      checked={rowState.mode === 'create'}
                                      onChange={() =>
                                        handleLinkChange(rowKey, {
                                          mode: 'create',
                                          newAccountName: rowState.newAccountName || account.name,
                                          newAccountType: rowState.newAccountType || 'Checking',
                                        })
                                      }
                                    />
                                    Create new
                                  </label>
                                </div>

                                {(rowState.mode || 'existing') === 'existing' ? (
                                  <div>
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
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      className={`${INPUT_BASE_STYLE} text-sm`}
                                      value={rowState.newAccountName || ''}
                                      onChange={(e) => handleLinkChange(rowKey, { newAccountName: e.target.value })}
                                      placeholder="New account name"
                                    />
                                    <select
                                      className={`${INPUT_BASE_STYLE} text-sm`}
                                      value={rowState.newAccountType || 'Checking'}
                                      onChange={(e) => handleLinkChange(rowKey, { newAccountType: e.target.value as AccountType })}
                                    >
                                      {accountTypeOptions.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                      ))}
                                    </select>
                                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                      New account will use {account.currency} and start with the synced balance.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                className={`${INPUT_BASE_STYLE} text-sm`}
                                min={ninetyDaysAgoStr}
                                max={todayStr}
                                value={clampSyncDate(rowState.syncStartDate || defaultSyncStart) || ''}
                                onChange={(e) => handleLinkChange(rowKey, { syncStartDate: clampSyncDate(e.target.value) })}
                              />
                              <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Choose how far back to import (up to 90 days).</p>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => {
                                  const syncStartDate = clampSyncDate(rowState.syncStartDate || defaultSyncStart);
                                  if (!syncStartDate) {
                                    alert('Select a sync start date before linking.');
                                    return;
                                  }

                                  if ((rowState.mode || 'existing') === 'existing') {
                                    if (!rowState.accountId) {
                                      alert('Select an account before linking.');
                                      return;
                                    }

                                    handleLinkChange(rowKey, { syncStartDate });
                                    onLinkAccount(connection.id, account.id, {
                                      linkedAccountId: rowState.accountId,
                                      syncStartDate,
                                    });
                                  } else {
                                    const newAccountName = (rowState.newAccountName || account.name || '').trim();
                                    if (!newAccountName) {
                                      alert('Enter a name for the new account.');
                                      return;
                                    }

                                    handleLinkChange(rowKey, { syncStartDate, newAccountName });
                                    onLinkAccount(connection.id, account.id, {
                                      newAccountName,
                                      newAccountType: rowState.newAccountType || 'Checking',
                                      syncStartDate,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-sm">link</span>
                                Save link
                              </button>
                              <div className="mt-2 space-y-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                <div className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">event</span>
                                  <span>Default sync start: {defaultSyncStart}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">history</span>
                                  <span>Last sync: {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Pending'}</span>
                                </div>
                              </div>
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

        <div className="p-4 rounded-lg border border-black/5 dark:border-white/10 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-light-text dark:text-dark-text">Credentials</h4>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Stored locally in your browser. Keep them aligned with your Enable Banking project.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Application ID (kid)</label>
            <input
              type="text"
              name="applicationId"
              value={formState.applicationId}
              onChange={handleFormChange}
              placeholder="app_xxxxx"
              className={INPUT_BASE_STYLE}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary block">Client certificate (PEM)</label>
            <textarea
              name="clientCertificate"
              value={formState.clientCertificate}
              onChange={handleFormChange}
              placeholder="-----BEGIN PRIVATE KEY-----"
              rows={4}
              className={`${INPUT_BASE_STYLE} font-mono text-xs min-h-[120px]`}
            />
          </div>
        </div>

        <div className="rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <span className="material-symbols-outlined">bolt</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-light-text dark:text-dark-text">Authorize & sync</h4>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Use your saved credentials and selected bank to start the Enable Banking redirect flow.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              onClick={handleCreate}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              Start authorization
            </button>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary sm:text-right">
              You will be redirected to your bank. When you return, syncing begins for linked accounts using their start dates.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default EnableBankingIntegrationCard;

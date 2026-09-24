
import React, { useEffect, useMemo, useState } from 'react';
import Card from './Card';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import {
  Account,
  AccountType,
  EnableBankingAccount,
  EnableBankingConnection,
  EnableBankingLinkPayload,
  EnableBankingSyncOptions,
} from '../types';
import { toLocalISOString } from '../utils';
import { loadEnableBankingConfig, persistEnableBankingConfig } from '../utils/enableBankingStorage';
import EnableBankingSyncModal from './EnableBankingSyncModal';
import Icon from './ui/Icon';

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
    syncStartDate: string;
    targetAccountIds?: string[];
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
        countryCode: (formState.countryCode || '').trim().toUpperCase(),
        clientCertificate: formState.clientCertificate.trim(),
      });
      setBankOptions(options);
      updateFormState(prev => ({ ...prev, selectedBank: options[0]?.id || '' }));
    } catch (error: any) {
      console.error('Failed to load banks', error);
      setBankOptions([]);
      setBanksError(error?.message || 'Unable to load banks for the selected country');
    } finally {
      setBanksLoading(false);
    }
  };

  const openSyncPrompt = (connection: EnableBankingConnection, account?: EnableBankingAccount) => {
    const earliestAccountSyncDate = (account ? [account] : connection.accounts)
      ?.map(acc => clampSyncDate(acc.syncStartDate))
      .filter(Boolean)
      .sort()[0];

    const hasPreviousSync = account
      ? Boolean(account.lastSyncedAt)
      : Boolean(connection.accounts?.some(acc => acc.lastSyncedAt));
    const defaultTransactionMode = hasPreviousSync ? 'incremental' : 'full';

    setSyncPrompt({
      connectionId: connection.id,
      transactionMode: defaultTransactionMode,
      updateBalance: true,
      syncStartDate: clampSyncDate(earliestAccountSyncDate) || ninetyDaysAgoStr,
      targetAccountIds: account ? [account.id] : undefined,
    });
  };

  const confirmSync = (options: Required<Pick<EnableBankingSyncOptions, 'transactionMode' | 'updateBalance' | 'syncStartDate'>>) => {
    if (!syncPrompt) return;

    const connectionOverride = connections.find(conn => conn.id === syncPrompt.connectionId);

    onTriggerSync(syncPrompt.connectionId, connectionOverride, {
      transactionMode: options.transactionMode,
      updateBalance: options.updateBalance,
      syncStartDate: options.syncStartDate,
      targetAccountIds: syncPrompt.targetAccountIds,
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
      selectedBank: JSON.stringify({
          id: formState.selectedBank,
          name: bankOptions.find(option => option.id === formState.selectedBank)?.name || formState.selectedBank
      }),
    });

  };

  const handleReauthorize = (connection: EnableBankingConnection) => {
    const resolvedApplicationId = (connection.applicationId || formState.applicationId || '').trim();
    const resolvedCertificate = (connection.clientCertificate || formState.clientCertificate || '').trim();
    const resolvedCountry = (connection.countryCode || formState.countryCode || '').trim().toUpperCase();
    const resolvedBankId = (connection.selectedBankId || formState.selectedBank || '').trim();
    const resolvedBankName = connection.selectedBank || bankOptions.find(option => option.id === resolvedBankId)?.name || '';

    if (!resolvedApplicationId || !resolvedCertificate) {
      alert('Application ID and client certificate are required to reauthorize this connection.');
      return;
    }

    updateFormState(prev => ({
      ...prev,
      applicationId: resolvedApplicationId,
      clientCertificate: resolvedCertificate,
      countryCode: resolvedCountry,
      selectedBank: resolvedBankId || prev.selectedBank,
    }));

    onCreateConnection({
      applicationId: resolvedApplicationId,
      countryCode: resolvedCountry,
      clientCertificate: resolvedCertificate,
      selectedBank: JSON.stringify({
          id: resolvedBankId,
          name: resolvedBankName || connection.selectedBank || 'Enable Banking'
      }),
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
    const mapping: Record<EnableBankingConnection['status'], { label: string; dot: string; badge: string }> = {
      disconnected: {
        label: 'Disconnected',
        dot: 'bg-neutral-400',
        badge: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20',
      },
      pending: {
        label: 'Pending',
        dot: 'bg-amber-500 animate-pulse',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      },
      ready: {
        label: 'Ready',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      },
      requires_update: {
        label: 'Needs Reauth',
        dot: 'bg-rose-500',
        badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
      },
    };

    const entry = mapping[status] || mapping.disconnected;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${entry.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${entry.dot}`} />
        {entry.label}
      </span>
    );
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
    <div className="space-y-8">
      {syncPrompt && (
        <EnableBankingSyncModal
          isOpen={!!syncPrompt}
          title="Sync Enable Banking connection"
          description="Choose what to sync for this connection. Import transactions from your preferred start date or just refresh balances."
          minDate={ninetyDaysAgoStr}
          maxDate={todayStr}
          initialState={{
            transactionMode: syncPrompt.transactionMode,
            updateBalance: syncPrompt.updateBalance,
            syncStartDate: syncPrompt.syncStartDate,
          }}
          onClose={() => setSyncPrompt(null)}
          onConfirm={confirmSync}
        />
      )}

      {/* Creds Card */}
      <Card>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                <Icon name="key" className="text-xl" />
              </div>
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">Credentials Setup</h3>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              Save your Enable Banking API details locally to authorize new connections.
            </p>
            <p className="text-xs text-light-text-secondary/80 dark:text-dark-text-secondary/80 mt-1">
              Note: credentials are stored in this browser only and are not encrypted.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
            Local Storage
          </span>
        </div>

        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider block">
                Application ID (kid)
              </label>
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
              <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider block">
                Country code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="countryCode"
                  value={formState.countryCode}
                  onChange={handleFormChange}
                  placeholder="FI"
                  className={`${INPUT_BASE_STYLE} w-24 text-center uppercase font-semibold`}
                />
                <button
                  type="button"
                  onClick={loadBanks}
                  className={`${BTN_SECONDARY_STYLE} flex-1`}
                >
                  {banksLoading ? 'Loading...' : 'Load Banks'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider block">
              Client certificate (PEM)
            </label>
            <textarea
              name="clientCertificate"
              value={formState.clientCertificate}
              onChange={handleFormChange}
              placeholder="-----BEGIN PRIVATE KEY-----"
              rows={3}
              className={`${INPUT_BASE_STYLE} font-mono text-xs min-h-[80px] p-3`}
            />
          </div>
        </div>
      </Card>

      {/* Create New Card */}
      <Card className="bg-gradient-to-br from-primary-500/5 via-transparent to-transparent border border-primary-500/20 dark:border-primary-500/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary-500/25">
            <Icon name="add_link" className="text-xl" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-light-text dark:text-dark-text mb-1 tracking-tight">New Connection</h4>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
              Select a bank from the loaded list to start an authorization flow.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className={`${SELECT_WRAPPER_STYLE} flex-1`}>
                <select
                  name="selectedBank"
                  value={formState.selectedBank}
                  onChange={handleFormChange}
                  className={SELECT_STYLE}
                  disabled={banksLoading || bankOptions.length === 0}
                >
                  {bankOptions.length === 0 && <option value="">Load banks first...</option>}
                  {bankOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {option.country ? ` (${option.country})` : ''}
                    </option>
                  ))}
                </select>
                <div className={SELECT_ARROW_STYLE}>
                  <Icon name="expand_more" />
                </div>
              </div>
              <button
                onClick={handleCreate}
                className={`${BTN_PRIMARY_STYLE} whitespace-nowrap`}
                disabled={!formState.selectedBank}
              >
                Start Authorization
              </button>
            </div>
            {banksError && <p className="text-xs text-rose-500 mt-2 font-medium">{banksError}</p>}
          </div>
        </div>
      </Card>

      {/* Connections List */}
      <Card className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-light-text dark:text-dark-text tracking-tight">
              Connections
            </h3>
            {readyConnections > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {readyConnections} active
              </span>
            )}
          </div>
          <span className="text-xs font-semibold bg-black/5 dark:bg-white/10 px-3 py-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary">
            {connections.length} total
          </span>
        </div>

        {connections.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl border-2 border-dashed border-black/10 dark:border-white/10 text-center bg-black/[0.01] dark:bg-white/[0.01]">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-400 dark:text-neutral-500 mx-auto mb-3">
              <Icon name="link_off" className="text-3xl" />
            </div>
            <p className="text-light-text dark:text-dark-text font-bold">No active connections</p>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
              Add credentials and choose a bank above to establish your first open banking link.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {connections.map(connection => {
              const providerAccounts = connection.accounts || [];
              const keyPrefix = (accountId: string) => `${connection.id}:${accountId}`;

              return (
                <div
                  key={connection.id}
                  className="bg-white/90 dark:bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-black/10 dark:border-white/10 shadow-sm overflow-hidden transition-all duration-200"
                >
                  {/* Connection Header Bar */}
                  <div className="p-5 sm:p-6 border-b border-black/5 dark:border-white/5 bg-gradient-to-b from-black/[0.02] to-transparent dark:from-white/[0.02] dark:to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="account_balance" className="text-2xl" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h4 className="text-lg sm:text-xl font-bold text-light-text dark:text-dark-text tracking-tight">
                            {connection.selectedBank || 'Bank Connection'}
                          </h4>
                          {renderStatusBadge(connection.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          <span className="font-mono bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md">
                            Session: {connection.sessionId ? `${connection.sessionId.slice(0, 10)}...` : 'pending'}
                          </span>
                          {connection.sessionExpiresAt && (
                            <>
                              <span className="opacity-40">•</span>
                              <span>Expires {new Date(connection.sessionExpiresAt).toLocaleDateString()}</span>
                            </>
                          )}
                          <span className="opacity-40">•</span>
                          <span>Last sync: {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Never'}</span>
                        </div>
                        {connection.lastError && (
                          <div className="mt-2 inline-flex flex-wrap items-center gap-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                            <p className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                              <Icon name="warning" className="text-sm shrink-0" />
                              Error: {connection.lastError}
                            </p>
                            {(connection.status === 'requires_update' || !connection.sessionId) && (
                              <button
                                type="button"
                                onClick={() => handleReauthorize(connection)}
                                className="font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer ml-1"
                              >
                                Re-authorize now
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                      {(connection.status === 'requires_update' || !connection.sessionId) && (
                        <button
                          type="button"
                          onClick={() => handleReauthorize(connection)}
                          className={`${BTN_SECONDARY_STYLE} text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5`}
                        >
                          <Icon name="refresh" className="text-base" />
                          <span>Reauth</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openSyncPrompt(connection)}
                        className="h-9 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition-all flex items-center gap-1.5 active:scale-98 cursor-pointer shadow-xs"
                        title="Sync all accounts for this connection"
                      >
                        <Icon name="sync" className="text-sm" />
                        <span>Trigger sync</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConnection(connection.id)}
                        className={`${BTN_DANGER_STYLE} gap-1.5`}
                        title="Remove connection"
                      >
                        <Icon name="delete" className="text-sm" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* Accounts List Container */}
                  <div className="p-5 sm:p-6 space-y-5">
                    {providerAccounts.length === 0 ? (
                      <div className="text-center py-8 text-sm text-light-text-secondary dark:text-dark-text-secondary bg-neutral-50/50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center gap-2">
                        <Icon name="account_balance_wallet" className="text-3xl text-neutral-400 opacity-60" />
                        <p className="font-semibold text-light-text dark:text-dark-text">No accounts discovered yet</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          Click "Trigger sync" above to query your provider for available bank accounts.
                        </p>
                      </div>
                    ) : (
                      providerAccounts.map(account => {
                        const linkedAccount = accounts.find(acc => acc.id === account.linkedAccountId);
                        const accountLastFour = account.accountNumber?.slice(-4);
                        const rowKey = keyPrefix(account.id);
                        const savedState = linkingState[rowKey] || {};
                        const defaultSyncStart = clampSyncDate(savedState.syncStartDate || account.syncStartDate || ninetyDaysAgoStr);
                        const balanceSyncLabel = linkedAccount?.balanceLastSyncedAt
                          ? `Balance synced ${new Date(linkedAccount.balanceLastSyncedAt).toLocaleString()} via ${
                              linkedAccount.balanceSource === 'enable_banking' ? 'Enable Banking' : 'Manual'
                            }`
                          : null;

                        const rowState = {
                          mode: savedState.mode || (account.linkedAccountId ? 'existing' : 'create'),
                          accountId: savedState.accountId ?? account.linkedAccountId ?? '',
                          syncStartDate: defaultSyncStart,
                          newAccountName: savedState.newAccountName ?? account.name,
                          newAccountType: savedState.newAccountType ?? ('Checking' as AccountType),
                        };

                        return (
                          <div
                            key={account.id}
                            className="border border-black/8 dark:border-white/8 rounded-2xl p-5 sm:p-6 bg-white/70 dark:bg-white/[0.02] shadow-xs hover:border-primary-500/40 transition-all duration-200 space-y-5"
                          >
                            {/* Account Overview Header */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-black/5 dark:border-white/5">
                              <div className="flex items-start gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0 shadow-xs">
                                  <Icon name="account_balance_wallet" className="text-2xl" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h5 className="font-bold text-light-text dark:text-dark-text text-base sm:text-lg tracking-tight">
                                      {account.name}
                                    </h5>
                                    {accountLastFour && (
                                      <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary font-semibold">
                                        •••• {accountLastFour}
                                      </span>
                                    )}
                                    <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary">
                                      {account.currency}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    {linkedAccount ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <Icon name="link" className="text-xs" />
                                        Linked to <strong className="font-bold">{linkedAccount.name}</strong>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        <Icon name="link_off" className="text-xs" />
                                        Unlinked Account
                                      </span>
                                    )}
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary text-xs opacity-75">
                                      {balanceSyncLabel ||
                                        (connection.lastSyncedAt
                                          ? `Last synced: ${new Date(connection.lastSyncedAt).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}`
                                          : 'Sync pending')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Balance & Quick Sync */}
                              <div className="flex items-center justify-between lg:justify-end gap-5">
                                <div className="text-left lg:text-right">
                                  <p className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                    AVAILABLE BALANCE
                                  </p>
                                  <p className="text-2xl sm:text-3xl font-extrabold text-light-text dark:text-dark-text tracking-tight">
                                    {account.currency}{' '}
                                    {account.balance.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openSyncPrompt(connection, account)}
                                  className={`${BTN_SECONDARY_STYLE} h-9 text-xs px-3.5 gap-1.5 shrink-0`}
                                  title="Sync this account"
                                >
                                  <Icon name="sync" className="text-sm" />
                                  <span>Sync account</span>
                                </button>
                              </div>
                            </div>

                            {/* Configuration Drawer / Box */}
                            <div className="bg-neutral-50/70 dark:bg-black/25 rounded-2xl p-4 sm:p-5 border border-black/5 dark:border-white/5 space-y-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Icon name="tune" className="text-base text-primary-500" />
                                  <h6 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                    Account Mapping & Sync Rules
                                  </h6>
                                </div>
                                <span className="text-2xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 hidden sm:inline">
                                  Ledger target & historical start date
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Col 1: Destination Account */}
                                <div className="space-y-2.5">
                                  <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider block">
                                    LINK TARGET
                                  </label>

                                  {/* Segmented Mode Switcher */}
                                  <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10">
                                    <button
                                      type="button"
                                      onClick={() => handleLinkChange(rowKey, { mode: 'existing' })}
                                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                                        (rowState.mode || 'existing') === 'existing'
                                          ? 'bg-white dark:bg-white/15 text-light-text dark:text-dark-text shadow-xs'
                                          : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                      }`}
                                    >
                                      <Icon name="link" className="text-sm" />
                                      Link to existing
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleLinkChange(rowKey, {
                                          mode: 'create',
                                          newAccountName: rowState.newAccountName || account.name,
                                          newAccountType: rowState.newAccountType || 'Checking',
                                        })
                                      }
                                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                                        rowState.mode === 'create'
                                          ? 'bg-white dark:bg-white/15 text-light-text dark:text-dark-text shadow-xs'
                                          : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                      }`}
                                    >
                                      <Icon name="add" className="text-sm" />
                                      Create new
                                    </button>
                                  </div>

                                  {(rowState.mode || 'existing') === 'existing' ? (
                                    <div className={SELECT_WRAPPER_STYLE}>
                                      <select
                                        className={`${SELECT_STYLE} !text-sm`}
                                        value={rowState.accountId || ''}
                                        onChange={e => handleLinkChange(rowKey, { accountId: e.target.value })}
                                      >
                                        <option value="">Select account to link...</option>
                                        {accounts.map(acc => (
                                          <option
                                            key={acc.id}
                                            value={acc.id}
                                            disabled={linkedAccounts.has(acc.id) && acc.id !== account.linkedAccountId}
                                          >
                                            {acc.name} ({acc.currency})
                                          </option>
                                        ))}
                                      </select>
                                      <div className={SELECT_ARROW_STYLE}>
                                        <Icon name="expand_more" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        className={`${INPUT_BASE_STYLE} !text-sm`}
                                        value={rowState.newAccountName || ''}
                                        onChange={e => handleLinkChange(rowKey, { newAccountName: e.target.value })}
                                        placeholder="New account name"
                                      />
                                      <div className={SELECT_WRAPPER_STYLE}>
                                        <select
                                          className={`${SELECT_STYLE} !text-sm`}
                                          value={rowState.newAccountType || 'Checking'}
                                          onChange={e =>
                                            handleLinkChange(rowKey, { newAccountType: e.target.value as AccountType })
                                          }
                                        >
                                          {accountTypeOptions.map(type => (
                                            <option key={type} value={type}>
                                              {type}
                                            </option>
                                          ))}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}>
                                          <Icon name="expand_more" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Col 2: Sync Start Date */}
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider block">
                                      SYNC START
                                    </label>
                                    <span className="text-2xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                      Up to 90 days
                                    </span>
                                  </div>
                                  <input
                                    type="date"
                                    className={`${INPUT_BASE_STYLE} !text-sm`}
                                    min={ninetyDaysAgoStr}
                                    max={todayStr}
                                    value={clampSyncDate(rowState.syncStartDate || defaultSyncStart) || ''}
                                    onChange={e =>
                                      handleLinkChange(rowKey, { syncStartDate: clampSyncDate(e.target.value) })
                                    }
                                  />
                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-snug">
                                    Choose how far back to import (up to 90 days). Future syncs will continue from where
                                    they left off.
                                  </p>
                                </div>
                              </div>

                              {/* Footer: Metadata & Save Link Button */}
                              <div className="pt-3 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Icon name="calendar_today" className="text-sm opacity-70" />
                                    <span>
                                      Sync start:{' '}
                                      <strong className="font-semibold text-light-text dark:text-dark-text">
                                        {defaultSyncStart}
                                      </strong>
                                    </span>
                                  </span>
                                  <span className="opacity-40">•</span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Icon name="history" className="text-sm opacity-70" />
                                    <span>
                                      Last sync:{' '}
                                      <strong className="font-semibold text-light-text dark:text-dark-text">
                                        {connection.lastSyncedAt
                                          ? new Date(connection.lastSyncedAt).toLocaleString()
                                          : 'Pending'}
                                      </strong>
                                    </span>
                                  </span>
                                </div>

                                <button
                                  type="button"
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
                                        newAccount: {
                                          name: newAccountName,
                                          type: rowState.newAccountType || 'Checking',
                                          balance: account.balance,
                                          currency: account.currency,
                                        },
                                        syncStartDate,
                                      });
                                    }
                                  }}
                                  className={`${BTN_PRIMARY_STYLE} gap-2 px-5 shrink-0`}
                                >
                                  <Icon name="link" className="text-base" />
                                  <span>Save link</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnableBankingIntegrationCard;

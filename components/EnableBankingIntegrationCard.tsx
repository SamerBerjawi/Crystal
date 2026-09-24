import React, { useEffect, useMemo, useState } from 'react';
import Card from './Card';
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

export const EnableBankingIntegrationCard: React.FC<EnableBankingIntegrationCardProps> = ({
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

  const hasCredentials = Boolean(formState.applicationId.trim() && formState.clientCertificate.trim());
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set());

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
  const thirtyDaysAgoStr = useMemo(() => toLocalISOString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), []);
  const sixtyDaysAgoStr = useMemo(() => toLocalISOString(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)), []);
  const ninetyDaysAgoStr = useMemo(() => toLocalISOString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)), []);

  const accountTypeOptions: AccountType[] = useMemo(
    () => ['Checking', 'Savings', 'Credit Card', 'Investment', 'Loan', 'Property', 'Vehicle', 'Other Assets', 'Other Liabilities', 'Lending'],
    []
  );

  const linkedAccounts = useMemo(
    () => new Set(connections.flatMap(conn => conn.accounts.map(acc => acc.linkedAccountId).filter(Boolean) as string[])),
    [connections]
  );

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateFormState(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const savedConfig = loadEnableBankingConfig();
    if (savedConfig) {
      updateFormState(prev => ({ ...prev, ...savedConfig }));
      if (!savedConfig.applicationId?.trim() || !savedConfig.clientCertificate?.trim()) {
        setIsCredentialsOpen(true);
      }
    } else {
      setIsCredentialsOpen(true);
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
      alert('Enter Application ID and Client Certificate first.');
      setIsCredentialsOpen(true);
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
      setBanksError(error?.message || 'Unable to load banks for this country.');
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
      alert('Application ID and client certificate are required.');
      setIsCredentialsOpen(true);
      return;
    }

    if (!formState.selectedBank) {
      alert('Select a bank first.');
      return;
    }

    onCreateConnection({
      applicationId: formState.applicationId,
      countryCode: formState.countryCode,
      clientCertificate: formState.clientCertificate,
      selectedBank: JSON.stringify({
        id: formState.selectedBank,
        name: bankOptions.find(option => option.id === formState.selectedBank)?.name || formState.selectedBank,
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
      alert('Application ID and certificate are required to reauthorize.');
      setIsCredentialsOpen(true);
      return;
    }

    onCreateConnection({
      applicationId: resolvedApplicationId,
      countryCode: resolvedCountry,
      clientCertificate: resolvedCertificate,
      selectedBank: JSON.stringify({
        id: resolvedBankId,
        name: resolvedBankName || connection.selectedBank || 'Enable Banking',
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

  const toggleRowExpansion = (rowKey: string) => {
    setExpandedRowKeys(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const renderStatusBadge = (status: EnableBankingConnection['status']) => {
    const mapping: Record<EnableBankingConnection['status'], { label: string; dot: string; badge: string }> = {
      disconnected: {
        label: 'Disconnected',
        dot: 'bg-neutral-400',
        badge: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20',
      },
      pending: {
        label: 'Pending Auth',
        dot: 'bg-amber-500 animate-pulse',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      },
      ready: {
        label: 'Active',
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
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium leading-none border ${entry.badge}`}>
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
  const totalDiscoveredAccounts = useMemo(
    () => connections.reduce((sum, connection) => sum + (connection.accounts?.length || 0), 0),
    [connections]
  );

  return (
    <div className="space-y-4">
      {syncPrompt && (
        <EnableBankingSyncModal
          isOpen={!!syncPrompt}
          title="Sync Connection"
          description="Choose whether to run a full transaction backfill or an incremental sync."
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

      {/* 1. COMPACT CREDENTIALS ACCORDION BAR */}
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md overflow-hidden transition-all duration-200">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
              hasCredentials
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              <Icon name={hasCredentials ? 'lock' : 'key'} className="text-sm" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-light-text dark:text-dark-text tracking-tight">
                  Enable Banking API
                </span>
                {hasCredentials ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-normal tracking-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    kid: {formState.applicationId.slice(0, 10)}...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Credentials required
                  </span>
                )}
                <span className="text-[10px] uppercase font-mono font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary">
                  {formState.countryCode || 'FI'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCredentialsOpen(prev => !prev)}
            className="flex items-center gap-1.5 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text px-2.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <span>{isCredentialsOpen ? 'Hide Settings' : hasCredentials ? 'Edit Keys' : 'Configure'}</span>
            <Icon name={isCredentialsOpen ? 'expand_less' : 'expand_more'} className="text-base" />
          </button>
        </div>

        {/* Collapsible Credentials Form Drawer */}
        {isCredentialsOpen && (
          <div className="border-t border-black/5 dark:border-white/5 p-4 bg-black/[0.015] dark:bg-black/20 space-y-3.5 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block">
                  Application ID (kid)
                </label>
                <input
                  type="text"
                  name="applicationId"
                  value={formState.applicationId}
                  onChange={handleFormChange}
                  placeholder="app_xxxxxxxx"
                  className="w-full h-8.5 text-xs px-3 rounded-xl bg-white dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1.5 focus:ring-primary-500/50 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block">
                  Default Country
                </label>
                <input
                  type="text"
                  name="countryCode"
                  value={formState.countryCode}
                  onChange={handleFormChange}
                  placeholder="FI"
                  maxLength={2}
                  className="w-full h-8.5 text-xs text-center font-bold uppercase rounded-xl bg-white dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1.5 focus:ring-primary-500/50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block">
                  Client Certificate (PEM Private Key)
                </label>
                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                  Stored securely in local browser storage
                </span>
              </div>
              <textarea
                name="clientCertificate"
                value={formState.clientCertificate}
                onChange={handleFormChange}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                rows={2}
                className="w-full text-2xs font-mono p-2.5 rounded-xl bg-white dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1.5 focus:ring-primary-500/50 resize-y"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                Credentials are saved automatically to your device.
              </span>
              <button
                type="button"
                onClick={() => setIsCredentialsOpen(false)}
                className="h-7 px-3 rounded-lg text-2xs font-bold bg-black/5 dark:bg-white/10 text-light-text dark:text-dark-text hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. COMPACT BANK AUTHORIZATION TOOLBAR */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="add_circle" className="text-sm text-primary-500" />
            <h4 className="text-xs font-bold text-light-text dark:text-dark-text tracking-tight uppercase">
              Connect a Bank
            </h4>
          </div>
          {bankOptions.length > 0 && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {bankOptions.length} banks available
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Country Code + Load Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              name="countryCode"
              value={formState.countryCode}
              onChange={handleFormChange}
              placeholder="FI"
              maxLength={2}
              title="Country code (2 letters)"
              className="w-13 h-8.5 text-xs text-center font-bold uppercase rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1.5 focus:ring-primary-500/50"
            />
            <button
              type="button"
              onClick={loadBanks}
              disabled={banksLoading}
              className="h-8.5 px-3 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-light-text dark:text-dark-text border border-black/5 dark:border-white/10 transition-all flex items-center gap-1.5 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Icon name={banksLoading ? 'sync' : 'search'} className={`text-sm ${banksLoading ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">{banksLoading ? 'Loading...' : 'Find Banks'}</span>
            </button>
          </div>

          {/* Bank Select Dropdown */}
          <div className="relative flex-1 min-w-0">
            <select
              name="selectedBank"
              value={formState.selectedBank}
              onChange={handleFormChange}
              disabled={banksLoading || bankOptions.length === 0}
              className="w-full h-8.5 pl-3 pr-8 text-xs font-medium rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1.5 focus:ring-primary-500/50 appearance-none truncate cursor-pointer disabled:opacity-50"
            >
              {bankOptions.length === 0 ? (
                <option value="">{hasCredentials ? 'Click "Find Banks" to view institutions...' : 'Configure credentials first...'}</option>
              ) : (
                bankOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name} {option.country ? `(${option.country})` : ''}
                  </option>
                ))
              )}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-light-text-secondary opacity-50">
              <Icon name="expand_more" className="text-sm" />
            </div>
          </div>

          {/* Authorize Button */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={!formState.selectedBank}
            className="h-8.5 px-4 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-500 active:scale-98 text-white transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Icon name="add_link" className="text-sm" />
            <span className="whitespace-nowrap">Authorize Link</span>
          </button>
        </div>

        {banksError && (
          <p className="text-2xs text-rose-500 font-medium flex items-center gap-1">
            <Icon name="error" className="text-xs" />
            <span>{banksError}</span>
          </p>
        )}
      </div>

      {/* 3. ACTIVE CONNECTIONS & ACCOUNTS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
              Active Connections
            </h3>
            {readyConnections > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {readyConnections} ready
              </span>
            )}
          </div>
          <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-normal">
            {connections.length} {connections.length === 1 ? 'connection' : 'connections'} • {totalDiscoveredAccounts} {totalDiscoveredAccounts === 1 ? 'account' : 'accounts'}
          </span>
        </div>

        {connections.length === 0 ? (
          <div className="py-8 px-4 rounded-2xl border border-dashed border-black/10 dark:border-white/10 text-center bg-black/[0.01] dark:bg-white/[0.01]">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-400 dark:text-neutral-500 mx-auto mb-2">
              <Icon name="account_balance" className="text-xl" />
            </div>
            <p className="text-xs font-bold text-light-text dark:text-dark-text">No bank connections yet</p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 max-w-sm mx-auto">
              Find your bank and click "Authorize Link" above to establish open banking synchronization.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(connection => {
              const providerAccounts = connection.accounts || [];
              const keyPrefix = (accountId: string) => `${connection.id}:${accountId}`;

              return (
                <div
                  key={connection.id}
                  className="rounded-2xl border border-black/8 dark:border-white/8 bg-white/80 dark:bg-white/[0.025] backdrop-blur-md shadow-xs overflow-hidden transition-all"
                >
                  {/* COMPACT CONNECTION HEADER */}
                  <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-2.5 bg-black/[0.01] dark:bg-white/[0.01]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                        <Icon name="account_balance" className="text-base" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-light-text dark:text-dark-text truncate">
                            {connection.selectedBank || 'Bank Institution'}
                          </h4>
                          {renderStatusBadge(connection.status)}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-normal">
                          {connection.sessionExpiresAt && (
                            <span>Expires {new Date(connection.sessionExpiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          )}
                          <span className="opacity-40">•</span>
                          <span>
                            {connection.lastSyncedAt
                              ? `Synced ${new Date(connection.lastSyncedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                              : 'Never synced'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Connection Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      {(connection.status === 'requires_update' || !connection.sessionId) && (
                        <button
                          type="button"
                          onClick={() => handleReauthorize(connection)}
                          className="h-7 px-2.5 rounded-lg text-2xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Icon name="refresh" className="text-xs" />
                          <span>Reauth</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openSyncPrompt(connection)}
                        className="h-7 px-2.5 rounded-lg text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                        title="Sync all accounts"
                      >
                        <Icon name="sync" className="text-xs" />
                        <span>Sync All</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConnection(connection.id)}
                        className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-all cursor-pointer"
                        title="Delete connection"
                      >
                        <Icon name="delete" className="text-sm" />
                      </button>
                    </div>
                  </div>

                  {/* ACCOUNTS LIST INSIDE CONNECTION */}
                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {providerAccounts.length === 0 ? (
                      <div className="py-5 px-4 text-center">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          No accounts discovered yet. Tap "Sync All" above to query your bank.
                        </p>
                      </div>
                    ) : (
                      providerAccounts.map(account => {
                        const linkedAccount = accounts.find(acc => acc.id === account.linkedAccountId);
                        const accountLastFour = account.accountNumber?.slice(-4);
                        const rowKey = keyPrefix(account.id);
                        const savedState = linkingState[rowKey] || {};
                        const defaultSyncStart = clampSyncDate(savedState.syncStartDate || account.syncStartDate || ninetyDaysAgoStr);

                        const rowState = {
                          mode: savedState.mode || (account.linkedAccountId ? 'existing' : 'create'),
                          accountId: savedState.accountId ?? account.linkedAccountId ?? '',
                          syncStartDate: defaultSyncStart,
                          newAccountName: savedState.newAccountName ?? account.name,
                          newAccountType: savedState.newAccountType ?? ('Checking' as AccountType),
                        };

                        const isExpanded = expandedRowKeys.has(rowKey) || !account.linkedAccountId;

                        return (
                          <div key={account.id} className="p-3 sm:p-3.5 space-y-2.5 transition-colors">
                            {/* Account summary line */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-white/[0.05] text-primary-500 flex items-center justify-center shrink-0">
                                  <Icon name="account_balance_wallet" className="text-sm" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-light-text dark:text-dark-text truncate">
                                      {account.name}
                                    </span>
                                    {accountLastFour && (
                                      <span className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-light-text-secondary">
                                        •••• {accountLastFour}
                                      </span>
                                    )}
                                    <span className="text-[10px] uppercase font-mono font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-light-text-secondary">
                                      {account.currency}
                                    </span>
                                  </div>

                                  {/* Linked Badge & Toggle */}
                                  <div className="flex items-center gap-2 text-[10px] mt-0.5">
                                    {linkedAccount ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <Icon name="link" className="text-xs" />
                                        Linked to <strong>{linkedAccount.name}</strong>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                        <Icon name="link_off" className="text-xs" />
                                        Not linked
                                      </span>
                                    )}

                                    {account.linkedAccountId && (
                                      <button
                                        type="button"
                                        onClick={() => toggleRowExpansion(rowKey)}
                                        className="text-primary-500 hover:underline font-medium text-[10px] cursor-pointer ml-1"
                                      >
                                        {isExpanded ? 'Hide Mapping' : 'Edit Mapping'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Balance & Account Sync Button */}
                              <div className="flex items-center gap-3 shrink-0 ml-auto">
                                <div className="text-right">
                                  <span className="text-[9px] uppercase tracking-wider text-light-text-secondary opacity-60 block">Balance</span>
                                  <span className="font-mono font-bold text-xs sm:text-sm text-light-text dark:text-dark-text">
                                    {account.currency} {account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openSyncPrompt(connection, account)}
                                  className="h-7 px-2 rounded-lg text-2xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 text-light-text dark:text-dark-text flex items-center gap-1 transition-all cursor-pointer"
                                  title="Sync this account"
                                >
                                  <Icon name="sync" className="text-xs" />
                                  <span className="hidden sm:inline">Sync</span>
                                </button>
                              </div>
                            </div>

                            {/* COMPACT MAPPING & DATE DRAWER */}
                            {isExpanded && (
                              <div className="p-2.5 sm:p-3 rounded-xl bg-black/[0.02] dark:bg-black/30 border border-black/5 dark:border-white/5 space-y-2.5 animate-fade-in text-xs">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {/* Target Account Column */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary">
                                        Destination Account
                                      </label>
                                      {/* Tiny Segmented Toggle */}
                                      <div className="flex p-0.5 bg-black/5 dark:bg-white/10 rounded-lg text-[10px] font-medium">
                                        <button
                                          type="button"
                                          onClick={() => handleLinkChange(rowKey, { mode: 'existing' })}
                                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                            (rowState.mode || 'existing') === 'existing'
                                              ? 'bg-white dark:bg-white/20 text-light-text dark:text-dark-text shadow-2xs'
                                              : 'text-light-text-secondary'
                                          }`}
                                        >
                                          Existing
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
                                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                            rowState.mode === 'create'
                                              ? 'bg-white dark:bg-white/20 text-light-text dark:text-dark-text shadow-2xs'
                                              : 'text-light-text-secondary'
                                          }`}
                                        >
                                          New
                                        </button>
                                      </div>
                                    </div>

                                    {(rowState.mode || 'existing') === 'existing' ? (
                                      <div className="relative">
                                        <select
                                          className="w-full h-8 pl-2.5 pr-7 text-xs rounded-lg bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-primary-500 appearance-none truncate cursor-pointer"
                                          value={rowState.accountId || ''}
                                          onChange={e => handleLinkChange(rowKey, { accountId: e.target.value })}
                                        >
                                          <option value="">Select account to map...</option>
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
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-light-text-secondary opacity-50">
                                          <Icon name="expand_more" className="text-xs" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <input
                                          type="text"
                                          className="h-8 px-2.5 text-xs rounded-lg bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          value={rowState.newAccountName || ''}
                                          onChange={e => handleLinkChange(rowKey, { newAccountName: e.target.value })}
                                          placeholder="Account name"
                                        />
                                        <div className="relative">
                                          <select
                                            className="w-full h-8 pl-2 pr-6 text-xs rounded-lg bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-primary-500 appearance-none cursor-pointer"
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
                                          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 pointer-events-none text-light-text-secondary opacity-50">
                                            <Icon name="expand_more" className="text-xs" />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Sync Start Date Column (with Quick Presets!) */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary">
                                        Sync Start Date
                                      </label>
                                      {/* Quick Presets: 30d, 60d, 90d */}
                                      <div className="flex items-center gap-1">
                                        {[
                                          { label: '30d', val: thirtyDaysAgoStr },
                                          { label: '60d', val: sixtyDaysAgoStr },
                                          { label: '90d', val: ninetyDaysAgoStr },
                                        ].map(preset => {
                                          const isActive = (rowState.syncStartDate || defaultSyncStart) === preset.val;
                                          return (
                                            <button
                                              key={preset.label}
                                              type="button"
                                              onClick={() => handleLinkChange(rowKey, { syncStartDate: preset.val })}
                                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                                                isActive
                                                  ? 'bg-primary-600 text-white shadow-2xs'
                                                  : 'bg-black/5 dark:bg-white/10 text-light-text-secondary hover:text-light-text'
                                              }`}
                                            >
                                              {preset.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="date"
                                        className="h-8 px-2 text-xs rounded-lg bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-light-text dark:text-dark-text focus:outline-none focus:ring-1 focus:ring-primary-500 flex-1 min-w-0"
                                        min={ninetyDaysAgoStr}
                                        max={todayStr}
                                        value={clampSyncDate(rowState.syncStartDate || defaultSyncStart) || ''}
                                        onChange={e =>
                                          handleLinkChange(rowKey, { syncStartDate: clampSyncDate(e.target.value) })
                                        }
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const syncStartDate = clampSyncDate(rowState.syncStartDate || defaultSyncStart);
                                          if (!syncStartDate) {
                                            alert('Select a sync start date.');
                                            return;
                                          }

                                          if ((rowState.mode || 'existing') === 'existing') {
                                            if (!rowState.accountId) {
                                              alert('Select an existing account to link.');
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

                                          // Collapse row on save
                                          toggleRowExpansion(rowKey);
                                        }}
                                        className="h-8 px-3 rounded-lg text-xs font-bold bg-primary-600 hover:bg-primary-500 active:scale-98 text-white transition-all flex items-center gap-1 shrink-0 shadow-xs cursor-pointer"
                                      >
                                        <Icon name="check" className="text-xs" />
                                        <span>Save</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
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
      </div>
    </div>
  );
};

export default EnableBankingIntegrationCard;

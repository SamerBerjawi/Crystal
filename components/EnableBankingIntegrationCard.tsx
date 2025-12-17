
import React, { useEffect, useMemo, useState } from 'react';
import Card from './Card';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { Account, AccountType, EnableBankingConnection, EnableBankingLinkPayload, EnableBankingSyncOptions } from '../types';
import { toLocalISOString } from '../utils';
import { loadEnableBankingConfig, persistEnableBankingConfig } from '../utils/enableBankingStorage';
import EnableBankingSyncModal from './EnableBankingSyncModal';

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
    const earliestAccountSyncDate = connection.accounts
      ?.map(acc => clampSyncDate(acc.syncStartDate))
      .filter(Boolean)
      .sort()[0];

    setSyncPrompt({
      connectionId: connection.id,
      transactionMode: 'full',
      updateBalance: true,
      syncStartDate: clampSyncDate(earliestAccountSyncDate) || ninetyDaysAgoStr,
    });
  };

  const confirmSync = (options: Required<Pick<EnableBankingSyncOptions, 'transactionMode' | 'updateBalance' | 'syncStartDate'>>) => {
    if (!syncPrompt) return;

    const connectionOverride = connections.find(conn => conn.id === syncPrompt.connectionId);

    onTriggerSync(syncPrompt.connectionId, connectionOverride, {
      transactionMode: options.transactionMode,
      updateBalance: options.updateBalance,
      syncStartDate: options.syncStartDate,
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
      disconnected: { label: 'Disconnected', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
      pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
      ready: { label: 'Ready', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
      requires_update: { label: 'Needs Reauth', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
    };

    const entry = mapping[status];
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${entry.color}`}>{entry.label}</span>;
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
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                <span className="material-symbols-outlined">key</span>
              </div>
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Credentials Setup</h3>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              Save your Enable Banking API details locally to authorize new connections.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Local Storage</span>
        </div>

        <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider block">Application ID (kid)</label>
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
                     <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider block">Country code</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            name="countryCode"
                            value={formState.countryCode}
                            onChange={handleFormChange}
                            placeholder="FI"
                            className={`${INPUT_BASE_STYLE} w-20 text-center uppercase`}
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
                <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider block">Client certificate (PEM)</label>
                <textarea
                name="clientCertificate"
                value={formState.clientCertificate}
                onChange={handleFormChange}
                placeholder="-----BEGIN PRIVATE KEY-----"
                rows={3}
                className={`${INPUT_BASE_STYLE} font-mono text-xs min-h-[80px]`}
                />
            </div>
        </div>
      </Card>
      
      {/* Create New Card */}
      <Card className="bg-gradient-to-br from-primary-50 to-white dark:from-dark-card dark:to-primary-900/10 border border-primary-100 dark:border-primary-800/30">
          <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/30">
                  <span className="material-symbols-outlined">add_link</span>
               </div>
               <div className="flex-1">
                   <h4 className="text-lg font-bold text-light-text dark:text-dark-text mb-1">New Connection</h4>
                   <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">Select a bank from the loaded list to start an authorization flow.</p>
                   
                   <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            name="selectedBank"
                            value={formState.selectedBank}
                            onChange={handleFormChange}
                            className={`${INPUT_BASE_STYLE} flex-1`}
                            disabled={banksLoading || bankOptions.length === 0}
                        >
                            {bankOptions.length === 0 && <option value="">Load banks first...</option>}
                            {bankOptions.map(option => (
                                <option key={option.id} value={option.name}>{option.name}{option.country ? ` (${option.country})` : ''}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleCreate}
                            className={`${BTN_PRIMARY_STYLE} whitespace-nowrap`}
                            disabled={!formState.selectedBank}
                        >
                            Start Authorization
                        </button>
                   </div>
                   {banksError && <p className="text-xs text-red-500 mt-2 font-medium">{banksError}</p>}
               </div>
          </div>
      </Card>

      {/* Connections List */}
      <div>
          <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Connections</h3>
              <span className="text-xs font-medium bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md text-light-text-secondary dark:text-dark-text-secondary">{connections.length} total</span>
          </div>

          {connections.length === 0 ? (
             <div className="p-8 rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 text-center">
                 <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">link_off</span>
                 <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">No active connections</p>
                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Add a bank above to get started.</p>
             </div>
          ) : (
            <div className="space-y-6">
                {connections.map(connection => {
                    const providerAccounts = connection.accounts || [];
                    const keyPrefix = (accountId: string) => `${connection.id}:${accountId}`;

                    return (
                    <div key={connection.id} className="bg-white dark:bg-dark-card rounded-2xl border border-black/5 dark:border-white/10 shadow-sm overflow-hidden">
                        {/* Connection Header */}
                        <div className="p-4 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h4 className="text-lg font-extrabold text-light-text dark:text-dark-text">{connection.selectedBank || 'Bank Connection'}</h4>
                                    {renderStatusBadge(connection.status)}
                                </div>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono mt-1 opacity-70">
                                    Session ID: {connection.sessionId || 'pending'} • Expires {connection.sessionExpiresAt ? new Date(connection.sessionExpiresAt).toLocaleDateString() : 'N/A'}
                                </p>
                                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                    Last synced {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Never'}
                                </p>
                                {connection.lastError && (
                                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block">
                                        Error: {connection.lastError}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {(connection.status === 'requires_update' || !connection.sessionId) && (
                                    <button onClick={() => handleReauthorize(connection)} className={`${BTN_SECONDARY_STYLE} text-amber-600 dark:text-amber-400`}>
                                        <span className="material-symbols-outlined text-lg mr-1">refresh</span> Reauth
                                    </button>
                                )}
                                <button onClick={() => openSyncPrompt(connection)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">sync</span> Trigger sync
                                </button>
                                <button onClick={() => onDeleteConnection(connection.id)} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">delete</span> Remove
                                </button>
                            </div>
                        </div>

                        {/* Accounts List */}
                        <div className="p-4 space-y-4">
                            {providerAccounts.length === 0 ? (
                                <div className="text-center py-6 text-sm text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-black/20 rounded-xl border border-dashed border-black/10 dark:border-white/10">
                                    No accounts found. Try syncing to fetch data.
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

                                    return (
                                        <div key={account.id} className="border border-black/10 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-dark-card shadow-sm hover:border-primary-500/50 transition-colors">
                                            {/* Account Header */}
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex gap-4">
                                                     <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5">
                                                        <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                                                    </div>
                                                    <div>
                                                        <h5 className="font-bold text-light-text dark:text-dark-text text-lg">{account.name}</h5>
                                                        <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                            {accountLastFour && <span className="font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">•••• {accountLastFour}</span>}
                                                            <span className="opacity-60">|</span>
                                                            <span>Last sync: {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Pending'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-0.5">BALANCE</p>
                                                    <p className="text-2xl font-black text-light-text dark:text-dark-text tracking-tight">
                                                        {account.currency} {account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Default sync start: {defaultSyncStart}</p>
                                                </div>
                                            </div>

                                            {/* Configuration Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-black/5 dark:border-white/5">
                                                
                                                {/* Col 1: Link Target */}
                                                <div className="space-y-3">
                                                    <p className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">LINK TARGET</p>
                                                    <div className="flex flex-col gap-2">
                                                         <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/10">
                                                            <input type="radio" name={`${rowKey}-mode`} checked={(rowState.mode || 'existing') === 'existing'} onChange={() => handleLinkChange(rowKey, { mode: 'existing' })} className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300" />
                                                            <span className="text-sm font-semibold text-light-text dark:text-dark-text">Link to existing</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/10">
                                                            <input type="radio" name={`${rowKey}-mode`} checked={rowState.mode === 'create'} onChange={() => handleLinkChange(rowKey, { mode: 'create', newAccountName: rowState.newAccountName || account.name, newAccountType: rowState.newAccountType || 'Checking' })} className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300" />
                                                            <span className="text-sm font-semibold text-light-text dark:text-dark-text">Create new</span>
                                                        </label>
                                                    </div>

                                                    {(rowState.mode || 'existing') === 'existing' ? (
                                                        <select
                                                            className={`${INPUT_BASE_STYLE} !text-sm`}
                                                            value={rowState.accountId || ''}
                                                            onChange={(e) => handleLinkChange(rowKey, { accountId: e.target.value })}
                                                        >
                                                            <option value="">Select account to link...</option>
                                                            {accounts.map(acc => (
                                                                <option key={acc.id} value={acc.id} disabled={linkedAccounts.has(acc.id) && acc.id !== account.linkedAccountId}>
                                                                {acc.name} ({acc.currency})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <div className="space-y-2 animate-fade-in-up">
                                                            <input type="text" className={`${INPUT_BASE_STYLE} !text-sm`} value={rowState.newAccountName || ''} onChange={(e) => handleLinkChange(rowKey, { newAccountName: e.target.value })} placeholder="New account name" />
                                                            <select className={`${INPUT_BASE_STYLE} !text-sm`} value={rowState.newAccountType || 'Checking'} onChange={(e) => handleLinkChange(rowKey, { newAccountType: e.target.value as AccountType})}>
                                                                {accountTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                                    {linkedAccount && (rowState.mode || 'existing') === 'existing' && (
                                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-sm">link</span>
                                                            Linked to {linkedAccount.name}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Col 2: Sync Start */}
                                                <div className="space-y-3">
                                                    <p className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">SYNC START</p>
                                                    <input
                                                        type="date"
                                                        className={`${INPUT_BASE_STYLE} !text-sm`}
                                                        min={ninetyDaysAgoStr}
                                                        max={todayStr}
                                                        value={clampSyncDate(rowState.syncStartDate || defaultSyncStart) || ''}
                                                        onChange={(e) => handleLinkChange(rowKey, { syncStartDate: clampSyncDate(e.target.value) })}
                                                    />
                                                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-snug">
                                                        Choose how far back to import (up to 90 days). Future syncs will continue from where they left off.
                                                    </p>
                                                </div>

                                                {/* Col 3: Actions */}
                                                <div className="space-y-3">
                                                    <p className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">ACTIONS</p>
                                                    <button
                                                        onClick={() => {
                                                            const syncStartDate = clampSyncDate(rowState.syncStartDate || defaultSyncStart);
                                                            if (!syncStartDate) { alert('Select a sync start date before linking.'); return; }

                                                            if ((rowState.mode || 'existing') === 'existing') {
                                                                if (!rowState.accountId) { alert('Select an account before linking.'); return; }
                                                                handleLinkChange(rowKey, { syncStartDate });
                                                                onLinkAccount(connection.id, account.id, { linkedAccountId: rowState.accountId, syncStartDate });
                                                            } else {
                                                                const newAccountName = (rowState.newAccountName || account.name || '').trim();
                                                                if (!newAccountName) { alert('Enter a name for the new account.'); return; }
                                                                handleLinkChange(rowKey, { syncStartDate, newAccountName });
                                                                onLinkAccount(connection.id, account.id, {
                                                                    newAccount: { name: newAccountName, type: rowState.newAccountType || 'Checking', balance: account.balance, currency: account.currency },
                                                                    syncStartDate,
                                                                });
                                                            }
                                                        }}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-md transition-all active:scale-95"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">link</span>
                                                        Save link
                                                    </button>
                                                    
                                                    <div className="space-y-1 pt-1">
                                                        <div className="flex items-center gap-2 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                                            <span className="material-symbols-outlined text-sm opacity-70">event</span>
                                                            <span>Sync start: {defaultSyncStart}</span>
                                                        </div>
                                                         <div className="flex items-center gap-2 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                                            <span className="material-symbols-outlined text-sm opacity-70">history</span>
                                                            <span>Last sync: {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Pending'}</span>
                                                        </div>
                                                    </div>
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
      </div>
    </div>
  );
};

export default EnableBankingIntegrationCard;

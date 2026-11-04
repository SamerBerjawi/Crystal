import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Account,
  EnableBankingAccount,
  EnableBankingConnection,
  EnableBankingLinkPayload,
  EnableBankingSyncOptions,
} from '../types';
import { toLocalISOString } from '../utils';
import { fetchCredentialStatus, loadEnableBankingConfig, persistEnableBankingConfig } from '../utils/enableBankingStorage';
import BankConnectDialog, { BankForm, BankOption } from './BankConnectDialog';
import BankConnectionCard from './BankConnectionCard';
import BankLinkDialog from './BankLinkDialog';
import EnableBankingSyncModal from './EnableBankingSyncModal';
import { ConfirmDialog } from './ui/Overlays';
import { EmptyState } from './ui/States';

interface EnableBankingIntegrationCardProps {
  connections: EnableBankingConnection[];
  accounts: Account[];
  isConnectOpen: boolean;
  onConnectOpenChange: (isOpen: boolean) => void;
  onCreateConnection: (payload: {
    applicationId: string;
    countryCode: string;
    clientCertificate: string;
    selectedBank: string;
    connectionId?: string;
  }) => void;
  onFetchBanks: (payload: { applicationId: string; countryCode: string; clientCertificate: string }) => Promise<
    BankOption[]
  >;
  onDeleteConnection: (connectionId: string) => void;
  onResetDeletedTransactions: (connectionId: string) => void;
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
  isConnectOpen,
  onConnectOpenChange,
  onCreateConnection,
  onFetchBanks,
  onDeleteConnection,
  onResetDeletedTransactions,
  onLinkAccount,
  onTriggerSync,
}) => {
  const [formState, setFormState] = useState<BankForm>({
    applicationId: '',
    countryCode: 'FI',
    clientCertificate: '',
    selectedBank: '',
    psuType: 'personal',
  });

  const updateFormState = (updater: React.SetStateAction<typeof formState>) => {
    setFormState(prev => {
      const nextState = typeof updater === 'function' ? (updater as (prev: typeof formState) => typeof formState)(prev) : updater;
      persistEnableBankingConfig(nextState);
      return nextState;
    });
  };

  // The private key is held by the server; the field below is only for entering or replacing it.
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const hasCredentials = Boolean(formState.applicationId.trim() && (formState.clientCertificate.trim() || hasStoredKey));
  const [linking, setLinking] = useState<{ connectionId: string; account: EnableBankingAccount } | null>(null);
  const [deleting, setDeleting] = useState<EnableBankingConnection | null>(null);
  const [resetting, setResetting] = useState<EnableBankingConnection | null>(null);
  const autoSyncedConnections = React.useRef<Set<string>>(new Set());
  const [bankOptions, setBankOptions] = useState<BankOption[]>([]);
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
  const ninetyDaysAgoStr = useMemo(() => toLocalISOString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)), []);
  const twoYearsAgoStr = useMemo(() => toLocalISOString(new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)), []);

  const linkedAccounts = useMemo(
    () => new Set(connections.flatMap(conn => conn.accounts.map(acc => acc.linkedAccountId).filter(Boolean) as string[])),
    [connections]
  );

  useEffect(() => {
    const savedConfig = loadEnableBankingConfig();
    if (savedConfig) updateFormState(prev => ({ ...prev, ...savedConfig }));
    let cancelled = false;
    fetchCredentialStatus().then(status => {
      if (cancelled) return;
      setHasStoredKey(status.configured);
      if (status.configured && status.applicationId) {
        updateFormState(prev => ({ ...prev, applicationId: prev.applicationId || status.applicationId }));
      }
      });
    return () => { cancelled = true; };
  }, []);

  const clampSyncDate = (value?: string) => {
    if (!value) return value;
    const parsed = new Date(value);
    const min = new Date(twoYearsAgoStr);
    const max = new Date(todayStr);

    if (parsed < min) return twoYearsAgoStr;
    if (parsed > max) return todayStr;
    return value;
  };

  const loadBanks = async () => {
    if (!hasCredentials) {
      toast.error('Enter Application ID and Client Certificate first.');
      onConnectOpenChange(true);
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
      if (formState.clientCertificate.trim()) {
        // The server stored the key once the provider accepted it; drop it from the page.
        setHasStoredKey(true);
        setFormState(prev => ({ ...prev, clientCertificate: '' }));
      }
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
    if (!hasCredentials) {
      toast.error('Application ID and client certificate are required.');
      onConnectOpenChange(true);
      return;
    }

    if (!formState.selectedBank) {
      toast.error('Select a bank first.');
      return;
    }

    const selectedOption = bankOptions.find(option => option.id === formState.selectedBank);
    onCreateConnection({
      applicationId: formState.applicationId,
      countryCode: formState.countryCode,
      clientCertificate: formState.clientCertificate,
      selectedBank: JSON.stringify({
        id: formState.selectedBank,
        name: selectedOption?.name || formState.selectedBank,
        logo: selectedOption?.logo,
        psuType: formState.psuType || 'personal',
        maximumConsentValidity: selectedOption?.maximumConsentValidity,
      }),
    });
  };

  const handleReauthorize = (connection: EnableBankingConnection) => {
    const resolvedApplicationId = (connection.applicationId || formState.applicationId || '').trim();
    const resolvedCertificate = (formState.clientCertificate || '').trim();
    const resolvedCountry = (connection.countryCode || formState.countryCode || '').trim().toUpperCase();
    const resolvedBankId = (connection.selectedBankId || formState.selectedBank || '').trim();
    const matchedBank = bankOptions.find(option => option.id === resolvedBankId);
    const resolvedBankName = connection.selectedBank || matchedBank?.name || '';

    if (!resolvedApplicationId || !(resolvedCertificate || hasStoredKey)) {
      toast.error('Application ID and certificate are required to reauthorize.');
      onConnectOpenChange(true);
      return;
    }

    onCreateConnection({
      applicationId: resolvedApplicationId,
      countryCode: resolvedCountry,
      clientCertificate: resolvedCertificate,
      selectedBank: JSON.stringify({
        id: resolvedBankId,
        name: resolvedBankName || connection.selectedBank || 'Enable Banking',
        logo: connection.bankLogoUrl || matchedBank?.logo,
        psuType: connection.psuType || formState.psuType || 'personal',
        maximumConsentValidity: connection.maximumConsentValidity || matchedBank?.maximumConsentValidity,
      }),
      connectionId: connection.id,
    });
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

  return (
    <div className="min-w-0 space-y-4">
      {syncPrompt && (
        <EnableBankingSyncModal
          isOpen={!!syncPrompt}
          title="Sync bank"
          description="Choose what to bring in."
          minDate={twoYearsAgoStr}
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
      <BankConnectDialog
        isOpen={isConnectOpen}
        onClose={() => onConnectOpenChange(false)}
        form={formState}
        onChange={updates => updateFormState(prev => ({ ...prev, ...updates }))}
        hasStoredKey={hasStoredKey}
        banks={bankOptions}
        isLoadingBanks={banksLoading}
        banksError={banksError}
        onFindBanks={loadBanks}
        onConnect={handleCreate}
      />
      <BankLinkDialog
        account={linking?.account ?? null}
        accounts={accounts}
        takenAccountIds={linkedAccounts}
        minDate={twoYearsAgoStr}
        maxDate={todayStr}
        onClose={() => setLinking(null)}
        onSave={payload => {
          if (linking) onLinkAccount(linking.connectionId, linking.account.id, payload);
          setLinking(null);
        }}
      />
      <ConfirmDialog
        isOpen={!!resetting}
        onClose={() => setResetting(null)}
        onConfirm={() => { if (resetting) onResetDeletedTransactions(resetting.id); setResetting(null); }}
        title={`Reset deleted transactions for ${resetting?.selectedBank || 'this bank'}?`}
        message="Transactions you deleted are no longer held back. The next sync brings back any the bank still lists."
        confirmLabel="Reset"
      />
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) onDeleteConnection(deleting.id); setDeleting(null); }}
        title={`Delete ${deleting?.selectedBank || 'this connection'}?`}
        message="Crystal stops syncing this bank. Your accounts and transactions stay."
        confirmLabel="Delete connection"
        isDestructive
      />

      {connections.length === 0 ? (
        <EmptyState
          icon="account_balance"
          title="No banks connected"
          description="Connect a bank to bring in balances and transactions."
          actionLabel="Connect a bank"
          onAction={() => onConnectOpenChange(true)}
        />
      ) : connections.map(connection => (
        <BankConnectionCard
          key={connection.id}
          connection={connection}
          accounts={accounts}
          onSync={account => openSyncPrompt(connection, account)}
          onReconnect={() => handleReauthorize(connection)}
          onDelete={() => setDeleting(connection)}
          onResetDeleted={() => setResetting(connection)}
          onLink={account => setLinking({ connectionId: connection.id, account })}
        />
      ))}
    </div>
  );
};

export default EnableBankingIntegrationCard;

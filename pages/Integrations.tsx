import React, { useEffect, useMemo, useState } from 'react';
import { Account, AppPreferences, EnableBankingConnection, EnableBankingLinkPayload, EnableBankingSyncOptions, Page } from '../types';
import EnableBankingIntegrationCard from '../components/EnableBankingIntegrationCard';
import SettingsGroup from '../components/SettingsGroup';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import { Button, IconButton, TextLink } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { TextInput } from '../components/ui/Fields';

interface IntegrationsProps {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
  setCurrentPage: (page: Page) => void;
  enableBankingConnections: EnableBankingConnection[];
  accounts: Account[];
  onCreateConnection: (payload: { applicationId: string; countryCode: string; clientCertificate: string; selectedBank: string; connectionId?: string }) => void;
  onFetchBanks: (payload: { applicationId: string; countryCode: string; clientCertificate: string }) => Promise<
    { id: string; name: string; country?: string }[]
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

/** A key saves when the field loses focus. */
const ApiKeyField: React.FC<{
  title: string;
  description: string;
  label: string;
  value: string;
  docsUrl: string;
  onCommit: (value: string) => void;
}> = ({ title, description, label, value, docsUrl, onCommit }) => {
  const [draft, setDraft] = useState(value);
  const [isVisible, setVisible] = useState(false);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="type-body-strong text-ink">{title}</h3>
        <Badge tone={value.trim() ? 'positive' : 'neutral'}>{value.trim() ? 'Set' : 'Not set'}</Badge>
        <TextLink href={docsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">Get a key</TextLink>
      </div>
      <p className="type-caption mb-2 text-muted">{description}</p>
      <div className="flex items-end gap-1">
        <TextInput
          label={label}
          type={isVisible ? 'text' : 'password'}
          autoComplete="off"
          className="min-w-0 flex-1"
          value={draft}
          onChange={setDraft}
          onBlur={() => { if (draft !== value) onCommit(draft); }}
        />
        <IconButton icon={isVisible ? 'view-off' : 'view'} label={isVisible ? `Hide ${label}` : `Show ${label}`} onPress={() => setVisible(shown => !shown)} />
      </div>
    </div>
  );
};

const Integrations: React.FC<IntegrationsProps> = ({
  preferences,
  setPreferences,
  setCurrentPage,
  enableBankingConnections,
  accounts,
  onCreateConnection,
  onFetchBanks,
  onDeleteConnection,
  onResetDeletedTransactions,
  onLinkAccount,
  onTriggerSync,
}) => {
  const [isConnectOpen, setConnectOpen] = useState(false);
  const connected = useMemo(() => enableBankingConnections.filter(connection => connection.status === 'ready').length, [enableBankingConnections]);
  const linked = useMemo(
    () => enableBankingConnections.reduce((sum, connection) => sum + connection.accounts.filter(account => account.linkedAccountId).length, 0),
    [enableBankingConnections],
  );

  return (
    <div className="space-y-8">
      <SettingsSubpageHeader
        title="Connections"
        setCurrentPage={setCurrentPage}
        stats={enableBankingConnections.length > 0 ? [
          { label: 'Banks connected', icon: 'bank', value: connected, badge: `of ${enableBankingConnections.length}`, badgeTone: 'pine' },
          { label: 'Accounts linked', icon: 'link-01', value: linked },
        ] : undefined}
        actions={<Button icon="add-01" onPress={() => setConnectOpen(true)}>Connect a bank</Button>}
      />

      <SettingsGroup isPlain title="Banks" description="Live balances and transactions through Enable Banking.">
        <EnableBankingIntegrationCard
          connections={enableBankingConnections}
          accounts={accounts}
          isConnectOpen={isConnectOpen}
          onConnectOpenChange={setConnectOpen}
          onCreateConnection={onCreateConnection}
          onFetchBanks={onFetchBanks}
          onDeleteConnection={onDeleteConnection}
          onResetDeletedTransactions={onResetDeletedTransactions}
          onLinkAccount={onLinkAccount}
          onTriggerSync={onTriggerSync}
        />
      </SettingsGroup>

      <SettingsGroup title="Prices and logos">
        <div className="divide-y divide-line">
          <ApiKeyField
            title="Twelve Data"
            description="Live prices and exchange rates."
            label="API key"
            value={preferences.twelveDataApiKey || ''}
            docsUrl="https://twelvedata.com"
            onCommit={value => setPreferences({ ...preferences, twelveDataApiKey: value })}
          />
          <ApiKeyField
            title="Brandfetch"
            description="Merchant and bank logos."
            label="Client ID"
            value={preferences.brandfetchClientId || ''}
            docsUrl="https://brandfetch.com/developers"
            onCommit={value => setPreferences({ ...preferences, brandfetchClientId: value })}
          />
        </div>
      </SettingsGroup>
    </div>
  );
};

export default Integrations;

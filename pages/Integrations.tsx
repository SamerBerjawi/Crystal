import React from 'react';
import { Account, AppPreferences, EnableBankingConnection, EnableBankingLinkPayload, EnableBankingSyncOptions, Page } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { INPUT_BASE_STYLE } from '../constants';
import EnableBankingIntegrationCard from '../components/EnableBankingIntegrationCard';

interface IntegrationsProps {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
  setCurrentPage: (page: Page) => void;
  enableBankingConnections: EnableBankingConnection[];
  accounts: Account[];
  onCreateConnection: (payload: { applicationId: string; countryCode: string; clientCertificate: string; selectedBank: string; connectionId?: string }) => void;
  onFetchBanks: (payload: { applicationId: string; countryCode: string; clientCertificate: string }) => Promise<{ id: string; name: string; country?: string }[]>;
  onDeleteConnection: (connectionId: string) => void;
  onLinkAccount: (
    connectionId: string,
    providerAccountId: string,
    payload: EnableBankingLinkPayload
  ) => void;
  onTriggerSync: (connectionId: string, connectionOverride?: EnableBankingConnection, options?: EnableBankingSyncOptions) => void | Promise<void>;
}

interface SectionHeaderProps { title: string; icon: string; description: string }
const SectionHeader = React.memo(function SectionHeader({ title, icon, description }: SectionHeaderProps) {
  return (
    <div className="mb-6 pb-4 border-b border-black/5 dark:border-white/5">
      <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-lg">{icon}</span>
          </div>
          <h3 className="text-lg font-bold text-light-text dark:text-dark-text">{title}</h3>
      </div>
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary ml-11">{description}</p>
    </div>
  );
});

interface SettingRowProps { label: string; description?: string; children: React.ReactNode }
const SettingRow = React.memo(function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 py-4 border-b border-black/5 dark:border-white/5 last:border-0">
      <div className="flex-1 max-w-md">
        <label className="font-semibold text-sm text-light-text dark:text-dark-text block mb-1">{label}</label>
        {description && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{description}</p>}
      </div>
      <div className="w-full sm:w-64 shrink-0">
        {children}
      </div>
    </div>
  );
});

const Integrations: React.FC<IntegrationsProps> = ({
  preferences,
  setPreferences,
  setCurrentPage,
  enableBankingConnections,
  accounts,
  onCreateConnection,
  onFetchBanks,
  onDeleteConnection,
  onLinkAccount,
  onTriggerSync,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPreferences({ ...preferences, [name]: value });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in-up px-4 sm:px-6 lg:px-10">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span className="mx-2">/</span>
                <span className="text-light-text dark:text-dark-text font-medium">Integrations</span>
            </div>
        </div>
        <PageHeader
          markerIcon="image"
          markerLabel="Connect"
          title="Integrations"
          subtitle="Manage external services that enrich your Crystal workspace."
        />
      </header>

      <EnableBankingIntegrationCard
        connections={enableBankingConnections}
        accounts={accounts}
        onCreateConnection={onCreateConnection}
        onFetchBanks={onFetchBanks}
        onDeleteConnection={onDeleteConnection}
        onLinkAccount={onLinkAccount}
        onTriggerSync={onTriggerSync}
      />

      <Card>
        <SectionHeader
          title="API Keys"
          icon="key"
          description="Securely store keys locally to unlock additional data sources."
        />
        <div className="space-y-2">
          <SettingRow
            label="Twelve Data API Key"
            description="Used to fetch live investment prices from Twelve Data. Your key is stored locally."
          >
            <input
              type="text"
              name="twelveDataApiKey"
              value={preferences.twelveDataApiKey || ''}
              onChange={handleInputChange}
              placeholder="Enter your Twelve Data API key"
              className={INPUT_BASE_STYLE}
            />
          </SettingRow>
          <SettingRow
            label="Brandfetch Client ID"
            description="Used to fetch merchant logos for your transactions. Leave blank to use category icons instead."
          >
            <input
              type="text"
              name="brandfetchClientId"
              value={preferences.brandfetchClientId || ''}
              onChange={handleInputChange}
              placeholder="Enter your Brandfetch client ID"
              className={INPUT_BASE_STYLE}
            />
          </SettingRow>
        </div>
      </Card>
    </div>
  );
};

export default Integrations;

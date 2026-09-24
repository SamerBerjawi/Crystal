import React, { useMemo } from 'react';
import { Account, AppPreferences, EnableBankingConnection, EnableBankingLinkPayload, EnableBankingSyncOptions, Page } from '../types';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import EnableBankingIntegrationCard from '../components/EnableBankingIntegrationCard';
import Icon from '../components/ui/Icon';
import { useLocalStorage } from '../hooks/useLocalStorage';

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
  onLinkAccount: (
    connectionId: string,
    providerAccountId: string,
    payload: EnableBankingLinkPayload
  ) => void;
  onTriggerSync: (connectionId: string, connectionOverride?: EnableBankingConnection, options?: EnableBankingSyncOptions) => void | Promise<void>;
}

const ApiKeyCard: React.FC<{
  title: string;
  tag: string;
  icon: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  colorClass: string;
  docsUrl?: string;
}> = ({
  title,
  tag,
  icon,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  colorClass,
  docsUrl,
}) => {
  const isConfigured = Boolean(value && value.trim().length > 0);
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="flex flex-col justify-between rounded-xl p-3 sm:p-3.5 bg-white/70 dark:bg-white/[0.025] backdrop-blur-md border border-black/8 dark:border-white/10 hover:border-primary-500/30 shadow-xs transition-all duration-150">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
            <Icon name={icon} className="text-sm" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-light-text dark:text-dark-text tracking-tight truncate">
                {title}
              </span>
              <span className="text-3xs px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary font-medium truncate">
                {tag}
              </span>
            </div>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-3xs font-semibold shrink-0 border ${
            isConfigured
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-black/5 text-neutral-500 dark:bg-white/5 dark:text-neutral-400 border-black/5 dark:border-white/10'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
          {isConfigured ? 'Active' : 'Unset'}
        </span>
      </div>

      {/* Secret Input with Link */}
      <div className="space-y-1">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-light-text-secondary opacity-40">
            <Icon name="key" className="text-xs" />
          </div>
          <input
            type={isVisible ? 'text' : 'password'}
            name={name}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className="w-full h-8 pl-7 pr-7 rounded-lg bg-black/[0.03] dark:bg-black/30 border border-black/10 dark:border-white/10 text-xs font-mono text-light-text dark:text-dark-text focus:outline-none focus:ring-1.5 focus:ring-primary-500/50"
          />
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-light-text-secondary hover:text-primary-500 transition-colors cursor-pointer"
            title={isVisible ? 'Hide' : 'Reveal'}
          >
            <Icon name={isVisible ? 'visibility_off' : 'visibility'} className="text-xs" />
          </button>
        </div>

        {docsUrl && (
          <div className="flex justify-end">
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-3xs text-primary-500 hover:underline inline-flex items-center gap-0.5 opacity-75 hover:opacity-100"
            >
              <span>Get API key</span>
              <Icon name="open_in_new" className="text-3xs" />
            </a>
          </div>
        )}
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
  onLinkAccount,
  onTriggerSync,
}) => {
  const [localApiKeys, setLocalApiKeys] = React.useState({
    twelveDataApiKey: preferences.twelveDataApiKey || '',
    brandfetchClientId: preferences.brandfetchClientId || '',
  });

  const [cartoApiKey, setCartoApiKey] = useLocalStorage<string>('crystal_carto_api_key', '');
  const [localCartoKey, setLocalCartoKey] = React.useState(cartoApiKey);
  React.useEffect(() => {
    setLocalCartoKey(cartoApiKey);
  }, [cartoApiKey]);

  React.useEffect(() => {
    setLocalApiKeys({
      twelveDataApiKey: preferences.twelveDataApiKey || '',
      brandfetchClientId: preferences.brandfetchClientId || '',
    });
  }, [preferences.brandfetchClientId, preferences.twelveDataApiKey]);

  const handleLocalChange = (name: keyof typeof localApiKeys, value: string) => {
    setLocalApiKeys(prev => ({ ...prev, [name]: value }));
  };

  const handleCommit = (name: keyof typeof localApiKeys) => {
    const nextValue = localApiKeys[name];
    if (preferences[name] !== nextValue) {
      setPreferences({ ...preferences, [name]: nextValue });
    }
  };

  const readyBankCount = useMemo(
    () => enableBankingConnections.filter(c => c.status === 'ready').length,
    [enableBankingConnections]
  );
  const activeApiCount = useMemo(() => {
    let count = 0;
    if (localApiKeys.twelveDataApiKey?.trim()) count++;
    if (localApiKeys.brandfetchClientId?.trim()) count++;
    if (cartoApiKey?.trim()) count++;
    return count;
  }, [localApiKeys, cartoApiKey]);

  return (
    <div className="w-full pb-10 space-y-5 animate-fade-in-up px-3 sm:px-6 max-w-7xl mx-auto">
      {/* Header */}
      <SettingsSubpageHeader
        markerIcon="hub"
        markerLabel="External Services"
        title="Integrations"
        setCurrentPage={setCurrentPage}
        className="!mb-2"
      />

      {/* QUICK STATUS PILLS BAR */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-2xs">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white dark:bg-white/[0.06] border border-black/5 dark:border-white/10 font-medium">
          <span className={`w-1.5 h-1.5 rounded-full ${readyBankCount > 0 ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
          <span className="text-light-text dark:text-dark-text font-bold">Open Banking:</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">
            {enableBankingConnections.length === 0
              ? 'None'
              : `${readyBankCount} active (${enableBankingConnections.length} total)`}
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white dark:bg-white/[0.06] border border-black/5 dark:border-white/10 font-medium">
          <span className={`w-1.5 h-1.5 rounded-full ${activeApiCount > 0 ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
          <span className="text-light-text dark:text-dark-text font-bold">Data APIs:</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">{activeApiCount} / 3 configured</span>
        </div>
      </div>

      {/* SECTION 1: BANK SYNCHRONIZATION (ENABLE BANKING) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3.5 bg-emerald-500 rounded-full" />
            <h3 className="text-xs font-bold text-light-text dark:text-dark-text uppercase tracking-wider">
              Bank Synchronization
            </h3>
          </div>
          <span className="text-3xs text-light-text-secondary dark:text-dark-text-secondary opacity-75">
            Enable Banking (PSD2)
          </span>
        </div>

        <EnableBankingIntegrationCard
          connections={enableBankingConnections}
          accounts={accounts}
          onCreateConnection={onCreateConnection}
          onFetchBanks={onFetchBanks}
          onDeleteConnection={onDeleteConnection}
          onLinkAccount={onLinkAccount}
          onTriggerSync={onTriggerSync}
        />
      </section>

      {/* SECTION 2: THIRD-PARTY DATA APIS (COMPACT 3-COLUMN GRID) */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3.5 bg-primary-500 rounded-full" />
            <h3 className="text-xs font-bold text-light-text dark:text-dark-text uppercase tracking-wider">
              Data & Asset APIs
            </h3>
          </div>
          <span className="text-3xs text-light-text-secondary dark:text-dark-text-secondary opacity-75">
            Stored locally
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ApiKeyCard
            title="Twelve Data"
            tag="Rates & FX"
            icon="trending_up"
            name="twelveDataApiKey"
            value={localApiKeys.twelveDataApiKey}
            onChange={value => handleLocalChange('twelveDataApiKey', value)}
            onBlur={() => handleCommit('twelveDataApiKey')}
            placeholder="API Key"
            colorClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
            docsUrl="https://twelvedata.com"
          />

          <ApiKeyCard
            title="Brandfetch"
            tag="Logos"
            icon="verified"
            name="brandfetchClientId"
            value={localApiKeys.brandfetchClientId}
            onChange={value => handleLocalChange('brandfetchClientId', value)}
            onBlur={() => handleCommit('brandfetchClientId')}
            placeholder="Client ID"
            colorClass="bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20"
            docsUrl="https://brandfetch.com/developers"
          />

          <ApiKeyCard
            title="CARTO Basemaps"
            tag="Map Tiles"
            icon="map"
            name="cartoApiKey"
            value={localCartoKey}
            onChange={value => setLocalCartoKey(value)}
            onBlur={() => setCartoApiKey(localCartoKey)}
            placeholder="API Key"
            colorClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
            docsUrl="https://carto.com/basemaps"
          />
        </div>
      </section>
    </div>
  );
};

export default Integrations;
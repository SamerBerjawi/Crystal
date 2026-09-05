import React from 'react';
import { Account, AppPreferences, EnableBankingConnection, EnableBankingLinkPayload, EnableBankingSyncOptions, Page } from '../types';
import Card from '../components/Card';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import { INPUT_BASE_STYLE } from '../constants';
import EnableBankingIntegrationCard from '../components/EnableBankingIntegrationCard';
import Icon from '../components/ui/Icon';

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

const ApiKeyCard = ({ 
    title, 
    description, 
    icon, 
    name, 
    value, 
    onChange, 
    onBlur,
    placeholder,
    colorClass
}: { 
    title: string; 
    description: string; 
    icon: string; 
    name: string; 
    value: string; 
    onChange: (value: string) => void; 
    onBlur: () => void;
    placeholder: string;
    colorClass: string;
}) => {
    const isConfigured = Boolean(value && value.trim().length > 0);
    const [isVisible, setIsVisible] = React.useState(false);

    return (
        <Card className="flex flex-col h-full glass-tile border border-slate-200/80 dark:border-white/10 hover:border-primary-500/30 shadow-card hover:shadow-xl transition-all duration-300 rounded-3xl p-6 relative overflow-hidden group">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass} shadow-md group-hover:scale-105 transition-transform duration-300`}>
                    <Icon name={icon} className="text-2xl" />
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                  isConfigured 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                    : 'bg-black/5 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-black/5 dark:border-white/10'
                }`}>
                    <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    {isConfigured ? 'Operational' : 'Config Required'}
                </div>
            </div>
            
            <div className="mb-6 flex-grow">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1 tracking-tight">{title}</h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-70">{description}</p>
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-light-text-secondary opacity-50">
                    <Icon name="key" className="text-lg" />
                </div>
                <input
                    type={isVisible ? 'text' : 'password'}
                    name={name}
                    value={value || ''}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-10 py-3 glass-subwell border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-mono text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <button
                    type="button"
                    onClick={() => setIsVisible(!isVisible)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-light-text-secondary hover:text-primary-500 transition-colors cursor-pointer"
                >
                    <Icon name={isVisible ? 'eye_off' : 'eye'} className="text-lg" />
                </button>
            </div>
        </Card>
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

  return (
    <div className="w-full pb-12 space-y-12 animate-fade-in-up px-4">
       {/* Navigation & Header */}
       <SettingsSubpageHeader
         markerIcon="zap"
         markerLabel="External Protocols"
         title="Integrations & APIs"
         subtitle="Augment your financial stack with real-time market data, telemetry, and secure vault synchronization."
         setCurrentPage={setCurrentPage}
       />

      {/* API Keys Grid */}
      <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-6 bg-primary-500 rounded-full"></div>
              <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">Intelligence & Enrichment</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ApiKeyCard
                  title="Twelve Data"
                  description="High-frequency engine for market rates, ETF valuations, and global currency arbitrage calculations."
                  icon="line_chart_up"
                  name="twelveDataApiKey"
                  value={localApiKeys.twelveDataApiKey}
                  onChange={(value) => handleLocalChange('twelveDataApiKey', value)}
                  onBlur={() => handleCommit('twelveDataApiKey')}
                  placeholder="Enter 12Data API Key"
                  colorClass="bg-indigo-500 text-white shadow-indigo-500/20"
              />
              <ApiKeyCard
                  title="Brandfetch"
                  description="Metadata enrichment service for merchant identification and high-fidelity branding assets."
                  icon="zap"
                  name="brandfetchClientId"
                  value={localApiKeys.brandfetchClientId}
                  onChange={(value) => handleLocalChange('brandfetchClientId', value)}
                  onBlur={() => handleCommit('brandfetchClientId')}
                  placeholder="Enter Client Access ID"
                  colorClass="bg-pink-500 text-white shadow-pink-500/20"
              />
          </div>
      </section>

      {/* Enable Banking Section */}
      <section className="space-y-6">
           <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
              <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">Synchronization Vault</h3>
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
    </div>
  );
};

export default Integrations;
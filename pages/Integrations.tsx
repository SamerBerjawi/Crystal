import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Account, AppPreferences, EnableBankingConnection, EnableBankingLinkPayload, EnableBankingSyncOptions } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { INPUT_BASE_STYLE, PAGE_PATHS } from '../constants';
import EnableBankingIntegrationCard from '../components/EnableBankingIntegrationCard';

interface IntegrationsProps {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
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
    const isConfigured = value && value.length > 0;
    const [isVisible, setIsVisible] = React.useState(false);

    return (
        <Card className="flex flex-col h-full border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${isConfigured ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'}`}>
                    {isConfigured ? 'Active' : 'Setup Required'}
                </div>
            </div>
            
            <div className="mb-6 flex-grow">
                <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-1">{title}</h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">{description}</p>
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-gray-400 text-lg">key</span>
                </div>
                <input
                    type={isVisible ? 'text' : 'password'}
                    name={name}
                    value={value || ''}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    className={`${INPUT_BASE_STYLE} pl-10 pr-16 text-sm font-mono`}
                    autoComplete="new-password"
                />
                <button
                    type="button"
                    onClick={() => setIsVisible((prev) => !prev)}
                    className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500"
                    aria-label={isVisible ? 'Hide API key' : 'Show API key'}
                >
                    {isVisible ? 'Hide' : 'Show'}
                </button>
            </div>
        </Card>
    );
};

const Integrations: React.FC<IntegrationsProps> = ({
  preferences,
  setPreferences,
  enableBankingConnections,
  accounts,
  onCreateConnection,
  onFetchBanks,
  onDeleteConnection,
  onLinkAccount,
  onTriggerSync,
}) => {
  const navigate = useNavigate();
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
    <div className="max-w-6xl mx-auto pb-12 space-y-12 animate-fade-in-up px-4">
       {/* Navigation & Header */}
       <div className="space-y-6">
        <nav className="flex items-center gap-3">
            <button 
              onClick={() => navigate(PAGE_PATHS['Settings'])} 
              className="group flex items-center gap-2 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest hover:text-primary-500 transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                </div>
                <span>Back to Control Center</span>
            </button>
        </nav>
        
        <PageHeader
          markerIcon="extension"
          markerLabel="External Protocols"
          title="Integrations"
          subtitle="Augment your financial stack with real-time market data, telemetry, and secure vault synchronization."
        />
      </div>

      {/* API Keys Grid */}
      <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-6 bg-primary-500 rounded-full"></div>
              <h3 className="text-sm font-black text-light-text dark:text-dark-text uppercase tracking-widest opacity-60">Intelligence & Enrichment</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ApiKeyCard
                  title="Twelve Data"
                  description="High-frequency engine for market rates, ETF valuations, and global currency arbitrage calculations."
                  icon="monitoring"
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
                  icon="auto_awesome"
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
              <h3 className="text-sm font-black text-light-text dark:text-dark-text uppercase tracking-widest opacity-60">Synchronization Vault</h3>
          </div>
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
               <EnableBankingIntegrationCard
                    connections={enableBankingConnections}
                    accounts={accounts}
                    onCreateConnection={onCreateConnection}
                    onFetchBanks={onFetchBanks}
                    onDeleteConnection={onDeleteConnection}
                    onLinkAccount={onLinkAccount}
                    onTriggerSync={onTriggerSync}
                />
          </div>
      </section>
    </div>
  );
};

export default Integrations;
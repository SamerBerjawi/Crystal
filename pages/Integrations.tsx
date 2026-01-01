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
    <div className="max-w-7xl mx-auto pb-12 space-y-8 animate-fade-in-up">
      {/* Header */}
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
          markerIcon="extension"
          markerLabel="Connected Services"
          title="Integrations"
          subtitle="Supercharge Crystal with live market data, merchant enrichment, and real bank synchronization."
        />
      </header>

      {/* API Keys Grid */}
      <section>
          <div className="flex items-center gap-2 mb-4 px-1">
              <span className="material-symbols-outlined text-primary-500">api</span>
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Data Services</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ApiKeyCard
                  title="Twelve Data"
                  description="Enables real-time stock, ETF, and crypto pricing updates for your investment portfolio."
                  icon="candlestick_chart"
                  name="twelveDataApiKey"
                  value={localApiKeys.twelveDataApiKey}
                  onChange={(value) => handleLocalChange('twelveDataApiKey', value)}
                  onBlur={() => handleCommit('twelveDataApiKey')}
                  placeholder="Enter API Key"
                  colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
              />
              <ApiKeyCard
                  title="Brandfetch"
                  description="Automatically fetches high-quality logos for merchants and institutions based on transaction names."
                  icon="collections" // 'image' or 'branding_watermark'
                  name="brandfetchClientId"
                  value={localApiKeys.brandfetchClientId}
                  onChange={(value) => handleLocalChange('brandfetchClientId', value)}
                  onBlur={() => handleCommit('brandfetchClientId')}
                  placeholder="Enter Client ID"
                  colorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
              />
          </div>
      </section>

      {/* Enable Banking Section */}
      <section>
           <div className="flex items-center gap-2 mb-4 px-1 mt-8">
              <span className="material-symbols-outlined text-emerald-500">account_balance</span>
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Open Banking</h3>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-dark-card dark:to-black/20 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-1">
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

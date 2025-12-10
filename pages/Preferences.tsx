
import React from 'react';
import { AppPreferences, Theme, Page } from '../types';
import Card from '../components/Card';
import { SELECT_WRAPPER_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, CURRENCY_OPTIONS, TIMEZONE_OPTIONS, COUNTRY_OPTIONS, DURATION_OPTIONS, DEFAULT_ACCOUNT_ORDER_OPTIONS, QUICK_CREATE_BUDGET_OPTIONS, FORECAST_DURATION_OPTIONS } from '../constants';
import PageHeader from '../components/PageHeader';

interface PreferencesProps {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setCurrentPage: (page: Page) => void;
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

interface ThemeCardProps {
  label: string;
  theme: Theme;
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  icon: string;
}
const ThemeCard = React.memo(function ThemeCard({ label, theme, currentTheme, setTheme, icon }: ThemeCardProps) {
  const isSelected = currentTheme === theme;

  return (
    <button
      onClick={() => setTheme(theme)}
      className={`flex-1 flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-dark-card ${
        isSelected 
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
          : 'border-transparent bg-light-bg dark:bg-dark-bg hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${isSelected ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400' : 'bg-white dark:bg-white/10 text-gray-500'}`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <span className={`text-sm font-semibold ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-light-text dark:text-dark-text'}`}>{label}</span>
    </button>
  );
});


const Preferences: React.FC<PreferencesProps> = ({ preferences, setPreferences, theme, setTheme, setCurrentPage }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'defaultQuickCreatePeriod') {
        setPreferences({ ...preferences, [name]: Number(value) });
    } else {
        setPreferences({ ...preferences, [name]: value as any });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 animate-fade-in-up">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span className="mx-2">/</span>
                <span className="text-light-text dark:text-dark-text font-medium">Preferences</span>
            </div>
        </div>
        <PageHeader
          markerIcon="tune"
          markerLabel="Personalization"
          title="Preferences"
          subtitle="Control defaults, chart density, notifications, and experiment toggles."
        />
      </header>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          <Card>
            <SectionHeader title="Regional Settings" icon="public" description="Set your region, currency, and formatting preferences." />
            <div className="space-y-2">
              <SettingRow label="Primary Currency" description="The default currency used for dashboard summaries and reports.">
                <div className={SELECT_WRAPPER_STYLE}>
                  <select name="currency" value={preferences.currency} onChange={handleChange} className={INPUT_BASE_STYLE}>
                    {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
              </SettingRow>

              <SettingRow label="Language" description="Select your preferred display language.">
                <div className={SELECT_WRAPPER_STYLE}>
                  <select name="language" value={preferences.language} onChange={handleChange} className={INPUT_BASE_STYLE}>
                    <option>English (en)</option>
                    <option>Français (fr)</option>
                    <option>Español (es)</option>
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
              </SettingRow>

              <SettingRow label="Country" description="Used for regional defaults like date formats.">
                <div className={SELECT_WRAPPER_STYLE}>
                  <select name="country" value={preferences.country} onChange={handleChange} className={INPUT_BASE_STYLE}>
                    {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
              </SettingRow>

              <SettingRow label="Timezone" description="Ensure transaction times are recorded accurately.">
                 <div className={SELECT_WRAPPER_STYLE}>
                  <select name="timezone" value={preferences.timezone} onChange={handleChange} className={INPUT_BASE_STYLE}>
                    {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
              </SettingRow>

              <SettingRow label="Date Format" description="Choose how dates are displayed throughout the app.">
                 <div className={SELECT_WRAPPER_STYLE}>
                  <select name="dateFormat" value={preferences.dateFormat} onChange={handleChange} className={INPUT_BASE_STYLE}>
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
              </SettingRow>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <Card>
            <SectionHeader title="Appearance" icon="palette" description="Choose a theme that suits your environment." />
            <div className="flex gap-4">
              <ThemeCard label="Light" theme="light" currentTheme={theme} setTheme={setTheme} icon="light_mode" />
              <ThemeCard label="Dark" theme="dark" currentTheme={theme} setTheme={setTheme} icon="dark_mode" />
              <ThemeCard label="System" theme="system" currentTheme={theme} setTheme={setTheme} icon="settings_brightness" />
            </div>
          </Card>

           <Card>
             <SectionHeader title="App Behavior" icon="tune" description="Configure default settings for efficiency." />
             <div className="space-y-2">
                <SettingRow label="Default Dashboard Period" description="The time range initially selected on the dashboard.">
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select name="defaultPeriod" value={preferences.defaultPeriod} onChange={handleChange} className={INPUT_BASE_STYLE}>
                      {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
                </SettingRow>

                <SettingRow label="Default Forecast Horizon" description="The default projection length for forecasting charts.">
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select
                      name="defaultForecastPeriod"
                      value={preferences.defaultForecastPeriod || '1Y'}
                      onChange={handleChange}
                      className={INPUT_BASE_STYLE}
                    >
                      {FORECAST_DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
                </SettingRow>

                <SettingRow label="Default Account Sorting" description="How accounts are ordered on the Accounts page.">
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select name="defaultAccountOrder" value={preferences.defaultAccountOrder} onChange={handleChange} className={INPUT_BASE_STYLE}>
                      {DEFAULT_ACCOUNT_ORDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
                </SettingRow>

                <SettingRow label="Budget Quick Create Basis" description="Months of history used when auto-generating budgets.">
                  <div className={SELECT_WRAPPER_STYLE}>
                      <select name="defaultQuickCreatePeriod" value={preferences.defaultQuickCreatePeriod || 3} onChange={handleChange} className={INPUT_BASE_STYLE}>
                          {QUICK_CREATE_BUDGET_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
                </SettingRow>
             </div>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default Preferences;

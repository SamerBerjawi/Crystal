
import React from 'react';
import { AppPreferences, Theme, Page } from '../types';
import Card from '../components/Card';
import { SELECT_WRAPPER_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, CURRENCY_OPTIONS, TIMEZONE_OPTIONS, COUNTRY_OPTIONS, DURATION_OPTIONS, DEFAULT_ACCOUNT_ORDER_OPTIONS, QUICK_CREATE_BUDGET_OPTIONS, FORECAST_DURATION_OPTIONS, CHECKBOX_STYLE } from '../constants';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import Icon from '../components/ui/Icon';

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
          <Icon name={icon} className="text-lg" />
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
      type="button"
      onClick={() => setTheme(theme)}
      className={`flex-1 flex flex-col items-center p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer group ${
        isSelected 
          ? 'border-primary-500 bg-primary-500/[0.06] dark:bg-primary-500/[0.12] shadow-md' 
          : 'border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:border-black/20 dark:hover:border-white/20'
      }`}
    >
      {/* Visual Preview Box */}
      <div className={`w-full h-16 rounded-xl border mb-3 flex flex-col justify-between p-2.5 overflow-hidden transition-transform group-hover:scale-[1.02] ${
        theme === 'light' 
          ? 'bg-gray-100 border-gray-300 text-gray-800' 
          : theme === 'dark' 
          ? 'bg-zinc-900 border-zinc-700 text-zinc-100' 
          : 'bg-gradient-to-r from-gray-100 to-zinc-900 border-gray-400 text-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="w-8 h-2 rounded bg-primary-500/40"></div>
          <div className="w-2 h-2 rounded-full bg-primary-500"></div>
        </div>
        <div className="space-y-1">
          <div className="w-full h-1.5 rounded bg-black/10 dark:bg-white/20"></div>
          <div className="w-2/3 h-1.5 rounded bg-black/10 dark:bg-white/20"></div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Icon name={icon} className={`text-base ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
        <span className={`text-xs font-bold ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-light-text dark:text-dark-text'}`}>
          {label}
        </span>
      </div>
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
    <div className="w-full pb-12 animate-fade-in-up px-4">
      {/* Navigation & Header */}
      <SettingsSubpageHeader
        markerIcon="sliders"
        markerLabel="Personalization"
        title="Preferences"
        subtitle="Configure your workspace environment, regional standards, and algorithmic behaviors."
        setCurrentPage={setCurrentPage}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Left Column: Visuals & Experience */}
        <div className="space-y-10">
          <section className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
            <div className="p-8 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Icon name="sliders" className="text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text tracking-tight">Interface Theme</h3>
              </div>
              <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">Visual mode synchronization settings</p>
            </div>
            
            <div className="p-8">
              <div className="grid grid-cols-3 gap-4">
                <ThemeCard label="High Light" theme="light" currentTheme={theme} setTheme={setTheme} icon="sun" />
                <ThemeCard label="Deep Dark" theme="dark" currentTheme={theme} setTheme={setTheme} icon="moon" />
                <ThemeCard label="Sync System" theme="system" currentTheme={theme} setTheme={setTheme} icon="sliders" />
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
            <div className="p-8 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Icon name="coins_stacked" className="text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text tracking-tight">Financial Context</h3>
              </div>
              <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">Currency & Calculation Standards</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary ml-1">Base Denomination</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary z-10">
                    <Icon name="coins_stacked" className="text-lg" />
                  </div>
                  <select 
                    name="currency" 
                    value={preferences.currency} 
                    onChange={handleChange} 
                    className="w-full h-14 pl-12 pr-10 bg-black/5 dark:bg-white/5 border-0 rounded-2xl font-semibold text-light-text dark:text-dark-text appearance-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
                  >
                    {CURRENCY_OPTIONS.map(c => <option key={c} value={c} className="bg-white dark:bg-dark-card">{c}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary opacity-40">
                    <Icon name="chevron_down" />
                  </div>
                </div>
              </div>

              <div className="p-5 bg-primary-500/5 dark:bg-primary-500/10 rounded-2xl border border-primary-500/10 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/20">
                    <Icon name="zap" className="text-sm" />
                  </div>
                  <p className="text-xs font-normal text-primary-600 dark:text-primary-400 leading-normal">
                      Crystal automatically synchronizes language, date-strings, and temporal offsets via your browser environment for atomic precision.
                  </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Behavioral Logic */}
        <div className="space-y-10">
          <section className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
            <div className="p-8 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Icon name="zap" className="text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text tracking-tight">Operational Defaults</h3>
              </div>
              <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">Workflow Optimization & Smart Logic</p>
            </div>
            
            <div className="p-8 space-y-8 divide-y divide-black/5 dark:divide-white/5">
                <SettingRow label="Dashboard Lookback" description="The default analytical window for your main intelligence views.">
                  <div className="relative group">
                    <select name="defaultPeriod" value={preferences.defaultPeriod} onChange={handleChange} className="w-full h-12 px-4 pr-10 bg-black/5 dark:bg-white/5 border-0 rounded-xl font-medium text-xs text-light-text dark:text-dark-text appearance-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer">
                      {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-white dark:bg-dark-card">{opt.label}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary opacity-40">
                      <Icon name="expand_more" className="text-sm" />
                    </div>
                  </div>
                </SettingRow>

                <SettingRow label="Forecast Projection" description="Future window used for automated growth & cashflow modeling.">
                  <div className="relative group">
                    <select
                      name="defaultForecastPeriod"
                      value={preferences.defaultForecastPeriod || '1Y'}
                      onChange={handleChange}
                      className="w-full h-12 px-4 pr-10 bg-black/5 dark:bg-white/5 border-0 rounded-xl font-medium text-xs text-light-text dark:text-dark-text appearance-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
                    >
                      {FORECAST_DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-white dark:bg-dark-card">{opt.label}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary opacity-40">
                      <Icon name="expand_more" className="text-sm" />
                    </div>
                  </div>
                </SettingRow>

                <SettingRow label="Ledger Prioritization" description="Determination logic for sorting financial vehicles.">
                  <div className="relative group">
                    <select name="defaultAccountOrder" value={preferences.defaultAccountOrder} onChange={handleChange} className="w-full h-12 px-4 pr-10 bg-black/5 dark:bg-white/5 border-0 rounded-xl font-medium text-xs text-light-text dark:text-dark-text appearance-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer">
                      {DEFAULT_ACCOUNT_ORDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-white dark:bg-dark-card">{opt.label}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary opacity-40">
                      <Icon name="expand_more" className="text-sm" />
                    </div>
                  </div>
                </SettingRow>

                <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <button 
                      onClick={() => setPreferences({ ...preferences, excludeTransfersFromAnalytics: !preferences.excludeTransfersFromAnalytics })}
                      className={`p-5 rounded-2xl border transition-all text-left space-y-2 ${preferences.excludeTransfersFromAnalytics ? 'bg-primary-500 border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-black/10 dark:hover:border-white/10'}`}
                   >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${preferences.excludeTransfersFromAnalytics ? 'bg-white text-primary-500' : 'bg-white dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary'}`}>
                        <Icon name={preferences.excludeTransfersFromAnalytics ? 'visibility_off' : 'visibility'} className="text-sm" />
                      </div>
                      <div>
                        <p className={`text-xs font-semibold tracking-tight ${preferences.excludeTransfersFromAnalytics ? 'text-white' : 'text-light-text dark:text-dark-text'}`}>Transfers</p>
                        <p className={`text-xs font-normal leading-normal ${preferences.excludeTransfersFromAnalytics ? 'text-white/70' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-75'}`}>Excluded from charts</p>
                      </div>
                   </button>

                   <button 
                      onClick={() => setPreferences({ ...preferences, showBalanceAdjustments: !preferences.showBalanceAdjustments })}
                      className={`p-5 rounded-2xl border transition-all text-left space-y-2 ${preferences.showBalanceAdjustments ? 'bg-primary-500 border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-black/10 dark:hover:border-white/10'}`}
                   >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${preferences.showBalanceAdjustments ? 'bg-white text-primary-500' : 'bg-white dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary'}`}>
                        <Icon name={preferences.showBalanceAdjustments ? 'check_circle' : 'cancel'} className="text-sm" />
                      </div>
                      <div>
                        <p className={`text-xs font-semibold tracking-tight ${preferences.showBalanceAdjustments ? 'text-white' : 'text-light-text dark:text-dark-text'}`}>Adjustments</p>
                        <p className={`text-xs font-normal leading-normal ${preferences.showBalanceAdjustments ? 'text-white/70' : 'text-light-text-secondary dark:text-dark-text-secondary opacity-75'}`}>Include manual state changes</p>
                      </div>
                   </button>
                </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Preferences;

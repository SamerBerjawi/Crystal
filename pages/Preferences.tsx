import React from 'react';
import { AppPreferences, Theme, Page } from '../types';
import Card from '../components/Card';
import { SELECT_WRAPPER_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, CURRENCY_OPTIONS, TIMEZONE_OPTIONS, COUNTRY_OPTIONS, DURATION_OPTIONS, DEFAULT_ACCOUNT_ORDER_OPTIONS, QUICK_CREATE_BUDGET_OPTIONS, FORECAST_DURATION_OPTIONS } from '../constants';

interface PreferencesProps {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setCurrentPage: (page: Page) => void;
}

const PreferenceRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 items-center py-4 border-b border-black/5 dark:border-white/10 last:border-b-0">
    <label className="font-medium text-base text-light-text dark:text-dark-text">{label}</label>
    <div className="mt-2 md:mt-0">
      {children}
    </div>
  </div>
);

const ThemeCard: React.FC<{
  label: string;
  theme: Theme;
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}> = ({ label, theme, currentTheme, setTheme }) => {
  const isSelected = currentTheme === theme;
  
  const lightSvg = (
    <svg width="100%" height="100%" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="100" rx="6" fill="#F7F8FC"/>
      <rect x="10" y="10" width="30" height="80" rx="4" fill="#FFFFFF"/>
      <rect x="48" y="10" width="102" height="15" rx="4" fill="#FFFFFF"/>
      <rect x="58" y="35" width="84" height="4" rx="2" fill="#E2E8F0"/>
      <rect x="58" y="45" width="64" height="4" rx="2" fill="#E2E8F0"/>
      <path d="M58 70L78 55L98 65L118 50L138 60" stroke="#48BB78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const darkSvg = (
    <svg width="100%" height="100%" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="100" rx="6" fill="#1A202C"/>
      <rect x="10" y="10" width="30" height="80" rx="4" fill="#2D3748"/>
      <rect x="48" y="10" width="102" height="15" rx="4" fill="#2D3748"/>
      <rect x="58" y="35" width="84" height="4" rx="2" fill="#4A5568"/>
      <rect x="58" y="45" width="64" height="4" rx="2" fill="#4A5568"/>
      <path d="M58 70L78 55L98 65L118 50L138 60" stroke="#48BB78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const systemSvg = (
     <svg width="100%" height="100%" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 6C0 2.68629 2.68629 0 6 0H80V100H6C2.68629 100 0 97.3137 0 94V6Z" fill="#F7F8FC"/>
      <path d="M154 0H80V100H154C157.314 100 160 97.3137 160 94V6C160 2.68629 157.314 0 154 0Z" fill="#1A202C"/>
      <path d="M58 70L78 55L98 65L118 50L138 60" stroke="#48BB78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  
  const getVisual = () => {
    switch (theme) {
      case 'light': return lightSvg;
      case 'dark': return darkSvg;
      case 'system': return systemSvg;
    }
  };
  
  return (
    <div
      onClick={() => setTheme(theme)}
      className={`cursor-pointer rounded-lg p-3 transition-all duration-200 ${
        isSelected ? 'ring-2 ring-primary-500 bg-primary-500/10' : 'ring-1 ring-transparent hover:ring-primary-400'
      }`}
    >
      <div className={`aspect-[1.6/1] rounded-md overflow-hidden border ${isSelected ? 'border-transparent' : 'border-gray-200 dark:border-gray-700'}`}>
        {getVisual()}
      </div>
      <p className="text-center font-semibold text-base mt-3">{label}</p>
    </div>
  );
};


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
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span> / </span>
                <span className="text-light-text dark:text-dark-text font-medium">Preferences</span>
            </div>
        </div>
        <div className="mt-4">
            {/* <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">Preferences</h2> */}
            <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Configure your personal preferences for the app.</p>
        </div>
      </header>
      
      <Card>
        <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">General</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">Configure your preferences</p>
        <div className="divide-y divide-black/5 dark:divide-white/10">
          <PreferenceRow label="Currency">
            <div className={SELECT_WRAPPER_STYLE}>
              <select name="currency" value={preferences.currency} onChange={handleChange} className={INPUT_BASE_STYLE}>
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </PreferenceRow>
          <PreferenceRow label="Language">
            <div className={SELECT_WRAPPER_STYLE}>
              <select name="language" value={preferences.language} onChange={handleChange} className={INPUT_BASE_STYLE}>
                <option>English (en)</option>
                <option>Français (fr)</option>
                <option>Español (es)</option>
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </PreferenceRow>
          <PreferenceRow label="Timezone">
             <div className={SELECT_WRAPPER_STYLE}>
              <select name="timezone" value={preferences.timezone} onChange={handleChange} className={INPUT_BASE_STYLE}>
                {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </PreferenceRow>
          <PreferenceRow label="Date format">
             <div className={SELECT_WRAPPER_STYLE}>
              <select name="dateFormat" value={preferences.dateFormat} onChange={handleChange} className={INPUT_BASE_STYLE}>
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </PreferenceRow>
          <PreferenceRow label="Default Period">
            <div className={SELECT_WRAPPER_STYLE}>
              <select name="defaultPeriod" value={preferences.defaultPeriod} onChange={handleChange} className={INPUT_BASE_STYLE}>
                {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </PreferenceRow>
          <PreferenceRow label="Default Forecast Period">
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
          </PreferenceRow>
          <PreferenceRow label="Default Account Order">
            <div className={SELECT_WRAPPER_STYLE}>
              <select name="defaultAccountOrder" value={preferences.defaultAccountOrder} onChange={handleChange} className={INPUT_BASE_STYLE}>
                {DEFAULT_ACCOUNT_ORDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </PreferenceRow>
          <PreferenceRow label="Default Quick Create Period">
            <div className={SELECT_WRAPPER_STYLE}>
                <select name="defaultQuickCreatePeriod" value={preferences.defaultQuickCreatePeriod || 3} onChange={handleChange} className={INPUT_BASE_STYLE}>
                    {QUICK_CREATE_BUDGET_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </PreferenceRow>
          <PreferenceRow label="Country">
            <div className={SELECT_WRAPPER_STYLE}>
              <select name="country" value={preferences.country} onChange={handleChange} className={INPUT_BASE_STYLE}>
                {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">Please note, we are still working on translations for various languages.</p>
          </PreferenceRow>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">Theme</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">Choose a preferred theme for the app.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <ThemeCard label="Light" theme="light" currentTheme={theme} setTheme={setTheme} />
          <ThemeCard label="Dark" theme="dark" currentTheme={theme} setTheme={setTheme} />
          <ThemeCard label="System" theme="system" currentTheme={theme} setTheme={setTheme} />
        </div>
      </Card>

    </div>
  );
};

export default Preferences;

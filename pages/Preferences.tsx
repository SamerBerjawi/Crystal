import React, { useEffect, useMemo, useState } from 'react';
import { AppFontCategory, AppPreferences, Page, Theme } from '../types';
import { COUNTRY_OPTIONS, DEFAULT_ACCOUNT_ORDER_OPTIONS, DURATION_OPTIONS, FORECAST_DURATION_OPTIONS, TIMEZONE_OPTIONS } from '../constants';
import { ensureFontLoaded, FONT_CATEGORIES, FONT_DEFINITIONS, normalizeFontKey } from '../hooks/useFont';
import SettingsGroup from '../components/SettingsGroup';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import ExchangeRates from '../components/ExchangeRates';
import { Switch, TextInput } from '../components/ui/Fields';
import { formatCurrency, normalizeCurrency, setMainCurrency } from '../utils';
import { currencyOptions, currencyPreference } from '../utils/currencies';
import Icon from '../components/ui/Icon';
import { Combobox, Select } from '../components/ui/Pickers';
import SegmentedControl from '../components/ui/SegmentedControl';
import { cn } from '../lib/utils';

interface PreferencesProps {
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setCurrentPage: (page: Page) => void;
  currenciesInUse: string[];
}

const THEMES = [
  { id: 'light', label: 'Light', icon: 'sun-01' },
  { id: 'dark', label: 'Dark', icon: 'moon-02' },
  { id: 'system', label: 'System', icon: 'contrast' },
];

const DATE_FORMATS = [
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', description: '31/12/2026' },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', description: '12/31/2026' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', description: '2026-12-31' },
  { id: 'DD.MM.YYYY', label: 'DD.MM.YYYY', description: '31.12.2026' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const FONT_LIST = Object.values(FONT_DEFINITIONS).filter(
  (font, index, all) => all.findIndex(item => normalizeFontKey(item.id) === normalizeFontKey(font.id)) === index,
);

const toOptions = (values: string[]) => values.map(value => ({ id: value, label: value }));

const CalculationSwitch: React.FC<{ title: string; description: string; isSelected: boolean; onChange: (value: boolean) => void }> = ({ title, description, isSelected, onChange }) => (
  <Switch isSelected={isSelected} onChange={onChange}>
    <span className="type-body-strong block text-ink">{title}</span>
    <span className="type-caption mt-0.5 block text-muted">{description}</span>
  </Switch>
);

export const Preferences: React.FC<PreferencesProps> = ({ preferences, setPreferences, theme, setTheme, setCurrentPage, currenciesInUse }) => {
  const [fontCategory, setFontCategory] = useState<'all' | AppFontCategory>('all');
  const activeCurrencyCode = normalizeCurrency(preferences.currency);
  const [specimen, setSpecimen] = useState(() => formatCurrency(125480, activeCurrencyCode));

  const set = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) =>
    setPreferences(prev => (typeof prev === 'object' && prev !== null ? { ...prev, [key]: value } : { ...preferences, [key]: value }));

  const currencyList = useMemo(currencyOptions, []);
  const rateSource = preferences.ratesUpdatedAt
    ? `From the European Central Bank${preferences.twelveDataApiKey ? ' and Twelve Data' : ''}, updated ${new Date(preferences.ratesUpdatedAt).toLocaleDateString()}.`
    : 'Rates haven’t been fetched yet.';

  const currentFont = normalizeFontKey(preferences.appFont || 'manrope');
  const fonts = useMemo(() => (fontCategory === 'all' ? FONT_LIST : FONT_LIST.filter(font => font.category === fontCategory)), [fontCategory]);

  // The picker previews every face, so load them now (and only now) rather than at startup.
  useEffect(() => { fonts.forEach(font => ensureFontLoaded(font.id)); }, [fonts]);

  return (
    <div className="space-y-8">
      <SettingsSubpageHeader title="Preferences" setCurrentPage={setCurrentPage} />

      <SettingsGroup id="preferences-appearance" title="Appearance" description="How Crystal looks.">
        <p className="type-label mb-1.5 text-ink">Theme</p>
        <SegmentedControl items={THEMES} activeId={theme} onChange={id => setTheme(id as Theme)} />

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <p className="type-label text-ink">Typeface</p>
          <SegmentedControl
            scrollable
            items={FONT_CATEGORIES.map(category => ({ id: category.id, label: category.id === 'all' ? 'All' : category.label.split(' ')[0] }))}
            activeId={fontCategory}
            onChange={id => setFontCategory(id as 'all' | AppFontCategory)}
          />
        </div>
        <TextInput label="Sample text" className="mt-3" value={specimen} onChange={setSpecimen} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:max-h-96 md:overflow-y-auto">
          {fonts.map(font => {
            const isSelected = currentFont === normalizeFontKey(font.id);
            return (
              <button
                key={font.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => set('appFont', font.id)}
                className={cn('min-w-0 cursor-pointer rounded-[var(--radius-md)] border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected ? 'border-primary bg-inset' : 'border-line hover:bg-inset')}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="type-caption truncate text-muted">{font.label}</span>
                  {isSelected && <Icon name="check" size={16} weight="bold" className="shrink-0 text-primary" />}
                </span>
                <span className="mt-1 block truncate text-lg text-ink" style={{ fontFamily: font.fontFamily }}>{specimen || font.sampleText}</span>
              </button>
            );
          })}
        </div>
      </SettingsGroup>

      <SettingsGroup id="preferences-region" title="Region" description="Totals across Crystal convert to your main currency.">
        <div className="grid gap-4 md:grid-cols-2">
          <Combobox
            label="Main currency"
            options={currencyList}
            value={activeCurrencyCode}
            onChange={id => {
              if (!id) return;
              const normalized = normalizeCurrency(id);
              setMainCurrency(normalized);
              set('currency', currencyPreference(id));
              setSpecimen(formatCurrency(125480, normalized));
            }}
          />
          <Combobox label="Country" options={toOptions(COUNTRY_OPTIONS)} value={preferences.country} onChange={id => id && set('country', id)} />
          <Combobox label="Timezone" className="md:col-span-2" options={toOptions(TIMEZONE_OPTIONS)} value={preferences.timezone} onChange={id => id && set('timezone', id)} />
        </div>
      </SettingsGroup>

      <SettingsGroup id="preferences-rates" title="Exchange rates" description={rateSource}>
        <ExchangeRates preferences={preferences} setPreferences={setPreferences} currenciesInUse={currenciesInUse} />
      </SettingsGroup>

      <SettingsGroup id="preferences-calendar" title="Calendar">
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Date format" options={DATE_FORMATS} value={preferences.dateFormat || 'DD/MM/YYYY'} onChange={id => set('dateFormat', id as AppPreferences['dateFormat'])} />
          <Select
            label="Financial year starts in"
            options={MONTHS.map((month, index) => ({ id: String(index + 1), label: month }))}
            value={String(preferences.financialYearStartMonth || 1)}
            onChange={id => set('financialYearStartMonth', Number(id))}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup id="preferences-defaults" title="Defaults" description="What pages show when you first open them.">
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Overview period" options={DURATION_OPTIONS.map(option => ({ id: option.value, label: option.label }))} value={preferences.defaultPeriod} onChange={id => set('defaultPeriod', id as AppPreferences['defaultPeriod'])} />
          <Select label="Forecast length" options={FORECAST_DURATION_OPTIONS.map(option => ({ id: option.value, label: option.label }))} value={preferences.defaultForecastPeriod || '1Y'} onChange={id => set('defaultForecastPeriod', id as AppPreferences['defaultForecastPeriod'])} />
          <Select label="Account order" options={DEFAULT_ACCOUNT_ORDER_OPTIONS.map(option => ({ id: option.value, label: option.label }))} value={preferences.defaultAccountOrder} onChange={id => set('defaultAccountOrder', id as AppPreferences['defaultAccountOrder'])} />
          <Select
            label="Quick budget lookback"
            options={[
              { id: '1', label: 'Last month' },
              { id: '3', label: '3-month average' },
              { id: '6', label: '6-month average' },
              { id: '12', label: '12-month average' },
            ]}
            value={String(preferences.defaultQuickCreatePeriod || 3)}
            onChange={id => set('defaultQuickCreatePeriod', Number(id))}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup id="preferences-calculations" title="Calculations and privacy">
        <div className="space-y-1">
          <CalculationSwitch
            title="Leave transfers out of charts"
            description="Moving money between your own accounts won’t count as income or spending."
            isSelected={!!preferences.excludeTransfersFromAnalytics}
            onChange={value => set('excludeTransfersFromAnalytics', value)}
          />
          <CalculationSwitch
            title="Show balance adjustments"
            description="Include manual balance corrections in transaction lists and cash flow."
            isSelected={!!preferences.showBalanceAdjustments}
            onChange={value => set('showBalanceAdjustments', value)}
          />
          <CalculationSwitch
            title="Hide balances at startup"
            description="Blur amounts each time Crystal opens."
            isSelected={!!preferences.isPrivacyMode}
            onChange={value => set('isPrivacyMode', value)}
          />
        </div>
      </SettingsGroup>
    </div>
  );
};

export default Preferences;

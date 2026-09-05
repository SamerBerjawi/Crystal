import React, { useState, useMemo } from 'react';
import { AppPreferences, Theme, Page, AppFont, AppFontCategory } from '../types';
import { FONT_DEFINITIONS, FONT_CATEGORIES, normalizeFontKey } from '../hooks/useFont';
import {
  CURRENCY_OPTIONS,
  TIMEZONE_OPTIONS,
  COUNTRY_OPTIONS,
  DURATION_OPTIONS,
  DEFAULT_ACCOUNT_ORDER_OPTIONS,
  FORECAST_DURATION_OPTIONS,
  INPUT_BASE_STYLE,
  SELECT_STYLE,
  SELECT_WRAPPER_STYLE,
  SELECT_ARROW_STYLE,
} from '../constants';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import StatCard from '../components/StatCard';
import { BentoGrid } from '../components/ui/bento-grid';
import Icon from '../components/ui/Icon';

interface PreferencesProps {
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setCurrentPage: (page: Page) => void;
}

export const Preferences: React.FC<PreferencesProps> = ({
  preferences,
  setPreferences,
  theme,
  setTheme,
  setCurrentPage,
}) => {
  const [selectedFontCategory, setSelectedFontCategory] = useState<'all' | AppFontCategory>('all');
  const [customSpecimenText, setCustomSpecimenText] = useState('€125,480.00 • Crystal Wealth');
  const [showTwelveDataKey, setShowTwelveDataKey] = useState(false);

  const currentFont: AppFont = preferences.appFont || 'plus-jakarta';

  const handleFontChange = (newFont: AppFont) => {
    setPreferences({ ...preferences, appFont: newFont });
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setPreferences({ ...preferences, [name]: checked });
    } else if (name === 'defaultQuickCreatePeriod' || name === 'financialYearStartMonth') {
      setPreferences({ ...preferences, [name]: Number(value) });
    } else {
      setPreferences({ ...preferences, [name]: value as any });
    }
  };

  const handleToggle = (key: keyof AppPreferences) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  const visibleFonts = useMemo(() => {
    const allDefs = Object.values(FONT_DEFINITIONS).filter(
      (f, idx, arr) => arr.findIndex((item) => normalizeFontKey(item.id) === normalizeFontKey(f.id)) === idx
    );
    if (selectedFontCategory === 'all') return allDefs;
    return allDefs.filter((f) => f.category === selectedFontCategory);
  }, [selectedFontCategory]);

  const activeFontDef = useMemo(() => {
    return (
      Object.values(FONT_DEFINITIONS).find(
        (f) => normalizeFontKey(f.id) === normalizeFontKey(currentFont)
      ) || FONT_DEFINITIONS['plus-jakarta']
    );
  }, [currentFont]);

  // Today formatted in user's date format for live preview
  const formattedTodayPreview = useMemo(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const fmt = preferences.dateFormat || 'DD/MM/YYYY';
    switch (fmt) {
      case 'MM/DD/YYYY':
        return `${m}/${d}/${y}`;
      case 'YYYY-MM-DD':
        return `${y}-${m}-${d}`;
      case 'DD.MM.YYYY':
        return `${d}.${m}.${y}`;
      case 'DD/MM/YYYY':
      default:
        return `${d}/${m}/${y}`;
    }
  }, [preferences.dateFormat]);

  const topCurrencies = [
    { code: 'EUR (€)', label: 'Euro', symbol: '€' },
    { code: 'USD ($)', label: 'USD', symbol: '$' },
    { code: 'GBP (£)', label: 'Pound', symbol: '£' },
    { code: 'CHF (CHF)', label: 'Franc', symbol: '₣' },
    { code: 'JPY (¥)', label: 'Yen', symbol: '¥' },
    { code: 'CAD (C$)', label: 'CAD', symbol: 'C$' },
    { code: 'AUD (A$)', label: 'AUD', symbol: 'A$' },
    { code: 'RON (lei)', label: 'Leu', symbol: 'lei' },
  ];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-2";

  return (
    <div className="w-full pb-12 space-y-10 animate-fade-in-up px-4">
      {/* Navigation & Header */}
      <SettingsSubpageHeader
        markerIcon="sliders"
        markerLabel="Personalization"
        title="Preferences"
        subtitle="Configure workspace visual appearance, regional standards, and algorithmic behaviors."
        setCurrentPage={setCurrentPage}
      />

      {/* Overview Stats matching other settings pages (Categories, Tags, DataImportExport) */}
      <BentoGrid className="grid-cols-2 lg:grid-cols-4 auto-rows-auto gap-4 sm:gap-6">
        <StatCard
          title="Active Theme"
          value={theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
          subtext={theme === 'system' ? 'OS Dynamic Sync' : theme === 'dark' ? 'OLED Contrast' : 'Natural Sunlight'}
          icon={theme === 'dark' ? 'dark_mode' : theme === 'light' ? 'light_mode' : 'settings_brightness'}
          colorClass="text-indigo-600 dark:text-indigo-400"
        />
        <StatCard
          title="Active Typeface"
          value={activeFontDef.label.split(' ')[0]}
          subtext={activeFontDef.categoryLabel}
          icon="format_size"
          colorClass="text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Base Currency"
          value={preferences.currency.split(' ')[0]}
          subtext={topCurrencies.find((c) => c.code === preferences.currency)?.label || 'Global Standard'}
          icon="paid"
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Date Format"
          value={preferences.dateFormat || 'DD/MM/YYYY'}
          subtext={formattedTodayPreview}
          icon="calendar_today"
          colorClass="text-amber-600 dark:text-amber-400"
        />
      </BentoGrid>

      {/* ── Section 1: Visual & Styling Environment ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
          <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">
            Visual & Styling Environment
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Interface Theme */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                    <Icon name="palette" className="text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight tracking-tight">
                      Interface Theme
                    </h3>
                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Visual contrast mode & ambient appearance
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                  {theme === 'system' ? 'System Sync' : theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>

              {/* 3 Theme Mode Tiles */}
              <div className="grid grid-cols-3 gap-3">
                {/* Light */}
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between group ${
                    theme === 'light'
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/30'
                      : 'border-slate-200/80 dark:border-white/10 glass-tile hover:border-indigo-500/40'
                  }`}
                >
                  <div className="w-full h-14 rounded-xl bg-neutral-100 border border-neutral-300 p-2 flex flex-col justify-between mb-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="w-6 h-1.5 rounded-full bg-neutral-300" />
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-1.5 rounded bg-white shadow-xs" />
                      <div className="w-2/3 h-1.5 rounded bg-neutral-200" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon name="light_mode" className={`text-sm ${theme === 'light' ? 'text-amber-500' : 'text-neutral-500'}`} />
                      <span className={`text-xs font-bold ${theme === 'light' ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        Light
                      </span>
                    </div>
                    {theme === 'light' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xs font-bold shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                </button>

                {/* Dark */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between group ${
                    theme === 'dark'
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/30'
                      : 'border-slate-200/80 dark:border-white/10 glass-tile hover:border-indigo-500/40'
                  }`}
                >
                  <div className="w-full h-14 rounded-xl bg-neutral-950 border border-neutral-800 p-2 flex flex-col justify-between mb-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="w-6 h-1.5 rounded-full bg-neutral-800" />
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-1.5 rounded bg-neutral-900 border border-white/5" />
                      <div className="w-2/3 h-1.5 rounded bg-neutral-800" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon name="dark_mode" className={`text-sm ${theme === 'dark' ? 'text-indigo-400' : 'text-neutral-500'}`} />
                      <span className={`text-xs font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        Dark
                      </span>
                    </div>
                    {theme === 'dark' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xs font-bold shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                </button>

                {/* System */}
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between group ${
                    theme === 'system'
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/30'
                      : 'border-slate-200/80 dark:border-white/10 glass-tile hover:border-indigo-500/40'
                  }`}
                >
                  <div className="w-full h-14 rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-900 border border-neutral-400/40 p-2 flex flex-col justify-between mb-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="w-6 h-1.5 rounded-full bg-white/60" />
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    </div>
                    <div className="w-full h-1.5 rounded bg-white/30" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon name="settings_brightness" className={`text-sm ${theme === 'system' ? 'text-indigo-500' : 'text-neutral-500'}`} />
                      <span className={`text-xs font-bold ${theme === 'system' ? 'text-indigo-500' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        System
                      </span>
                    </div>
                    {theme === 'system' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xs font-bold shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-5 opacity-70 leading-relaxed">
              Theme settings adapt immediately across all charts, modals, and telemetry graphs.
            </p>
          </div>

          {/* Card 2: Typography Studio */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                    <Icon name="format_size" className="text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight tracking-tight">
                      Typography
                    </h3>
                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Typeface for data tables & interface
                    </p>
                  </div>
                </div>

                {/* Specimen Test Input */}
                <div className="relative w-full sm:w-48">
                  <input
                    type="text"
                    value={customSpecimenText}
                    onChange={(e) => setCustomSpecimenText(e.target.value)}
                    placeholder="Test text..."
                    className="w-full pl-3 pr-8 py-1.5 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-medium text-light-text dark:text-dark-text focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-500 text-xs pointer-events-none">
                    ✎
                  </span>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
                {FONT_CATEGORIES.map((cat) => {
                  const isActive = selectedFontCategory === cat.id;
                  const count =
                    cat.id === 'all'
                      ? Object.values(FONT_DEFINITIONS).filter(
                          (f, idx, arr) =>
                            arr.findIndex((item) => normalizeFontKey(item.id) === normalizeFontKey(f.id)) === idx
                        ).length
                      : Object.values(FONT_DEFINITIONS).filter(
                          (f) => f.category === cat.id && f.id !== 'plus-jakarta-sans'
                        ).length;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedFontCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      <Icon name={cat.icon} className="text-xs" />
                      <span>{cat.label}</span>
                      <span
                        className={`text-2xs px-1 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Font Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-1 mt-3">
                {visibleFonts.map((fontDef) => {
                  const isSelected = normalizeFontKey(currentFont) === normalizeFontKey(fontDef.id);
                  return (
                    <button
                      key={fontDef.id}
                      type="button"
                      onClick={() => handleFontChange(fontDef.id)}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between group ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30'
                          : 'border-slate-200/80 dark:border-white/10 glass-tile hover:border-purple-500/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="text-xl font-bold tracking-tight text-light-text dark:text-dark-text leading-none"
                            style={{ fontFamily: fontDef.fontFamily }}
                          >
                            Aa
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              {fontDef.categoryLabel}
                            </span>
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-2xs font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                        </div>

                        <h4
                          className={`text-xs font-bold truncate ${
                            isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-light-text dark:text-dark-text'
                          }`}
                          style={{ fontFamily: fontDef.fontFamily }}
                        >
                          {fontDef.label}
                        </h4>
                      </div>

                      <div
                        className="w-full mt-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs text-neutral-800 dark:text-neutral-200 font-medium truncate"
                        style={{ fontFamily: fontDef.fontFamily }}
                      >
                        {customSpecimenText || fontDef.sampleText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-4 opacity-70 leading-relaxed">
              Fonts are loaded with optical sizing and tabular lining numerals for perfect ledger balance.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Financial & Regional Standards ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
          <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">
            Financial & Regional Standards
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Currency & Localization */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 pb-5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                    <Icon name="paid" className="text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight tracking-tight">
                      Currency & Localization
                    </h3>
                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Base currency & regional geo-location
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  {preferences.currency.split(' ')[0]}
                </span>
              </div>

              {/* Quick Currency Selection */}
              <div>
                <label className={labelStyle}>Base Currency Quick-Select</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {topCurrencies.map((c) => {
                    const isSelected = preferences.currency === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setPreferences({ ...preferences, currency: c.code })}
                        className={`p-2 rounded-xl border transition-all cursor-pointer text-left flex items-center justify-between ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs'
                            : 'border-slate-200/80 dark:border-white/10 glass-tile hover:border-emerald-500/30 text-light-text-secondary dark:text-dark-text-secondary'
                        }`}
                      >
                        <span className="text-xs truncate">{c.label}</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 ml-1">
                          {c.symbol}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={SELECT_WRAPPER_STYLE}>
                  <select
                    name="currency"
                    value={preferences.currency}
                    onChange={handleSelectChange}
                    className={SELECT_STYLE}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-dark-card">
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className={SELECT_ARROW_STYLE}>
                    <Icon name="expand_more" className="text-base" />
                  </div>
                </div>
              </div>

              {/* Timezone & Country in 2 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label htmlFor="country-select" className={labelStyle}>Country</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select
                      id="country-select"
                      name="country"
                      value={preferences.country}
                      onChange={handleSelectChange}
                      className={SELECT_STYLE}
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c} className="bg-white dark:bg-dark-card">
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}>
                      <Icon name="expand_more" className="text-base" />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="timezone-select" className={labelStyle}>Timezone</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select
                      id="timezone-select"
                      name="timezone"
                      value={preferences.timezone}
                      onChange={handleSelectChange}
                      className={SELECT_STYLE}
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz} value={tz} className="bg-white dark:bg-dark-card">
                          {tz}
                        </option>
                      ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}>
                      <Icon name="expand_more" className="text-base" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-5 opacity-70 leading-relaxed">
              Currency changes automatically re-anchor cash balance summaries and historical transaction metrics.
            </p>
          </div>

          {/* Card 2: Calendar & Fiscal Presentation */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 pb-5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                    <Icon name="calendar_today" className="text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight tracking-tight">
                      Calendar & Fiscal Year
                    </h3>
                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Temporal formatting & annual reporting bounds
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  {formattedTodayPreview}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="date-format-select" className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider">
                    Date Presentation Standard
                  </label>
                  <span className="text-2xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    Live: {formattedTodayPreview}
                  </span>
                </div>
                <div className={SELECT_WRAPPER_STYLE}>
                  <select
                    id="date-format-select"
                    name="dateFormat"
                    value={preferences.dateFormat || 'DD/MM/YYYY'}
                    onChange={handleSelectChange}
                    className={SELECT_STYLE}
                  >
                    <option value="DD/MM/YYYY" className="bg-white dark:bg-dark-card">DD/MM/YYYY (31/12/2026)</option>
                    <option value="MM/DD/YYYY" className="bg-white dark:bg-dark-card">MM/DD/YYYY (12/31/2026)</option>
                    <option value="YYYY-MM-DD" className="bg-white dark:bg-dark-card">YYYY-MM-DD (2026-12-31)</option>
                    <option value="DD.MM.YYYY" className="bg-white dark:bg-dark-card">DD.MM.YYYY (31.12.2026)</option>
                  </select>
                  <div className={SELECT_ARROW_STYLE}>
                    <Icon name="expand_more" className="text-base" />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="financial-year-select" className={labelStyle}>Fiscal Year Start Month</label>
                <div className={SELECT_WRAPPER_STYLE}>
                  <select
                    id="financial-year-select"
                    name="financialYearStartMonth"
                    value={preferences.financialYearStartMonth || 1}
                    onChange={handleSelectChange}
                    className={SELECT_STYLE}
                  >
                    {monthNames.map((name, i) => (
                      <option key={name} value={i + 1} className="bg-white dark:bg-dark-card">
                        {name} ({i === 0 ? 'Standard Calendar Year' : `Fiscal cycle starting ${name}`})
                      </option>
                    ))}
                  </select>
                  <div className={SELECT_ARROW_STYLE}>
                    <Icon name="expand_more" className="text-base" />
                  </div>
                </div>
              </div>
            </div>

            {/* Informational Callout */}
            <div className="p-4 bg-primary-500/5 dark:bg-primary-500/10 rounded-2xl border border-primary-500/10 flex items-start gap-3 mt-4">
              <div className="w-8 h-8 rounded-xl bg-primary-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary-500/20">
                <Icon name="zap" className="text-sm" />
              </div>
              <p className="text-xs font-normal text-primary-600 dark:text-primary-400 leading-relaxed">
                Crystal dynamically synchronizes numeric date presentation, temporal formats, and FX conversions across all dashboards and transaction ledgers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Operational Defaults & Privacy ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
          <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">
            Operational Defaults & Behavioral Logic
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Temporal Windows & Ledger Sorting */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 pb-5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                    <Icon name="tune" className="text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight tracking-tight">
                      Temporal Windows & Sorting
                    </h3>
                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Default intervals and ledger arrangement
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="default-period-select" className={labelStyle}>Dashboard Lookback Window</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select
                      id="default-period-select"
                      name="defaultPeriod"
                      value={preferences.defaultPeriod}
                      onChange={handleSelectChange}
                      className={SELECT_STYLE}
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white dark:bg-dark-card">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}>
                      <Icon name="expand_more" className="text-base" />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="forecast-period-select" className={labelStyle}>Forecast Projection Horizon</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select
                      id="forecast-period-select"
                      name="defaultForecastPeriod"
                      value={preferences.defaultForecastPeriod || '1Y'}
                      onChange={handleSelectChange}
                      className={SELECT_STYLE}
                    >
                      {FORECAST_DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white dark:bg-dark-card">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}>
                      <Icon name="expand_more" className="text-base" />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="account-order-select" className={labelStyle}>Default Ledger Sequencing</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select
                      id="account-order-select"
                      name="defaultAccountOrder"
                      value={preferences.defaultAccountOrder}
                      onChange={handleSelectChange}
                      className={SELECT_STYLE}
                    >
                      {DEFAULT_ACCOUNT_ORDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white dark:bg-dark-card">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}>
                      <Icon name="expand_more" className="text-base" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-5 opacity-70 leading-relaxed">
              These initial bounds apply whenever opening fresh workspace tabs or clearing view filters.
            </p>
          </div>

          {/* Card 2: Ledger Governance & Privacy Shield */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 pb-5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
                    <Icon name="shield" className="text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text leading-tight tracking-tight">
                      Ledger Rules & Privacy
                    </h3>
                    <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Calculation switches & visual protection
                    </p>
                  </div>
                </div>
              </div>

              {/* Switches */}
              <div className="space-y-4 pt-1 divide-y divide-black/5 dark:divide-white/5">
                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="pr-2">
                    <h4 className="font-semibold text-xs text-light-text dark:text-dark-text">
                      Exclude Internal Transfers from Charts
                    </h4>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-70 mt-0.5">
                      Transfers between owned accounts will not artificially inflate total expense or income figures
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.excludeTransfersFromAnalytics}
                    onClick={() => handleToggle('excludeTransfersFromAnalytics')}
                    className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer shrink-0 p-0.5 ${
                      preferences.excludeTransfersFromAnalytics ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                        preferences.excludeTransfersFromAnalytics ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4">
                  <div className="pr-2">
                    <h4 className="font-semibold text-xs text-light-text dark:text-dark-text">
                      Show Manual Balance Adjustments
                    </h4>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-70 mt-0.5">
                      Display reconciliation entries directly in transaction tables and cashflow analytics
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.showBalanceAdjustments}
                    onClick={() => handleToggle('showBalanceAdjustments')}
                    className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer shrink-0 p-0.5 ${
                      preferences.showBalanceAdjustments ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                        preferences.showBalanceAdjustments ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4">
                  <div className="pr-2">
                    <h4 className="font-semibold text-xs text-light-text dark:text-dark-text">
                      Startup Privacy Shield
                    </h4>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-70 mt-0.5">
                      Automatically blur and mask account balances when opening Crystal in shared environments
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.isPrivacyMode}
                    onClick={() => handleToggle('isPrivacyMode')}
                    className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer shrink-0 p-0.5 ${
                      preferences.isPrivacyMode ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                        preferences.isPrivacyMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-5 opacity-70 leading-relaxed">
              Privacy Mode can always be quickly toggled from the user menu in the navigation sidebar.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Intelligence & External Telemetry ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
            <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight opacity-60">
              Intelligence & External Telemetry
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('Integrations')}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Open Integrations Hub</span>
            <Icon name="arrow_forward" className="text-xs" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Twelve Data Card */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                  <Icon name="line_chart_up" className="text-2xl" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                  preferences.twelveDataApiKey?.trim()
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-black/5 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-black/5 dark:border-white/10'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${preferences.twelveDataApiKey?.trim() ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  {preferences.twelveDataApiKey?.trim() ? 'Operational' : 'Config Required'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text tracking-tight">
                  Twelve Data Telemetry
                </h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-70 mt-1">
                  High-frequency engine for market rates, ETF valuations, and global currency arbitrage calculations.
                </p>
              </div>

              <div className="relative pt-1">
                <label htmlFor="twelve-data-key-input" className={labelStyle}>API Key</label>
                <div className="relative">
                  <input
                    id="twelve-data-key-input"
                    type={showTwelveDataKey ? 'text' : 'password'}
                    name="twelveDataApiKey"
                    value={preferences.twelveDataApiKey || ''}
                    onChange={handleSelectChange}
                    placeholder="Enter Twelve Data API key..."
                    className={`${INPUT_BASE_STYLE} font-mono text-xs pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTwelveDataKey((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    <Icon name={showTwelveDataKey ? 'visibility_off' : 'visibility'} className="text-sm" />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-5 opacity-70 leading-relaxed">
              Provides live exchange rates and real-time market data across global equities.
            </p>
          </div>

          {/* Brandfetch Card */}
          <div className="glass-section rounded-3xl shadow-card border border-slate-200/60 dark:border-white/5 p-6 sm:p-7 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-pink-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
                  <Icon name="zap" className="text-2xl" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                  preferences.brandfetchClientId?.trim()
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-black/5 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-black/5 dark:border-white/10'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${preferences.brandfetchClientId?.trim() ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  {preferences.brandfetchClientId?.trim() ? 'Operational' : 'Optional'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text tracking-tight">
                  Brandfetch Branding
                </h3>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-70 mt-1">
                  Metadata enrichment service for merchant identification and high-fidelity institutional branding logos.
                </p>
              </div>

              <div className="relative pt-1">
                <label htmlFor="brandfetch-client-id-input" className={labelStyle}>Client Access ID</label>
                <div className="relative">
                  <input
                    id="brandfetch-client-id-input"
                    type="text"
                    name="brandfetchClientId"
                    value={preferences.brandfetchClientId || ''}
                    onChange={handleSelectChange}
                    placeholder="Enter Brandfetch Client Access ID..."
                    className={`${INPUT_BASE_STYLE} font-mono text-xs`}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-5 opacity-70 leading-relaxed">
              Enriches transaction descriptions with verified merchant vector icons and color branding.
            </p>
          </div>
        </div>
      </section>

      {/* Synchronization Callout Footer Banner matching PersonalInfo */}
      <div className="p-6 bg-primary-500/5 dark:bg-primary-500/10 rounded-3xl border border-primary-500/10 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/20">
          <Icon name="verified_user" className="text-xl" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-primary-600 dark:text-primary-400 tracking-tight">
            Atomic Preference Synchronization
          </h4>
          <p className="text-xs font-normal text-primary-600/70 dark:text-primary-400/70 mt-0.5 leading-relaxed">
            All visual configurations, typeface choices, currency defaults, and ledger calculations are mirrored in encrypted local storage and update your dashboards in real time.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Preferences;

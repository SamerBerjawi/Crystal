import React, { useEffect, useState } from 'react';
import { AppPreferences } from '../types';
import { convertCurrency, getMainCurrency } from '../utils';
import { Badge } from './ui/Display';
import { TextInput } from './ui/Fields';

interface ExchangeRatesProps {
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  currenciesInUse: string[];
}

const RATE_DIGITS = 6;

/** The value in EUR of one unit, from a rate typed against the main currency. */
const toEurRate = (perMain: number, main: string, rates?: Record<string, number>) => {
  const mainInEur = main === 'EUR' ? 1 : convertCurrency(1, main, 'EUR', rates);
  return perMain * mainInEur;
};

const RateRow: React.FC<ExchangeRatesProps & { code: string }> = ({ code, preferences, setPreferences }) => {
  const main = getMainCurrency();
  const rates = preferences.conversionRates;
  const current = convertCurrency(1, code, main, rates);
  const shown = current > 0 ? String(Number(current.toFixed(RATE_DIGITS))) : '';
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const isManual = preferences.manualRates?.[code] !== undefined;

  const commit = () => {
    if (draft === shown) return;
    const typed = parseFloat(draft.replace(',', '.'));
    setPreferences(prev => {
      const manualRates = { ...prev.manualRates };
      const conversionRates = { ...prev.conversionRates };
      if (Number.isFinite(typed) && typed > 0) {
        manualRates[code] = toEurRate(typed, main, prev.conversionRates);
        conversionRates[code] = manualRates[code];
      } else {
        delete manualRates[code];
        delete conversionRates[code];
      }
      return { ...prev, manualRates, conversionRates };
    });
  };

  return (
    <li className="flex flex-wrap items-end gap-3 py-3 first:pt-0 last:pb-0">
      <TextInput
        label={`1 ${code} in ${main}`}
        inputMode="decimal"
        className="min-w-0 flex-1 basis-40"
        value={draft}
        onChange={setDraft}
        onBlur={commit}
      />
      {current <= 0 ? <Badge tone="attention" className="mb-2.5">No rate</Badge> : isManual && <Badge tone="neutral" className="mb-2.5">Set by you</Badge>}
    </li>
  );
};

/** One row per currency you use. A rate typed here wins over fetched ones, and clearing it goes back to them. */
const ExchangeRates: React.FC<ExchangeRatesProps> = props => {
  const main = getMainCurrency();
  const codes = props.currenciesInUse.filter(code => code !== main);
  if (codes.length === 0) return <p className="type-body text-muted">Everything you have is in {main}.</p>;
  return <ul className="divide-y divide-line">{codes.map(code => <RateRow key={code} code={code} {...props} />)}</ul>;
};

export default ExchangeRates;

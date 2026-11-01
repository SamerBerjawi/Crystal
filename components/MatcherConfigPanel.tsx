import React from 'react';
import { MatcherConfig } from '../hooks/useMatcherConfig';
import { Button } from './ui/Actions';
import { Slider, Switch } from './ui/Fields';

const DAYS = { style: 'unit', unit: 'day', unitDisplay: 'long' } as const;
const PERCENT = { style: 'unit', unit: 'percent' } as const;

interface MatcherConfigPanelProps {
  config: MatcherConfig;
  onChange: (updates: Partial<MatcherConfig>) => void;
  onReset: () => void;
}

const ScaleEnds: React.FC<{ low: string; high: string }> = ({ low, high }) => (
  <div className="type-caption -mt-2 flex justify-between text-muted"><span>{low}</span><span>{high}</span></div>
);

/** Settings apply as they change. */
export const MatcherConfigPanel: React.FC<MatcherConfigPanelProps> = ({ config, onChange, onReset }) => (
  <div className="space-y-4">
    <p className="type-body text-muted">How close a bank transaction has to be to count as a match.</p>
    <div>
      <Slider label="Amount can differ by" minValue={1} maxValue={25} formatOptions={PERCENT} value={config.amountVariancePercent} onChange={value => onChange({ amountVariancePercent: value as number })} />
      <ScaleEnds low="Strict" high="Relaxed" />
    </div>
    <Slider label="Date can differ by" minValue={1} maxValue={7} formatOptions={DAYS} value={config.dateVarianceDays} onChange={value => onChange({ dateVarianceDays: value as number })} />
    <Slider label="Look back" minValue={7} maxValue={90} formatOptions={DAYS} value={config.lookbackDays} onChange={value => onChange({ lookbackDays: value as number })} />
    <div>
      <Slider label="Lowest match score" minValue={30} maxValue={90} step={5} formatOptions={PERCENT} value={config.minMatchScore} onChange={value => onChange({ minMatchScore: value as number })} />
      <ScaleEnds low="Shows more" high="Very strict" />
    </div>
    <Switch isSelected={config.requireNameMatch} onChange={requireNameMatch => onChange({ requireNameMatch })}>Names must be similar too</Switch>
    <Button variant="ghost" size="sm" onPress={onReset}>Reset to defaults</Button>
  </div>
);

export default MatcherConfigPanel;

import React from 'react';
import type { Currency, Prediction } from '../types';
import { parseLocalDate } from '../utils';
import { predictionState } from '../utils/challengesModel';
import { IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';

const KIND_LABELS: Record<Prediction['type'], string> = { spending_cap: 'Spending limit', net_worth_goal: 'Net worth', price_target: 'Price' };
const BAR_TONES = { positive: 'var(--money-in)', negative: 'var(--money-out)', attention: 'var(--amber)', blue: 'var(--chart-1)', neutral: 'var(--muted)' };

interface PredictionCardProps {
  prediction: Prediction;
  /** Null until a holding has a price. */
  value: number | null;
  currency: Currency;
  onDelete: (id: string) => void;
}

const PredictionCard: React.FC<PredictionCardProps> = ({ prediction, value, currency, onDelete }) => {
  const shown = prediction.status === 'active' ? value ?? 0 : prediction.finalAmount ?? value ?? 0;
  const state = predictionState(prediction, shown);
  const endDate = parseLocalDate(prediction.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <article className="surface-card min-w-0 rounded-[var(--radius-xl)] p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="type-caption text-muted">{KIND_LABELS[prediction.type]}</p>
          <h3 className="type-body-strong truncate text-ink">{prediction.targetName}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={state.tone}>{state.label}</Badge>
          <IconButton icon="delete" label={`Delete prediction on ${prediction.targetName}`} tooltipPlacement="left" onPress={() => onDelete(prediction.id)} />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="type-figure-row text-ink">{value === null && prediction.status === 'active' ? 'No price yet' : <Amount value={shown} currency={currency} />}</span>
        <span className="type-caption shrink-0 text-muted">of <Amount value={prediction.targetAmount} currency={currency} /></span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-inset"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, state.progress))}%`, background: BAR_TONES[state.tone] }} /></div>
      <p className="type-caption mt-2 text-muted">{prediction.status === 'active' ? `Ends ${endDate}` : `Ended ${endDate}`}</p>
    </article>
  );
};

export default PredictionCard;

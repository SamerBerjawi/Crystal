import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { RecurringTransaction } from '../types';
import { getMainCurrency, parseLocalDate } from '../utils';
import type { SubscriptionAudit, AuditFinding, AuditKind } from '../utils/subscriptionAudit';
import type { DetectedSubscription, SubscriptionPriceChange } from '../utils/subscriptionsModel';
import { BrandMark } from './ServiceCard';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const shortDay = (date: string) =>
  parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const KIND: Record<AuditKind, { label: string; tone: 'attention' | 'blue' | 'tomato' | 'teal'; icon: string }> = {
  creep: { label: 'Price creep', tone: 'attention', icon: 'chart-increase' },
  stale: { label: 'No recent charge', tone: 'blue', icon: 'clock-01' },
  trial: { label: 'Trial ending', tone: 'tomato', icon: 'alert-circle' },
  overlap: { label: 'Overlap', tone: 'teal', icon: 'layers-01' },
};

const nameOf = (service: RecurringTransaction) => service.merchant || service.description;

type FilterKind = 'all' | 'changes' | 'detected' | 'audit';

interface SubscriptionInsightsHubProps {
  audit: SubscriptionAudit;
  priceChanges: SubscriptionPriceChange[];
  detected: DetectedSubscription[];
  onOpen: (service: RecurringTransaction) => void;
  onUpdatePrice: (change: SubscriptionPriceChange) => void;
  onPause: (service: RecurringTransaction) => void;
  onCancel: (service: RecurringTransaction) => void;
  onDismiss: (key: string) => void;
  onTrack: (candidate: DetectedSubscription) => void;
}

export const SubscriptionInsightsHub: React.FC<SubscriptionInsightsHubProps> = ({
  audit,
  priceChanges,
  detected,
  onOpen,
  onUpdatePrice,
  onPause,
  onCancel,
  onDismiss,
  onTrack,
}) => {
  const currency = getMainCurrency();
  const [filter, setFilter] = useState<FilterKind>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  const totalCount = priceChanges.length + detected.length + audit.findings.length;
  if (totalCount === 0 && audit.potentialSaving <= 0) {
    return null;
  }

  const auditActions = (finding: AuditFinding) => {
    const { service } = finding;
    switch (finding.kind) {
      case 'creep':
        return (
          <Button variant="secondary" size="sm" onPress={() => onOpen(service)}>
            Review
          </Button>
        );
      case 'stale':
        return (
          <>
            <Button variant="secondary" size="sm" onPress={() => onPause(service)}>
              Pause
            </Button>
            <Button variant="secondary" size="sm" onPress={() => onCancel(service)}>
              Mark cancelled
            </Button>
          </>
        );
      case 'trial':
        return (
          <Button variant="secondary" size="sm" onPress={() => onCancel(service)}>
            Mark cancelled
          </Button>
        );
      case 'overlap':
        return (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => onOpen(finding.services[finding.services.length - 1])}
          >
            Review cheapest
          </Button>
        );
    }
  };

  const showChanges = (filter === 'all' || filter === 'changes') && priceChanges.length > 0;
  const showDetected = (filter === 'all' || filter === 'detected') && detected.length > 0;
  const showAudit = (filter === 'all' || filter === 'audit') && audit.findings.length > 0;

  return (
    <section
      aria-label="Subscriptions insights and alerts"
      className="surface-card rounded-[var(--radius-xl)] border border-line p-5 transition-all shadow-2xs"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber/15 text-attention-text">
            <Icon name="alert-02" size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="type-card-title text-ink font-semibold">Insights & Attention</h2>
              {totalCount > 0 && (
                <Badge tone="attention" className="text-xs font-bold px-2 py-0.5">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'}
                </Badge>
              )}
            </div>
            <p className="type-caption text-muted">
              {audit.potentialSaving > 0 ? (
                <>Up to <Amount value={audit.potentialSaving} currency={currency} className="text-ink font-medium" /> a year could be saved</>
              ) : (
                'Review price adjustments, new discoveries and recommendations'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:text-ink hover:bg-inset transition-colors"
          >
            <span>{isExpanded ? 'Collapse' : 'Show details'}</span>
            <Icon name={isExpanded ? 'arrow-up-01' : 'arrow-down-01'} size={14} />
          </button>
        </div>
      </div>

      {/* Filter Chips & Content (when expanded) */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-line/60">
          {/* Sub-tabs if multiple types of alerts exist */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === 'all'
                  ? 'bg-ink text-solid font-semibold'
                  : 'bg-inset text-muted hover:text-ink'
              )}
            >
              All ({totalCount})
            </button>
            {priceChanges.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter('changes')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5',
                  filter === 'changes'
                    ? 'bg-amber text-solid font-semibold'
                    : 'bg-amber/15 text-attention-text hover:bg-amber/25'
                )}
              >
                <span>Price changes</span>
                <span className="font-bold">({priceChanges.length})</span>
              </button>
            )}
            {detected.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter('detected')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5',
                  filter === 'detected'
                    ? 'bg-ink text-solid font-semibold'
                    : 'bg-inset text-muted hover:text-ink'
                )}
              >
                <span>Found in transactions</span>
                <span>({detected.length})</span>
              </button>
            )}
            {audit.findings.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter('audit')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5',
                  filter === 'audit'
                    ? 'bg-ink text-solid font-semibold'
                    : 'bg-inset text-muted hover:text-ink'
                )}
              >
                <span>Audit</span>
                <span>({audit.findings.length})</span>
              </button>
            )}
          </div>

          <ul className="divide-y divide-line/70">
            {/* 1. Price Changes */}
            {showChanges &&
              priceChanges.map(change => {
                const name = change.service.merchant || change.service.description;
                const increased = change.newAmount > change.previousAmount;
                return (
                  <li key={change.key} className="flex flex-wrap items-center gap-3 py-3">
                    <BrandMark name={name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="type-body-strong truncate text-ink font-semibold">{name}</span>
                        <Badge tone={increased ? 'attention' : 'positive'}>
                          {increased ? 'Price increased' : 'Price decreased'}
                        </Badge>
                      </p>
                      <p className="type-caption truncate text-muted mt-0.5">
                        Was <Amount value={change.previousAmount} currency={change.service.currency} /> · paid{' '}
                        <Amount value={change.newAmount} currency={change.service.currency} /> on {shortDay(change.date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onPress={() => onDismiss(change.key)}>
                        Dismiss
                      </Button>
                      <Button variant="secondary" size="sm" onPress={() => onUpdatePrice(change)}>
                        Update amount
                      </Button>
                    </div>
                  </li>
                );
              })}

            {/* 2. Detected Subscriptions */}
            {showDetected &&
              detected.map(candidate => (
                <li key={candidate.key} className="flex flex-wrap items-center gap-3 py-3">
                  <BrandMark name={candidate.merchant} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="type-body-strong truncate text-ink font-semibold">{candidate.merchant}</span>
                      <Badge tone={candidate.confidence === 'high' ? 'positive' : 'attention'}>
                        {candidate.confidence === 'high' ? 'Likely subscription' : 'Possible subscription'}
                      </Badge>
                    </p>
                    <p className="type-caption truncate text-muted mt-0.5">
                      {FREQUENCY_LABEL[candidate.frequency]}, {candidate.occurrences} payments, last {shortDay(candidate.lastDate)}
                    </p>
                  </div>
                  <span className="type-figure-row shrink-0 text-ink font-semibold">
                    <Amount value={candidate.amount} currency={candidate.currency} />
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onPress={() => onDismiss(candidate.key)}>
                      Ignore
                    </Button>
                    <Button variant="secondary" size="sm" onPress={() => onTrack(candidate)}>
                      Track service
                    </Button>
                  </div>
                </li>
              ))}

            {/* 3. Audit Findings */}
            {showAudit &&
              audit.findings.map(finding => (
                <li key={finding.key} className="flex flex-wrap items-center gap-3 py-3">
                  <BrandMark name={nameOf(finding.service)} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="type-body-strong text-ink font-semibold">{finding.title}</span>
                      <Badge tone={KIND[finding.kind].tone} icon={KIND[finding.kind].icon}>
                        {KIND[finding.kind].label}
                      </Badge>
                    </p>
                    <p className="type-caption mt-0.5 text-muted">
                      {finding.detail.map((part, index) =>
                        typeof part === 'string' ? (
                          <React.Fragment key={index}>{part}</React.Fragment>
                        ) : (
                          <Amount key={index} value={part.amount} currency={part.currency} />
                        )
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button variant="ghost" size="sm" onPress={() => onDismiss(finding.key)}>
                      Dismiss
                    </Button>
                    {auditActions(finding)}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default SubscriptionInsightsHub;

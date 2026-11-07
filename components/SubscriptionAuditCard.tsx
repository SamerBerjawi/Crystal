import React from 'react';
import type { RecurringTransaction } from '../types';
import { getMainCurrency } from '../utils';
import type { AuditFinding, AuditKind, SubscriptionAudit } from '../utils/subscriptionAudit';
import { BrandMark } from './ServiceCard';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';

const KIND: Record<AuditKind, { label: string; tone: 'attention' | 'blue' | 'tomato' | 'teal'; icon: string }> = {
  creep: { label: 'Price creep', tone: 'attention', icon: 'chart-increase' },
  stale: { label: 'No recent charge', tone: 'blue', icon: 'clock-01' },
  trial: { label: 'Trial ending', tone: 'tomato', icon: 'alert-circle' },
  overlap: { label: 'Overlap', tone: 'teal', icon: 'layers-01' },
};

const nameOf = (service: RecurringTransaction) => service.merchant || service.description;

interface SubscriptionAuditCardProps {
  audit: SubscriptionAudit;
  onOpen: (service: RecurringTransaction) => void;
  onPause: (service: RecurringTransaction) => void;
  onCancel: (service: RecurringTransaction) => void;
  onDismiss: (key: string) => void;
}

/** What the services cost, and the few that are worth a second look. Nothing here changes anything with a provider. */
const SubscriptionAuditCard: React.FC<SubscriptionAuditCardProps> = ({ audit, onOpen, onPause, onCancel, onDismiss }) => {
  const currency = getMainCurrency();
  const actions = (finding: AuditFinding) => {
    const { service } = finding;
    switch (finding.kind) {
      case 'creep': return <Button variant="secondary" size="sm" onPress={() => onOpen(service)}>Review</Button>;
      case 'stale': return (<>
        <Button variant="secondary" size="sm" onPress={() => onPause(service)}>Pause</Button>
        <Button variant="secondary" size="sm" onPress={() => onCancel(service)}>Mark cancelled</Button>
      </>);
      case 'trial': return <Button variant="secondary" size="sm" onPress={() => onCancel(service)}>Mark cancelled</Button>;
      case 'overlap': return <Button variant="secondary" size="sm" onPress={() => onOpen(finding.services[finding.services.length - 1])}>Review cheapest</Button>;
    }
  };

  return (
    <section aria-label="Subscription audit" className="surface-card rounded-[var(--radius-xl)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="type-card-title text-ink">Audit</h2>
        {audit.potentialSaving > 0 && (
          <p className="type-caption text-muted">Up to <Amount value={audit.potentialSaving} currency={currency} className="text-ink" /> a year could be saved</p>
        )}
      </div>
      <p className="type-body mt-1 text-muted">
        Your active services cost <Amount value={audit.yearlyCost} currency={currency} className="text-ink" /> a year
        {audit.incomeShare !== undefined && <>, {audit.incomeShare >= 0.1 ? Math.round(audit.incomeShare * 100) : (audit.incomeShare * 100).toFixed(1)}% of what you earned in the last 12 months</>}.
      </p>

      {audit.priciest.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Biggest costs">
          {audit.priciest.map(({ service, yearly }) => (
            <li key={service.id} className="inline-flex items-center gap-2 rounded-full bg-inset px-3 py-1.5">
              <span className="type-caption text-ink">{nameOf(service)}</span>
              <Amount value={yearly} currency={currency} className="type-caption text-muted" />
            </li>
          ))}
        </ul>
      )}

      {audit.findings.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {audit.findings.map(finding => (
            <li key={finding.key} className="flex flex-wrap items-center gap-3 py-3">
              <BrandMark name={nameOf(finding.service)} />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="type-body-strong text-ink">{finding.title}</span>
                  <Badge tone={KIND[finding.kind].tone} icon={KIND[finding.kind].icon}>{KIND[finding.kind].label}</Badge>
                </p>
                <p className="type-caption mt-0.5 text-muted">
                  {finding.detail.map((part, index) => typeof part === 'string'
                    ? <React.Fragment key={index}>{part}</React.Fragment>
                    : <Amount key={index} value={part.amount} currency={part.currency} />)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button variant="ghost" size="sm" onPress={() => onDismiss(finding.key)}>Dismiss</Button>
                {actions(finding)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-caption mt-3 text-muted">Nothing stands out: no price creep, quiet services, doubled-up subscriptions or trials about to end.</p>
      )}
    </section>
  );
};

export default SubscriptionAuditCard;

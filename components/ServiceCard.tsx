import React, { useState } from 'react';
import type { RecurringTransaction } from '../types';
import { parseLocalDate } from '../utils';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { cadenceLabel } from '../utils/scheduleModel';
import type { ServiceStatus } from '../utils/subscriptionsModel';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';

const FREQUENCY_SUFFIX: Record<string, string> = { daily: '/day', weekly: '/week', biweekly: '/2 weeks', monthly: '/month', yearly: '/year' };
const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** The merchant's logo, or its first letter. */
export const BrandMark: React.FC<{ name: string; fallback?: string }> = ({ name }) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const [hasFailed, setFailed] = useState(false);
  const logo = getMerchantLogoUrl(name, brandfetchClientId, logoOverrides, { fallback: 'lettermark', type: 'icon', width: 96, height: 96 });
  return (
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-inset text-[.9375rem] font-bold text-ink">
      {logo && !hasFailed ? <img src={logo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" /> : name.charAt(0).toUpperCase()}
    </span>
  );
};

interface ServiceCardProps {
  service: RecurringTransaction;
  status: ServiceStatus;
  accountName?: string;
  /** Next payment. */
  nextDate?: string;
  onEdit: () => void;
  actions: MenuAction[];
}

/** A service as Tilvo shows it: what it costs, when it renews, and what pays for it (D-028). */
const ServiceCard: React.FC<ServiceCardProps> = ({ service, status, accountName, nextDate, onEdit, actions }) => {
  const name = service.merchant || service.description;
  return (
    <article className="surface-card relative flex h-full flex-col gap-3 rounded-[var(--radius-xl)] p-5">
      <header className="flex items-start gap-3">
        <BrandMark name={name} />
        <div className="min-w-0 flex-1">
          <h3 className="type-body-strong truncate text-ink">
            <button type="button" onClick={onEdit} className="cursor-pointer text-left after:absolute after:inset-0">{name}</button>
          </h3>
          <p className="type-caption truncate text-muted">{service.category || cadenceLabel(service)}</p>
        </div>
        <span className="relative z-10 -mr-2 -mt-2"><Menu title={name} trigger={<IconButton icon="more_horiz" label={`Actions for ${name}`} tooltipPlacement="left" />} items={actions} /></span>
      </header>
      <p className="type-figure-lg text-ink">
        <Amount value={Math.abs(service.amount)} currency={service.currency} />
        <span className="type-caption text-muted"> {FREQUENCY_SUFFIX[service.frequency] ?? ''}</span>
      </p>
      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2">
        {status === 'active' ? (
          <span className="type-caption truncate text-muted">{nextDate ? `Next ${shortDay(nextDate)}` : 'No next date'}</span>
        ) : (
          <Badge tone={status === 'paused' ? 'attention' : 'neutral'}>{status === 'paused' ? `Paused ${service.pausedAt ? shortDay(service.pausedAt) : ''}` : `Ended ${service.endDate ? shortDay(service.endDate) : ''}`}</Badge>
        )}
        {accountName && <span className="type-caption truncate text-muted">{accountName}</span>}
      </footer>
    </article>
  );
};

export default ServiceCard;

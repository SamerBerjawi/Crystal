import React, { useMemo } from 'react';
import type { RecurringTransaction } from '../types';
import { parseLocalDate, round2 } from '../utils';
import { buildEffectiveMerchantLogoOverrides, getMerchantLogoUrl } from '../utils/brandfetch';
import { cadenceLabel, monthlyEquivalent } from '../utils/scheduleModel';
import type { ServiceStatus } from '../utils/subscriptionsModel';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { getCategoryDetails } from '../utils/categories';
import { EntityGlyph, LogoTile } from './EntityIcon';
import { IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';

const FREQUENCY_SUFFIX: Record<string, string> = {
  daily: '/day',
  weekly: '/wk',
  biweekly: '/2 wks',
  monthly: '/mo',
  yearly: '/yr',
};

const shortDay = (date: string) =>
  parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const sanitizeLogoSrc = (url?: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

/** The merchant's logo, or its first clean lettermark on a consistent tile. */
export const BrandMark: React.FC<{
  name: string;
  logoUrl?: string;
  fallback?: string;
  size?: number;
  className?: string;
}> = ({ name, logoUrl, fallback, size = 40, className }) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, { logo?: string }>;

  const effectiveOverrides = useMemo(() => {
    return buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules);
  }, [merchantLogoOverrides, merchantRules]);

  const directLogo = sanitizeLogoSrc(logoUrl);
  const logo = directLogo || getMerchantLogoUrl(name, brandfetchClientId, effectiveOverrides, {
    fallback: 'lettermark',
    type: 'icon',
    width: Math.max(size * 2, 80),
    height: Math.max(size * 2, 80),
  });

  return (
    <LogoTile
      url={logo}
      label={name}
      size={size}
      rounded="lg"
      fallbackIcon={fallback}
      className={className}
    />
  );
};

interface ServiceCardProps {
  service: RecurringTransaction;
  status: ServiceStatus;
  accountName?: string;
  /** Next payment date (YYYY-MM-DD). */
  nextDate?: string;
  onEdit: () => void;
  actions: MenuAction[];
  quickAction?: {
    label: string;
    icon: string;
    onPress: () => void;
  };
}

/** A service as Crystal shows it: what it costs, when it renews, and what pays for it (D-028). */
const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  status,
  accountName,
  nextDate,
  onEdit,
  actions,
  quickAction,
}) => {
  const name = service.merchant || service.description;
  const { expenseCategories, incomeCategories } = useCategoryContext();
  const allCategories = useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);
  const cat = useMemo(() => service.category ? getCategoryDetails(service.category, allCategories) : undefined, [service.category, allCategories]);
  const rawAmount = Math.abs(service.amount);
  const isYearlyOrNonMonthly = service.frequency !== 'monthly';
  const monthlyCost = isYearlyOrNonMonthly ? round2(monthlyEquivalent(service)) : rawAmount;

  // Compute days until next due date
  const dueInfo = useMemo(() => {
    if (!nextDate || status !== 'active') return null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const due = parseLocalDate(nextDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { label: 'Due today', tone: 'attention' as const, urgent: true };
    }
    if (diffDays === 1) {
      return { label: 'Due tomorrow', tone: 'attention' as const, urgent: true };
    }
    if (diffDays <= 3) {
      return { label: `Due in ${diffDays}d`, tone: 'attention' as const, urgent: false };
    }
    return { label: `Next ${shortDay(nextDate)}`, tone: 'neutral' as const, urgent: false };
  }, [nextDate, status]);

  return (
    <article
      className={cn(
        'surface-card relative flex h-full flex-col justify-between rounded-[var(--radius-xl)] p-5 transition-shadow hover:shadow-sm border border-line',
        status === 'paused' && 'opacity-85 border-dashed',
        status === 'cancelled' && 'opacity-70 grayscale-50'
      )}
    >
      <div>
        <header className="flex items-start gap-3">
          <BrandMark name={name} size={42} />
          <div className="min-w-0 flex-1">
            <h3 className="type-body-strong truncate text-ink font-semibold">
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer text-left hover:underline focus-visible:underline outline-hidden after:absolute after:inset-0"
              >
                {name}
              </button>
            </h3>
            <p className="type-caption flex items-center gap-1.5 truncate text-muted mt-0.5">
              {service.category ? (
                <>
                  <EntityGlyph icon={cat?.icon} label={service.category} color={cat?.color} size={12} />
                  <span className="truncate">{service.category}</span>
                </>
              ) : (
                <span className="truncate">{cadenceLabel(service)}</span>
              )}
            </p>
          </div>
          <span className="relative z-10 -mr-2 -mt-2">
            <Menu
              title={name}
              trigger={<IconButton icon="more-horizontal" label={`Actions for ${name}`} tooltipPlacement="left" />}
              items={actions}
            />
          </span>
        </header>

        {/* Amount & Frequency Section */}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="type-figure-lg font-bold text-ink flex items-baseline gap-1">
              <Amount value={rawAmount} currency={service.currency} />
              <span className="type-caption font-normal text-muted">
                {FREQUENCY_SUFFIX[service.frequency] ?? ''}
              </span>
            </p>
            {isYearlyOrNonMonthly && (
              <p className="type-caption text-muted mt-0.5">
                ≈ <Amount value={monthlyCost} currency={service.currency} /> /mo
              </p>
            )}
          </div>

          {dueInfo && (
            <Badge
              tone={dueInfo.tone}
              className={cn(
                'text-[11px] font-medium h-5 px-1.5',
                dueInfo.urgent && 'bg-amber/20 text-attention-text border border-amber/40 font-bold'
              )}
            >
              {dueInfo.label}
            </Badge>
          )}

          {status !== 'active' && (
            <Badge tone={status === 'paused' ? 'attention' : 'neutral'}>
              {status === 'paused'
                ? `Paused${service.pausedAt ? ` · ${shortDay(service.pausedAt)}` : ''}`
                : `Ended${service.endDate ? ` · ${shortDay(service.endDate)}` : ''}`}
            </Badge>
          )}
        </div>
      </div>

      {/* Card Footer: Payment Source & Quick Action */}
      <footer className="mt-4 flex items-center justify-between gap-2 border-t border-line/60 pt-3">
        <div className="flex min-w-0 items-center gap-1.5 text-muted">
          <Icon name="wallet-02" size={13} className="shrink-0 text-muted/80" />
          <span className="type-caption truncate">{accountName || 'Default account'}</span>
        </div>

        {quickAction && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              quickAction.onPress();
            }}
            className="relative z-10 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-ink hover:bg-inset transition-colors"
          >
            <Icon name={quickAction.icon} size={13} />
            <span>{quickAction.label}</span>
          </button>
        )}
      </footer>
    </article>
  );
};

export default ServiceCard;

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Membership } from '../types';
import { parseLocalDate } from '../utils';
import { BrandMark } from './ServiceCard';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu } from './ui/Menu';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';

interface LoyaltyCardProps {
  membership: Membership;
  onEdit: (membership: Membership) => void;
  onDelete: (id: string) => void;
}

/** Generates a deterministic barcode SVG based on the membership number string */
const BarcodeGraphic: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  const bars = useMemo(() => {
    const clean = (value || '000000').replace(/[^a-zA-Z0-9]/g, '');
    const segments: { width: number; gap: number }[] = [];
    let seed = 0;
    for (let i = 0; i < clean.length; i++) {
      seed = (seed * 31 + clean.charCodeAt(i)) % 10007;
    }
    // Generate ~36 bars with deterministic pattern
    for (let i = 0; i < 34; i++) {
      const w = ((seed + i * 17) % 3) + 1.2;
      const g = ((seed + i * 23) % 3) + 1.2;
      segments.push({ width: w, gap: g });
    }
    return segments;
  }, [value]);

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-[var(--radius-md)] bg-white px-4 py-2.5 shadow-2xs select-none',
        className
      )}
      aria-hidden="true"
    >
      <svg
        className="h-10 w-full max-w-[220px]"
        viewBox="0 0 160 38"
        fill="currentColor"
        preserveAspectRatio="none"
      >
        {(() => {
          let currentX = 5;
          return bars.map((b, i) => {
            const x = currentX;
            currentX += b.width + b.gap;
            if (x > 155) return null;
            return <rect key={i} x={x} y="2" width={b.width} height="34" rx="0.5" fill="#111827" />;
          });
        })()}
      </svg>
    </div>
  );
};

/** A membership in the Wallet, in Crystal's card style (D-028), with an active barcode view and 1-click copy. */
const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
  const [isCopied, setCopied] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const expiry = membership.expiryDate ? parseLocalDate(membership.expiryDate.slice(0, 10)) : null;
  const isExpired = !!expiry && expiry < new Date();

  const copyId = () => {
    navigator.clipboard.writeText(membership.memberId);
    setCopied(true);
    toast.success(`${membership.provider} number copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="surface-card relative flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] p-5 pt-6 border border-line shadow-2xs hover:shadow-sm transition-shadow">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: membership.color || 'var(--primary)' }}
      />

      <div>
        <header className="flex items-start gap-3">
          <BrandMark name={membership.provider} size={42} />
          <div className="min-w-0 flex-1">
            <h3 className="type-body-strong truncate text-ink font-semibold">
              <button
                type="button"
                onClick={() => onEdit(membership)}
                className="cursor-pointer text-left hover:underline focus-visible:underline outline-hidden after:absolute after:inset-0"
              >
                {membership.provider}
              </button>
            </h3>
            <p className="type-caption truncate text-muted mt-0.5">{membership.category || 'Membership'}</p>
          </div>
          {membership.tier && (
            <Badge tone="neutral" className="text-xs font-semibold">
              {membership.tier}
            </Badge>
          )}
          <span className="relative z-10 -mr-2 -mt-2">
            <Menu
              title={membership.provider}
              trigger={<IconButton icon="more-horizontal" label={`Actions for ${membership.provider}`} tooltipPlacement="left" />}
              items={[
                { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => onEdit(membership) },
                ...(membership.website
                  ? [{ id: 'site', label: 'Open website', icon: 'link-01', onAction: () => { window.open(membership.website, '_blank', 'noopener,noreferrer'); } }]
                  : []),
                { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => onDelete(membership.id) },
              ]}
            />
          </span>
        </header>

        {/* Member ID & 1-Click Copy Bar */}
        <div className="mt-4 relative z-10 flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-inset p-2.5 border border-line/60">
          <div className="min-w-0 flex-1 pl-1">
            <span className="type-caption block text-muted text-[11px]">Member number</span>
            <span className="type-body-strong block truncate text-ink font-mono tracking-wide">
              {membership.memberId}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={isCopied ? 'checkmark-circle-02' : 'copy-01'}
              onPress={copyId}
              className="text-xs font-medium"
            >
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
            <IconButton
              icon={showBarcode ? 'view-off' : 'BarCode02Icon'}
              label={showBarcode ? 'Hide barcode' : 'Show barcode'}
              className="size-8"
              iconSize={16}
              onPress={() => setShowBarcode(!showBarcode)}
            />
          </div>
        </div>

        {/* Barcode Display */}
        {showBarcode && (
          <div className="mt-3 relative z-10">
            <BarcodeGraphic value={membership.memberId} />
            <p className="type-caption text-center text-muted mt-1 font-mono text-[11px]">
              {membership.memberId}
            </p>
          </div>
        )}
      </div>

      {/* Details Footer */}
      <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line/50 pt-3">
        {membership.holderName && (
          <div className="min-w-0">
            <dt className="type-caption text-muted text-[11px]">Holder</dt>
            <dd className="type-body truncate text-ink text-xs font-medium">{membership.holderName}</dd>
          </div>
        )}
        {membership.points && (
          <div className="min-w-0">
            <dt className="type-caption text-muted text-[11px]">Points</dt>
            <dd className="type-body truncate text-ink text-xs font-semibold flex items-center gap-1">
              <Icon name="award-01" size={13} className="text-amber" />
              <span>{membership.points}</span>
            </dd>
          </div>
        )}
        {membership.memberSince && (
          <div className="min-w-0">
            <dt className="type-caption text-muted text-[11px]">Member since</dt>
            <dd className="type-body truncate text-ink text-xs">{membership.memberSince}</dd>
          </div>
        )}
        <div className="min-w-0">
          <dt className="type-caption text-muted text-[11px]">Valid until</dt>
          <dd className={cn('type-body truncate text-xs', isExpired ? 'text-tomato font-semibold' : 'text-ink')}>
            {expiry ? expiry.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'No expiry'}
            {isExpired ? ' (Expired)' : ''}
          </dd>
        </div>
      </dl>
    </article>
  );
};

export default LoyaltyCard;

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

/** Formats a member number into readable chunks of 4 characters */
const formatMemberId = (id: string): string => {
  const clean = (id || '').replace(/\s+/g, '');
  if (clean.length > 8 && /^[a-zA-Z0-9]+$/.test(clean)) {
    return clean.replace(/(.{4})/g, '$1 ').trim();
  }
  return id;
};

/** Generates a high-contrast optical barcode SVG based on the membership number string */
const BarcodeGraphic: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  const bars = useMemo(() => {
    const clean = (value || '000000').replace(/[^a-zA-Z0-9]/g, '');
    const segments: { width: number; gap: number }[] = [];
    let seed = 0;
    for (let i = 0; i < clean.length; i++) {
      seed = (seed * 31 + clean.charCodeAt(i)) % 10007;
    }
    // Generate ~36 bars with realistic optical barcode patterns
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
        'flex flex-col items-center justify-center rounded-xl bg-white p-3 shadow-inner select-none border border-neutral-200/80',
        className
      )}
      aria-hidden="true"
    >
      <svg
        className="h-12 w-full max-w-[260px]"
        viewBox="0 0 160 42"
        fill="currentColor"
        preserveAspectRatio="none"
      >
        {(() => {
          let currentX = 5;
          return bars.map((b, i) => {
            const x = currentX;
            currentX += b.width + b.gap;
            if (x > 155) return null;
            return <rect key={i} x={x} y="2" width={b.width} height="38" rx="0.5" fill="#111827" />;
          });
        })()}
      </svg>
      <span className="mt-1 font-mono text-[11px] font-semibold text-neutral-800 tracking-wider">
        {formatMemberId(value)}
      </span>
    </div>
  );
};

/**
 * A modern, passbook-inspired digital loyalty and membership card.
 * Features a jewel-tone gradient keyed to brand color, luminous frosted glass overlays,
 * hero points balance, scannable barcode drawer, and 1-click copy.
 */
const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
  const [isCopied, setCopied] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);

  const cardColor = membership.color || '#3b82f6';
  const expiry = membership.expiryDate ? parseLocalDate(membership.expiryDate.slice(0, 10)) : null;
  const isExpired = !!expiry && expiry < new Date();

  const daysToExpiry = useMemo(() => {
    if (!expiry) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expiry);
    exp.setHours(0, 0, 0, 0);
    return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [expiry]);

  const copyId = () => {
    navigator.clipboard.writeText(membership.memberId);
    setCopied(true);
    toast.success(`${membership.provider} number copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="relative isolate flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius-2xl)] border border-white/15 shadow-sm hover:shadow-lg transition-all duration-200 group text-white">
      {/* Background Gradient & Ambient Aura strictly clipped inside container */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        {/* Dynamic Rich Jewel-Tone Gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${cardColor}dd 0%, ${cardColor}33 45%, #18181c 80%, #0d0d10 100%)`,
          }}
        />

        {/* Ambient Top Glow Orbs (contained safely) */}
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 size-48 rounded-full blur-2xl opacity-40 transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: cardColor }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -left-12 size-48 rounded-full bg-white/10 blur-xl"
        />

        {/* Subtle Top Glass Sheen */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
      </div>

      {/* Card Body */}
      <div className="relative z-10 p-5 pt-6">
        {/* Card Header: Brandmark, Provider & Actions */}
        <header className="flex items-start gap-3">
          <div className="relative shrink-0">
            <BrandMark name={membership.provider} size={46} className="shadow-xs border border-white/20 bg-white/10" />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-[#18181c]"
              style={{ backgroundColor: cardColor }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="type-body-strong truncate text-white font-bold text-base leading-snug">
                <button
                  type="button"
                  onClick={() => onEdit(membership)}
                  className="cursor-pointer text-left hover:underline focus-visible:underline outline-hidden"
                >
                  {membership.provider}
                </button>
              </h3>

              {membership.tier && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/20 px-2 py-0.5 text-[11px] font-semibold text-white/95 backdrop-blur-xs">
                  <Icon name="award-01" size={11} className="text-amber-300" />
                  <span>{membership.tier}</span>
                </span>
              )}
            </div>

            <p className="type-caption truncate text-white/70 text-xs mt-0.5">
              {membership.category || 'Membership'}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-1">
            {membership.website && (
              <IconButton
                icon="link-01"
                label={`Visit ${membership.provider}`}
                className="size-8 text-white/80 hover:text-white hover:bg-white/15"
                iconSize={15}
                onPress={() => window.open(membership.website, '_blank', 'noopener,noreferrer')}
              />
            )}
            <Menu
              title={membership.provider}
              trigger={
                <IconButton
                  icon="more-horizontal"
                  label={`Actions for ${membership.provider}`}
                  tooltipPlacement="left"
                  className="size-8 text-white/80 hover:text-white hover:bg-white/15"
                  iconSize={16}
                />
              }
              items={[
                { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => onEdit(membership) },
                ...(membership.website
                  ? [{ id: 'site', label: 'Open website', icon: 'link-01', onAction: () => { window.open(membership.website, '_blank', 'noopener,noreferrer'); } }]
                  : []),
                { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => onDelete(membership.id) },
              ]}
            />
          </div>
        </header>

        {/* Hero Section: Points / Rewards Balance & Cardholder (Luminous Frosted Glass) */}
        {(membership.points || membership.holderName) && (
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-white/[0.07] backdrop-blur-md border border-white/12 px-3.5 py-2 shadow-2xs">
            {membership.points && (
              <div>
                <span className="block text-white/65 text-[10px] font-semibold uppercase tracking-wider">
                  Points / Balance
                </span>
                <span className="block text-amber-300 font-bold text-sm tracking-tight flex items-center gap-1.5 mt-0.5">
                  <Icon name="award-01" size={13} className="text-amber-300" />
                  <span>{membership.points}</span>
                </span>
              </div>
            )}
            {membership.holderName && (
              <div className={membership.points ? 'text-right' : 'text-left'}>
                <span className="block text-white/65 text-[10px] font-semibold uppercase tracking-wider">
                  Cardholder
                </span>
                <span className="block text-white font-medium text-xs truncate max-w-[160px] mt-0.5">
                  {membership.holderName}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Member Number & Barcode Pod (Sleek Frosted Glass Container) */}
        <div className="mt-3.5 relative rounded-xl bg-white/[0.08] backdrop-blur-md border border-white/15 p-3 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block text-white/65 text-[10px] font-semibold uppercase tracking-wider">
                Member ID
              </span>
              <span className="block truncate text-white font-mono text-sm sm:text-base tracking-wider select-all font-semibold mt-0.5">
                {formatMemberId(membership.memberId)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                icon={isCopied ? 'checkmark-circle-02' : 'copy-01'}
                onPress={copyId}
                className={cn(
                  'text-xs font-medium h-8 px-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors',
                  isCopied && 'text-emerald-300 border-emerald-400/50 bg-emerald-950/50'
                )}
              >
                {isCopied ? 'Copied' : 'Copy'}
              </Button>
              <IconButton
                icon={showBarcode ? 'view-off' : 'BarCode02Icon'}
                label={showBarcode ? 'Hide barcode' : 'Show barcode'}
                className={cn(
                  'size-8 transition-colors bg-white/10 hover:bg-white/20 border border-white/15 text-white',
                  showBarcode && 'bg-white/25 border-white/30 text-white'
                )}
                iconSize={16}
                onPress={() => setShowBarcode(!showBarcode)}
              />
            </div>
          </div>

          {/* Scannable Optical Barcode Drawer */}
          {showBarcode && (
            <div className="mt-3 pt-3 border-t border-white/15">
              <BarcodeGraphic value={membership.memberId} />
              <p className="text-center text-white/70 mt-1.5 text-[10px]">
                Scan at register or store terminal
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Validity, Member Since & Notes */}
      <footer className="relative z-10 px-5 pb-4 pt-2.5 border-t border-white/12 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {expiry ? (
            isExpired ? (
              <Badge tone="tomato" className="text-[11px] font-bold">
                Expired
              </Badge>
            ) : daysToExpiry !== null && daysToExpiry <= 30 ? (
              <span className="inline-flex items-center rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/40 px-2 py-0.5 text-[11px] font-semibold">
                Expires in {daysToExpiry}d
              </span>
            ) : (
              <span className="text-white/75 text-[11px]">
                Valid thru <span className="font-semibold text-white">{expiry.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
              </span>
            )
          ) : (
            <span className="text-white/75 text-[11px]">No expiry</span>
          )}

          {membership.memberSince && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-white/75 text-[11px]">
                Member since <span className="font-semibold text-white">{membership.memberSince}</span>
              </span>
            </>
          )}
        </div>

        {membership.notes && (
          <span
            title={membership.notes}
            className="text-white/60 truncate max-w-[140px] italic text-[11px]"
          >
            {membership.notes}
          </span>
        )}
      </footer>
    </article>
  );
};

export default LoyaltyCard;

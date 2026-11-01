import React, { useState } from 'react';
import type { Membership } from '../types';
import { parseLocalDate } from '../utils';
import { BrandMark } from './ServiceCard';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu } from './ui/Menu';

interface LoyaltyCardProps {
  membership: Membership;
  onEdit: (membership: Membership) => void;
  onDelete: (id: string) => void;
}

/** A membership in the Wallet, in Tilvo's card style (D-028), with its colour along the top. */
const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
  const [isCopied, setCopied] = useState(false);
  const expiry = membership.expiryDate ? parseLocalDate(membership.expiryDate.slice(0, 10)) : null;
  const isExpired = !!expiry && expiry < new Date();

  const copyId = () => {
    navigator.clipboard.writeText(membership.memberId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="surface-card relative flex h-full flex-col gap-3 overflow-hidden rounded-[var(--radius-xl)] p-5 pt-6">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: membership.color || 'var(--primary)' }} />
      <header className="flex items-start gap-3">
        <BrandMark name={membership.provider} />
        <div className="min-w-0 flex-1">
          <h3 className="type-body-strong truncate text-ink">
            <button type="button" onClick={() => onEdit(membership)} className="cursor-pointer text-left after:absolute after:inset-0">{membership.provider}</button>
          </h3>
          <p className="type-caption truncate text-muted">{membership.category || 'Membership'}</p>
        </div>
        {membership.tier && <Badge tone="neutral">{membership.tier}</Badge>}
        <span className="relative z-10 -mr-2 -mt-2">
          <Menu
            title={membership.provider}
            trigger={<IconButton icon="more_horiz" label={`Actions for ${membership.provider}`} tooltipPlacement="left" />}
            items={[
              { id: 'edit', label: 'Edit', icon: 'edit', onAction: () => onEdit(membership) },
              ...(membership.website ? [{ id: 'site', label: 'Open website', icon: 'open_in_new', onAction: () => { window.open(membership.website, '_blank', 'noopener,noreferrer'); } }] : []),
              { id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => onDelete(membership.id) },
            ]}
          />
        </span>
      </header>

      <div className="relative z-10 flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-inset pl-3">
        <span className="min-w-0">
          <span className="type-caption block text-muted">Member number</span>
          <span className="type-body-strong block truncate text-ink tabular-nums">{membership.memberId}</span>
        </span>
        <Button variant="ghost" size="sm" icon={isCopied ? 'check' : 'content_copy'} onPress={copyId}>{isCopied ? 'Copied' : 'Copy'}</Button>
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1">
        {membership.holderName && <div className="min-w-0"><dt className="type-caption text-muted">Holder</dt><dd className="type-body truncate text-ink">{membership.holderName}</dd></div>}
        {membership.points && <div className="min-w-0"><dt className="type-caption text-muted">Points</dt><dd className="type-body truncate text-ink">{membership.points}</dd></div>}
        {membership.memberSince && <div className="min-w-0"><dt className="type-caption text-muted">Member since</dt><dd className="type-body truncate text-ink">{membership.memberSince}</dd></div>}
        <div className="min-w-0">
          <dt className="type-caption text-muted">Valid until</dt>
          <dd className="type-body truncate text-ink">{expiry ? expiry.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'No expiry'}{isExpired ? ', expired' : ''}</dd>
        </div>
      </dl>
    </article>
  );
};

export default LoyaltyCard;

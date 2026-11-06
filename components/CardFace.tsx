import React, { useState } from 'react';
import type { Account } from '../types';
import { accountCardKind } from '../utils/accountsModel';
import { heroClassFor } from '../utils/accountHero';
import { cardLook, cardStyleOf, patternStyle, type CardStyleChoice } from '../utils/cardStyle';
import { useAccountLogo } from './useAccountLogo';
import CardNetworkMark from './CardNetworkMark';
import { CardChip, ContactlessIcon } from './CardChip';
import { cn } from '../lib/utils';

interface CardFaceProps {
  account: Account;
  /** Show this look instead of the one saved on the account, for a live preview. */
  override?: CardStyleChoice;
  className?: string;
  /** A thumbnail: just the colour, pattern and chip, with no text. */
  mini?: boolean;
}

/** The bank's logo on a small white tile, or its first letter when there is none to show. */
const BankMark: React.FC<{ account: Account }> = ({ account }) => {
  const url = useAccountLogo(account, 48);
  const [failed, setFailed] = useState(false);
  const name = account.financialInstitution || account.name;
  return (
    <span aria-hidden className="flex size-[9cqw] min-h-[22px] min-w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[2cqw] bg-white/95 text-[4.4cqw] font-bold text-[#1B1813] shadow-sm">
      {url && !failed
        ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
        : (name.trim()[0] || '?').toUpperCase()}
    </span>
  );
};

/**
 * One card, drawn from what the account stores, in the colour and pattern its owner chose. Only the last four digits.
 * Everything inside is sized from the card's own width, so it keeps its proportions at any size.
 */
const CardFace: React.FC<CardFaceProps> = ({ account, override, className, mini }) => {
  const choice = override ?? cardStyleOf(account);
  const look = cardLook(choice);
  const tone = look?.tone ?? 'dark';
  return (
    <div className="size-full [container-type:inline-size]">
      <div
        className={cn('relative flex size-full flex-col justify-between overflow-hidden rounded-[5cqw] p-[5.5cqw] shadow-lg', look ? (tone === 'light' ? 'text-[#1B1813]' : 'text-[#FFFDF8]') : cn('text-on-pine', heroClassFor(account.type)), account.status === 'closed' && 'opacity-60', className)}
        style={look ? { background: look.background } : undefined}
      >
        <span aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent', tone === 'light' ? 'from-white/40 to-black/5' : 'from-white/20 to-black/15')} />
        <span aria-hidden className="pointer-events-none absolute inset-0" style={patternStyle(choice.pattern, tone)} />

        {mini ? (
          <CardChip className="relative h-[14cqw] self-start" />
        ) : (<>
        <div className="relative flex items-center justify-between gap-[3cqw]">
          <span className="flex min-w-0 items-center gap-[2.5cqw]">
            <BankMark account={account} />
            <span className="truncate text-[clamp(10px,4.6cqw,15px)] font-semibold leading-tight">{account.financialInstitution || account.name}</span>
          </span>
          <span className="shrink-0 text-[clamp(8px,3.2cqw,11px)] font-semibold uppercase tracking-wider opacity-80">{account.status === 'closed' ? 'Closed' : accountCardKind(account)}</span>
        </div>

        <div className="relative flex items-center justify-between gap-[3cqw]">
          <CardChip className="h-[10.5cqw] drop-shadow-sm" />
          <ContactlessIcon className="h-[8.5cqw] opacity-85" />
        </div>

        <div className="relative">
          <p className="text-[clamp(13px,7.4cqw,24px)] font-medium tabular-nums leading-none tracking-[0.18em]" aria-label={account.last4 ? `Ending ${account.last4}` : undefined}>
            •••• {account.last4 || '••••'}
          </p>
          <div className="mt-[2.5cqw] flex items-end justify-between gap-[3cqw]">
            <span className="min-w-0 text-[clamp(9px,3.7cqw,13px)] leading-tight">
              <span className="block truncate">{account.cardholderName || account.name}</span>
              {account.expirationDate && <span className="block tabular-nums opacity-80">{account.expirationDate}</span>}
            </span>
            <CardNetworkMark network={account.cardNetwork} className="h-[8.5cqw] max-w-[18cqw] shrink-0 text-[clamp(9px,3.7cqw,13px)]" />
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
};

export default CardFace;

import React from 'react';
import { cn } from '../../../lib/utils';
import type { Account } from '../../../types';
import { AccountLogo } from '../EntityIcon';

/*
 * The account card drawing, shared by the quick overview sheet and the account hero.
 * One style per account type (colour, pattern, chip and contactless), and the network
 * (Visa, Mastercard, ...) as a logo instead of its name.
 */

const PAYMENT_TYPES = ['Checking', 'Savings', 'Credit Card'];
const NO_PICTURE_TYPES = PAYMENT_TYPES;

/** Accounts that are shown as a card: bank accounts and cards, or anything with card details. */
export const accountHasCard = (account: Account): boolean =>
  PAYMENT_TYPES.includes(account.type) || Boolean(account.last4 || account.cardNetwork);

/** The user's picture for an account that isn't a bank card (a car, a house). Bank accounts use it as their logo. */
export const accountPicture = (account: Account): string | null => {
  if (NO_PICTURE_TYPES.includes(account.type)) return null;
  return account.imageUrl?.trim() || null;
};

type Pattern = 'rings' | 'waves' | 'sheen' | 'grid' | 'dots';

interface CardStyle {
  from: string;
  to: string;
  pattern: Pattern;
  /** Payment cards get the chip and the contactless mark; the rest get a type label. */
  payment: boolean;
}

const STYLES: Record<string, CardStyle> = {
  Checking: { from: 'var(--nv-card-checking-from)', to: 'var(--nv-card-checking-to)', pattern: 'rings', payment: true },
  Savings: { from: 'var(--nv-card-savings-from)', to: 'var(--nv-card-savings-to)', pattern: 'waves', payment: false },
  'Credit Card': { from: 'var(--nv-card-credit-from)', to: 'var(--nv-card-credit-to)', pattern: 'sheen', payment: true },
  Investment: { from: 'var(--nv-card-invest-from)', to: 'var(--nv-card-invest-to)', pattern: 'grid', payment: false },
  'Other Assets': { from: 'var(--nv-card-cash-from)', to: 'var(--nv-card-cash-to)', pattern: 'dots', payment: false },
  Loan: { from: 'var(--nv-card-loan-from)', to: 'var(--nv-card-loan-to)', pattern: 'grid', payment: false },
  Lending: { from: 'var(--nv-card-loan-from)', to: 'var(--nv-card-loan-to)', pattern: 'waves', payment: false },
  'Other Liabilities': { from: 'var(--nv-card-other-from)', to: 'var(--nv-card-other-to)', pattern: 'dots', payment: false },
};

const FALLBACK_STYLE = STYLES.Checking;

const White = (alpha: number) => `rgb(255 255 255 / ${alpha})`;

const PatternLayer: React.FC<{ pattern: Pattern }> = ({ pattern }) => {
  switch (pattern) {
    case 'rings':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full"
          style={{ boxShadow: `0 0 0 28px ${White(0.03)}, 0 0 0 56px ${White(0.025)}` }}
        />
      );
    case 'waves':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `repeating-radial-gradient(circle at 110% 120%, ${White(0.06)} 0 1px, transparent 1px 22px)`,
          }}
        />
      );
    case 'sheen':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(115deg, transparent 38%, ${White(0.09)} 46%, transparent 54%), linear-gradient(115deg, transparent 62%, ${White(0.05)} 68%, transparent 74%)`,
          }}
        />
      );
    case 'grid':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${White(0.05)} 1px, transparent 1px), linear-gradient(90deg, ${White(0.05)} 1px, transparent 1px)`,
            backgroundSize: '26px 26px',
            maskImage: 'linear-gradient(160deg, transparent 20%, black 85%)',
            WebkitMaskImage: 'linear-gradient(160deg, transparent 20%, black 85%)',
          }}
        />
      );
    case 'dots':
    default:
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(${White(0.12)} 1.2px, transparent 1.4px)`,
            backgroundSize: '16px 16px',
            maskImage: 'linear-gradient(200deg, black 5%, transparent 65%)',
            WebkitMaskImage: 'linear-gradient(200deg, black 5%, transparent 65%)',
          }}
        />
      );
  }
};

/** Contactless mark: four arcs opening to the right. */
const Contactless: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-label="Contactless">
    <path d="M5.55 9.23A4.5 4.5 0 0 1 5.55 14.77" />
    <path d="M8.3 7.07A8 8 0 0 1 8.3 16.93" />
    <path d="M11.06 4.92A11.5 11.5 0 0 1 11.06 19.08" />
    <path d="M13.82 2.76A15 15 0 0 1 13.82 21.24" />
  </svg>
);

type Network = 'mastercard' | 'visa' | 'amex' | 'discover';

const networkOf = (network?: string): Network | null => {
  const key = (network || '').trim().toLowerCase();
  if (key.startsWith('master')) return 'mastercard';
  if (key === 'visa') return 'visa';
  if (key.startsWith('amex') || key.startsWith('american')) return 'amex';
  if (key.startsWith('discover')) return 'discover';
  return null;
};

const NetworkLogo: React.FC<{ network: Network }> = ({ network: key }) => {
  if (key === 'mastercard') {
    return (
      <svg viewBox="0 0 36 24" className="h-7 w-auto" role="img" aria-label="Mastercard">
        <circle cx="12" cy="12" r="12" fill="var(--nv-mc-red)" />
        <circle cx="24" cy="12" r="12" fill="var(--nv-mc-orange)" />
        <path d="M18 1.61A12 12 0 0 1 18 22.39A12 12 0 0 1 18 1.61Z" fill="var(--nv-mc-overlap)" />
      </svg>
    );
  }
  if (key === 'visa') {
    return (
      <svg viewBox="0 0 60 20" className="h-6 w-auto" role="img" aria-label="Visa">
        <text x="30" y="17" textAnchor="middle" fill="currentColor" fontSize="23" fontWeight="900" fontStyle="italic" letterSpacing="-1" fontFamily="Arial Black, Arial, sans-serif">
          VISA
        </text>
      </svg>
    );
  }
  if (key === 'amex') {
    return (
      <svg viewBox="0 0 56 22" className="h-6 w-auto" role="img" aria-label="American Express">
        <rect x="0.75" y="0.75" width="54.5" height="20.5" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="28" y="15.5" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="800" letterSpacing="1.2" fontFamily="Arial, sans-serif">
          AMEX
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 72 22" className="h-6 w-auto" role="img" aria-label="Discover">
      <text x="2" y="15" fill="currentColor" fontSize="11" fontWeight="800" letterSpacing="0.6" fontFamily="Arial, sans-serif">
        DISCOVER
      </text>
      <circle cx="64" cy="11" r="6" fill="var(--nv-mc-orange)" />
    </svg>
  );
};

export const AccountCard: React.FC<{ account: Account; className?: string }> = ({ account, className }) => {
  const style = STYLES[account.type] ?? FALLBACK_STYLE;
  const network = networkOf(account.cardNetwork);

  const number = account.last4
    ? `•••• •••• •••• ${account.last4}`
    : account.accountNumber
      ? `•••• ${account.accountNumber.slice(-4)}`
      : account.type.toUpperCase();

  return (
    <div
      className={cn(
        'relative aspect-[1.586] w-full max-w-[340px] overflow-hidden rounded-[22px] shadow-nv-float transition-transform duration-300 hover:scale-[1.02] [container-type:inline-size]',
        className
      )}
      style={{
        color: 'var(--nv-card-ink)',
        background: `linear-gradient(145deg, ${style.from}, ${style.to})`,
      }}
    >
      <PatternLayer pattern={style.pattern} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${White(0.35)}, transparent)` }} />

      <div className="absolute inset-0 flex flex-col justify-between gap-2 p-[6cqw]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              <AccountLogo account={account} size={36} rounded="xl" />
            </div>
            <span className="truncate text-sm font-semibold">{account.financialInstitution || account.name}</span>
          </div>
          {style.payment ? (
            <Contactless className="h-6 w-6 shrink-0 opacity-85" />
          ) : (
            <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider" style={{ background: White(0.15) }}>
              {(account.subType || account.otherSubType || account.type).toUpperCase()}
            </span>
          )}
        </div>

        {style.payment && (
          <div
            className="absolute left-[6cqw] top-[41%] h-8 w-11 rounded-md"
            style={{ background: 'linear-gradient(135deg, var(--nv-card-chip-from), var(--nv-card-chip-to))' }}
            aria-hidden
          >
            <div className="flex h-full flex-col justify-around p-1">
              <div className="h-px bg-nv-card-from/40" />
              <div className="h-px bg-nv-card-from/40" />
              <div className="h-px bg-nv-card-from/40" />
            </div>
          </div>
        )}

        <div>
          <p className="whitespace-nowrap font-mono text-[5cqw] font-semibold tracking-[0.14em]">{number}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wider opacity-80">
                <span className="truncate">{account.cardholderName || account.name}</span>
                {account.expirationDate && <span className="shrink-0 font-mono opacity-70">{account.expirationDate}</span>}
              </p>
            </div>
            {network ? (
              <div className="shrink-0">
                <NetworkLogo network={network} />
              </div>
            ) : (
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider" style={{ background: White(0.15) }}>
                {account.currency}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

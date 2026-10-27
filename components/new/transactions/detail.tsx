import React, { Suspense } from 'react';
import { cn } from '../../../lib/utils';
import { formatCurrency } from '../../../utils';
import { locationLine, type TxRow } from '../../../utils/transactionsModel';
import type { TransactionsData } from '../../../hooks/useTransactionsData';
import { EntityGlyph, LogoTile } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Bone } from '../Skeleton';
import { Money } from '../ui';
import { LazySinglePlaceMap } from './overview';
import { TxAvatar, TxBadges } from './parts';

/*
 * The transaction overview (UI_UX_DESIGN_REFERENCE.md N16): a hero that opens on the map of where it happened (or a
 * soft banner without one), the merchant, the date and the amount large and coloured by kind, the category and the
 * account as two facts, then the details as small tiles. Layout after the classic overview, in the New style: no
 * glow, no monospace, accent only on the amount and the status.
 */

const KIND_WORD = { expense: 'Expense', income: 'Income', transfer: 'Transfer' } as const;

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** A tint of `color` for a disc or pill behind a glyph. Falls back to the violet accent. */
const tint = (color?: string, pct = 16) => `color-mix(in srgb, ${color || 'var(--nv-violet)'} ${pct}%, transparent)`;

/** A section of the overview: a small muted heading over open content, in the hero's style (no boxes, no rules). */
export const Fact: React.FC<{ label: string; icon?: NvIconName; children: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ label, icon, children, action, className }) => (
  <section className={cn('min-w-0', className)}>
    <div className="mb-2 flex items-center justify-between gap-3">
      <h4 className="flex items-center gap-1.5 text-[13px] font-medium text-nv-muted">{icon && <NvIcon name={icon} size={15} aria-hidden />}{label}</h4>
      {action}
    </div>
    {children}
  </section>
);

/** An account or merchant: its logo as a small tile (like the hero's avatar) beside the name. */
const Party: React.FC<{ label: string; icon?: NvIconName; logo: React.ReactNode; name: string; hint?: string }> = ({ label, icon, logo, name, hint }) => (
  <Fact label={label} icon={icon}>
    <div className="flex min-w-0 items-center gap-3">
      {logo}
      <div className="min-w-0">
        <p className="truncate text-[16px] font-semibold text-nv-ink">{name}</p>
        {hint && <p className="truncate text-[13px] text-nv-muted">{hint}</p>}
      </div>
    </div>
  </Fact>
);

/** A soft pill like the hero's kind and category pills. */
const Pill: React.FC<{ color: string; text: string; icon?: NvIconName; children: React.ReactNode }> = ({ color, text, icon, children }) => (
  <span className="inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-medium" style={{ background: tint(color, 16), color: text }}>
    {icon && <NvIcon name={icon} size={16} className="shrink-0" />}{children}
  </span>
);

export const DetailHero: React.FC<{ row: TxRow; data: TransactionsData; isDark: boolean }> = ({ row, data, isDark }) => {
  const account = data.accountsById.get(row.accountId);
  const category = data.categoryByName.get(row.category);
  const hasMap = row.lat !== undefined && row.lng !== undefined;
  const tone = row.kind === 'income' ? 'income' : 'ink';
  const accent = row.kind === 'transfer' ? 'var(--nv-sky)' : row.kind === 'income' ? 'var(--nv-green)' : category?.color || 'var(--nv-violet)';
  return (
    <div>
      <div className="relative h-56 overflow-hidden sm:h-64" style={{ background: `linear-gradient(135deg, ${tint(accent, 34)}, ${tint(accent, 6)})` }}>
        {hasMap ? (
          <Suspense fallback={<Bone className="h-full w-full rounded-none" />}>
            <LazySinglePlaceMap lat={row.lat!} lng={row.lng!} dark={isDark} className="!rounded-none" />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: accent }} aria-hidden><NvIcon name={row.kind === 'transfer' ? 'transactions' : 'pin'} size={56} strokeWidth={1.2} /></div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28" style={{ background: 'linear-gradient(to top, var(--nv-surface), transparent)' }} aria-hidden />
        {row.located && (row.city || row.place) && (
          <span className="absolute left-4 top-4 inline-flex h-10 max-w-[60%] items-center gap-1.5 rounded-full bg-nv-surface/80 px-3.5 text-[14px] font-medium text-nv-ink backdrop-blur-md">
            <NvIcon name="pin" size={16} className="shrink-0 text-nv-violet-text" /><span className="truncate">{row.city || row.place}</span>
          </span>
        )}
      </div>

      <div className="relative -mt-12 px-6">
        <TxAvatar row={row} logoUrl={data.logoFor(row.merchant)} color={category?.color} icon={category?.icon} size={64} rounded="xl" />
        <p className="mt-3 text-[14px] text-nv-muted">{longDate(row.date)}{account ? ` · ${account.name}` : ''}</p>
        <h3 className="mt-1 break-words text-3xl font-semibold leading-tight tracking-tight text-nv-ink">{row.title}</h3>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Money amount={row.amount} currency={row.currency} size="hero" signed={row.kind === 'income'} tone={tone} />
          <span className="text-sm font-medium text-nv-muted">{row.currency}</span>
        </div>
        {row.kind === 'transfer' && row.toAmount !== undefined && row.toCurrency && row.toCurrency !== row.currency && (
          <p className="mt-1.5 text-sm text-nv-muted">Arrives as {formatCurrency(row.toAmount, row.toCurrency)}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium" style={{ background: tint(accent, 18), color: row.kind === 'income' ? 'var(--nv-green-text)' : row.kind === 'transfer' ? 'var(--nv-sky-text)' : category?.color || 'var(--nv-ink)' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: accent }} aria-hidden />{KIND_WORD[row.kind]}
          </span>
          {!row.uncategorized && row.kind !== 'transfer' && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium" style={{ background: tint(category?.color, 14), color: category?.color }}>
              <EntityGlyph icon={category?.icon} label={row.category} color={category?.color} size={14} />{row.category}{category?.parent && <span className="opacity-70">· {category.parent}</span>}
            </span>
          )}
          <TxBadges row={row} />
        </div>
      </div>
    </div>
  );
};

export const DetailBody: React.FC<{
  row: TxRow; data: TransactionsData; place?: { name?: string; lines: string[] } | null; roundUp?: number; loan?: { principal: number; interest: number; currency: TxRow['currency'] };
  parts: ReturnType<TransactionsData['partsOf']>; tags: React.ReactNode;
}> = ({ row, data, place, roundUp, loan, parts, tags }) => {
  const account = data.accountsById.get(row.accountId);
  const toAccount = row.toAccountId ? data.accountsById.get(row.toAccountId) : undefined;
  const logo = (url: string | null, label: string, bank?: boolean) => <LogoTile url={url} label={label} size={44} fallbackIcon={bank ? 'bank' : undefined} className="!bg-nv-inset" />;
  const accountLogo = (a?: { financialInstitution?: string; name: string }) => logo(a?.financialInstitution ? data.logoFor(a.financialInstitution) : null, a?.name ?? '?', true);
  const accountHint = (a?: { last4?: string; type: string }) => (a ? (a.last4 ? `•••• ${a.last4}` : a.type) : undefined);
  const description = row.detail || (row.description && row.description !== row.title ? row.description : '');
  const where = place ?? (row.located ? { lines: locationLine(row).split(', ').filter(Boolean) } : null);
  const whereText = where ? [where.name, ...where.lines].filter(Boolean).join(', ') : '';
  const mapsUrl = row.lat !== undefined && row.lng !== undefined ? `https://www.google.com/maps?q=${row.lat},${row.lng}` : whereText ? `https://www.google.com/maps?q=${encodeURIComponent(whereText)}` : '';

  return (
    <div className="mt-7 space-y-7">
      {row.kind === 'transfer' ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          <Party label="From" icon="bank" logo={accountLogo(account)} name={account?.name ?? 'Unknown account'} hint={accountHint(account)} />
          <Party label="To" icon="bank" logo={accountLogo(toAccount)} name={toAccount?.name ?? 'Unknown account'} hint={accountHint(toAccount)} />
        </div>
      ) : (
        <Party label="Account" icon="bank" logo={accountLogo(account)} name={account?.name ?? 'Unknown account'} hint={accountHint(account)} />
      )}

      {description && (
        <Fact label="Description" icon="note"><p className="break-words text-[17px] leading-snug text-nv-ink">{description}</p></Fact>
      )}
      {row.notes && (
        <Fact label="Memo" icon="note"><p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-nv-ink">{row.notes}</p></Fact>
      )}

      {where && (
        <Fact
          label="Location"
          icon="pin"
          action={mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-nv-violet-text hover:underline">Open in Maps<NvIcon name="external" size={13} /></a> : undefined}
        >
          <address className="not-italic">
            {where.name && <p className="break-words text-[16px] font-semibold text-nv-ink">{where.name}</p>}
            {where.lines.map((line, i) => <p key={i} className="break-words text-[15px] leading-relaxed text-nv-ink">{line}</p>)}
          </address>
        </Fact>
      )}

      {(roundUp !== undefined || loan) && (
        <div className="flex flex-wrap gap-2">
          {roundUp !== undefined && (
            <Pill color="var(--nv-green)" text="var(--nv-green-text)" icon="piggy">{formatCurrency(roundUp, row.currency)} set aside as spare change</Pill>
          )}
          {loan && (
            <>
              <Pill color="var(--nv-orange)" text="var(--nv-orange-text)" icon="money">Principal {formatCurrency(loan.principal, loan.currency)}</Pill>
              <Pill color="var(--nv-orange)" text="var(--nv-orange-text)">Interest {formatCurrency(loan.interest, loan.currency)}</Pill>
            </>
          )}
        </div>
      )}

      {tags}

      {parts.length > 0 && (
        <Fact label={row.split ? `Split into ${parts.length} parts` : `Combines ${parts.length} transactions`}>
          <ul className="space-y-3">
            {parts.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-nv-ink">{p.description || p.merchant || p.category}</span>
                  <span className="block truncate text-[13px] text-nv-muted">{p.category}</span>
                </span>
                <Money amount={p.amount} currency={p.currency} size="md" signed={p.amount > 0} tone={p.amount > 0 ? 'income' : 'ink'} />
              </li>
            ))}
          </ul>
        </Fact>
      )}
      {row.adjustment && <p className="text-sm text-nv-muted">Balance adjustments are edited from their account.</p>}
    </div>
  );
};

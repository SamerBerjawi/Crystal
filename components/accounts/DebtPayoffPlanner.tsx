import React, { useEffect, useMemo, useState } from 'react';
import type { Account, DebtPlanSettings, Transaction } from '../../types';
import { comparePlans, type PlanResult, type Strategy } from '../../utils/debtPlan';
import { debtsFromAccounts } from '../../utils/debtPlanInputs';
import { getMainCurrency } from '../../utils';
import { useScheduleContext } from '../../contexts/FinancialDataContext';
import { usePreferencesContext } from '../../contexts/DomainProviders';
import { Amount } from '../ui/Money';
import { AmountInput } from '../ui/Fields';
import { Banner, EmptyState } from '../ui/States';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const COLORS: Record<Strategy, string> = { minimums: 'var(--muted)', snowball: 'var(--amber)', avalanche: 'var(--primary)' };
const NAMES: Record<Strategy, string> = { minimums: 'Minimums only', snowball: 'Snowball', avalanche: 'Avalanche' };
const HOW: Record<Strategy, string> = {
  minimums: 'Each debt gets its own payment and nothing more.',
  snowball: 'Extra goes to the smallest balance first. Quick wins.',
  avalanche: 'Extra goes to the highest rate first. Least interest.',
};
const number = (text: string) => { const n = Number(text.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
const monthName = (iso: string) => new Date(`${iso}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const duration = (months: number) => { const y = Math.floor(months / 12), m = months % 12; return [y ? `${y} ${y === 1 ? 'year' : 'years'}` : '', m ? `${m} ${m === 1 ? 'month' : 'months'}` : ''].filter(Boolean).join(' ') || 'Under a month'; };

const W = 640, H = 220, PAD = { top: 12, right: 12, bottom: 26, left: 56 };
const innerW = W - PAD.left - PAD.right, innerH = H - PAD.top - PAD.bottom;
const compact = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Total owed over the months to come, one line per way of paying. */
const BalanceChart: React.FC<{ plans: PlanResult[]; currency: string; today: Date }> = ({ plans, currency, today }) => {
  const last = Math.max(1, ...plans.map(p => (p.months ?? p.balances.length - 1)));
  const max = Math.max(1, plans[0].balances[0]) * 1.05;
  const x = (m: number) => PAD.left + (Math.min(m, last) / last) * innerW;
  const y = (v: number) => PAD.top + (1 - v / max) * innerH;
  const line = (plan: PlanResult) => plan.balances.slice(0, last + 1).map((v, m) => `${m === 0 ? 'M' : 'L'}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const labelAt = (m: number) => new Date(today.getFullYear(), today.getMonth() + m, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Total owed over time under each way of paying.">
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(f * max)} y2={y(f * max)} className="stroke-line" strokeWidth={1} />
          <text x={PAD.left - 8} y={y(f * max) + 4} textAnchor="end" className="fill-muted" fontSize={11}>{compact(f * max, currency)}</text>
        </g>
      ))}
      {[0, 0.5, 1].map((f, i) => <text key={f} x={x(f * last)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-muted" fontSize={11}>{labelAt(Math.round(f * last))}</text>)}
      {plans.map(plan => <path key={plan.strategy} d={line(plan)} fill="none" stroke={COLORS[plan.strategy]} strokeWidth={plan.strategy === 'minimums' ? 2 : 2.5} strokeDasharray={plan.strategy === 'minimums' ? '5 4' : undefined} strokeLinejoin="round" />)}
    </svg>
  );
};

/** Pay your debts off with one budget: the order, the date, and the interest, for three ways of splitting the money. */
const DebtPayoffPlanner: React.FC<{ accounts: Account[]; transactions: Transaction[] }> = ({ accounts, transactions }) => {
  const { loanPaymentOverrides } = useScheduleContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const settings: DebtPlanSettings = preferences.debtPlan ?? {};
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);
  const [extraText, setExtraText] = useState(settings.extra ? String(settings.extra) : '');
  const extra = number(extraText);

  const save = (next: DebtPlanSettings) => setPreferences(prev => ({ ...prev, debtPlan: next }));
  useEffect(() => {
    if (extra === (settings.extra ?? 0)) return;
    const timer = setTimeout(() => save({ ...settings, extra: extra || undefined }), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra]);

  const debts = useMemo(
    () => debtsFromAccounts({ accounts, transactions, loanPaymentOverrides, settings, conversionRates: preferences.conversionRates }),
    [accounts, transactions, loanPaymentOverrides, settings, preferences.conversionRates],
  );
  const planned = debts.filter(d => !d.needsDetails);
  const waiting = debts.filter(d => d.needsDetails);
  const comparison = useMemo(() => comparePlans(planned, extra, today), [planned, extra, today]);

  if (debts.length === 0) return <EmptyState icon="target-02" title="No debts to plan" description="Add a loan or another liability under Accounts, and Crystal will work out the quickest way to clear it." />;

  const setOverride = (id: string, patch: { rate?: number; payment?: number }) =>
    save({ ...settings, overrides: { ...settings.overrides, [id]: { ...settings.overrides?.[id], ...patch } } });
  const totalOwed = planned.reduce((sum, d) => sum + d.balance, 0);
  const totalPayments = planned.reduce((sum, d) => sum + d.minimum, 0);
  const strategies: Strategy[] = ['minimums', 'snowball', 'avalanche'];
  const best = comparison[comparison.cheapest];

  return (
    <div className="space-y-6">
      {comparison.minimums.stuck.length > 0 && (
        <Banner tone="attention">{planned.filter(d => comparison.minimums.stuck.includes(d.id)).map(d => d.name).join(', ')} {comparison.minimums.stuck.length === 1 ? 'is' : 'are'} paid less each month than the interest it adds, so on minimums alone {comparison.minimums.stuck.length === 1 ? 'it never clears' : 'they never clear'}.</Banner>
      )}

      <section className={CARD}>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <AmountInput label="Extra each month" currency={currency} value={extraText} onChange={setExtraText} help="On top of what you already pay." />
          <p className="type-body text-ink">
            {planned.length === 0 ? 'Add a monthly payment to your debts below to see a plan.' : <>
              You owe <Amount value={totalOwed} currency={currency} className="type-body-strong" /> and pay <Amount value={totalPayments} currency={currency} className="type-body-strong" /> a month{extra > 0 && <>, plus <Amount value={extra} currency={currency} className="type-body-strong" /></>}.
              {extra > 0 && best.months !== null && comparison.minimums.months !== null && best.months < comparison.minimums.months && <> That clears everything {comparison.minimums.months - best.months} months sooner and saves <Amount value={comparison.saved[comparison.cheapest]} currency={currency} className="type-body-strong" /> in interest.</>}
            </>}
          </p>
        </div>
      </section>

      {planned.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {strategies.map(strategy => {
              const plan = comparison[strategy];
              const isBest = strategy === comparison.cheapest && extra > 0 && Math.abs(comparison.avalanche.interest - comparison.snowball.interest) > 0.5;
              return (
                <section key={strategy} className={`${CARD} ${isBest ? 'ring-2 ring-primary' : ''}`} aria-label={NAMES[strategy]}>
                  <h2 className="type-label flex items-center gap-2 text-muted"><span className="inline-block h-1 w-4 rounded-full" style={{ background: COLORS[strategy] }} />{NAMES[strategy]}{isBest && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[.6875rem] font-bold text-ink">Least interest</span>}</h2>
                  <p className="type-figure-lg mt-1 text-ink">{plan.payoff ? monthName(plan.payoff) : 'Never'}</p>
                  <p className="type-caption text-muted">{plan.months === null ? 'The payments do not keep up with the interest.' : `Debt-free in ${duration(plan.months)}.`}</p>
                  <p className="type-body mt-3 text-ink">Interest <Amount value={plan.interest} currency={currency} className="type-body-strong" /></p>
                  {strategy !== 'minimums' && plan.months !== null && comparison.minimums.months !== null && (
                    <p className="type-caption text-muted">
                      {comparison.saved[strategy] > 0 ? <>Saves <Amount value={comparison.saved[strategy]} currency={currency} className="type-caption" /> and {comparison.minimums.months - plan.months} months against minimums.</> : 'Same as minimums only, with no extra.'}
                    </p>
                  )}
                  <p className="type-caption mt-3 text-muted">{HOW[strategy]}</p>
                </section>
              );
            })}
          </div>

          <section className={CARD} aria-label="Total owed over time">
            <h2 className="type-card-title mb-3 text-ink">What you owe, month by month</h2>
            <BalanceChart plans={strategies.map(s => comparison[s])} currency={currency} today={today} />
            <div className="type-caption mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted">
              {strategies.map(s => <span key={s} className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: COLORS[s] }} />{NAMES[s]}</span>)}
            </div>
          </section>

          {extra > 0 && (
            <section className={CARD} aria-label="Order">
              <h2 className="type-card-title mb-1 text-ink">The order to clear them</h2>
              <p className="type-caption mb-3 text-muted">{NAMES[comparison.cheapest]}{Math.abs(comparison.avalanche.interest - comparison.snowball.interest) > 0.5 ? ', the plan with the least interest.' : ', which costs the same as snowball here.'}</p>
              <ol className="divide-y divide-line">
                {best.order.map((step, index) => (
                  <li key={step.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="type-body-strong text-ink">{index + 1}. {step.name}</span>
                    <span className="type-caption text-muted">cleared {new Date(today.getFullYear(), today.getMonth() + step.month, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <section className={CARD} aria-label="Your debts">
        <h2 className="type-card-title mb-3 text-ink">Your debts</h2>
        <ul className="divide-y divide-line">
          {planned.map(d => (
            <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
              <span className="type-body-strong text-ink">{d.name}</span>
              <span className="type-caption text-muted"><Amount value={d.balance} currency={currency} className="type-caption" /> at {d.rate.toFixed(1)}%, <Amount value={d.minimum} currency={currency} className="type-caption" /> a month</span>
            </li>
          ))}
        </ul>
        {waiting.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="type-caption text-muted">These have no rate or payment on record. Add them to include them in the plan.</p>
            {waiting.map(d => (
              <div key={d.id} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem]">
                <p className="type-body-strong text-ink">{d.name} <span className="type-caption font-normal text-muted"><Amount value={d.balance} currency={currency} className="type-caption" /> owed</span></p>
                <AmountInput label="Rate a year" placeholder="0" defaultValue={settings.overrides?.[d.id]?.rate ? String(settings.overrides[d.id].rate) : ''} onBlur={e => setOverride(d.id, { rate: number(e.target.value) })} />
                <AmountInput label="Paid a month" currency={currency} defaultValue={settings.overrides?.[d.id]?.payment ? String(settings.overrides[d.id].payment) : ''} onBlur={e => setOverride(d.id, { payment: number(e.target.value) })} />
              </div>
            ))}
          </div>
        )}
        <p className="type-caption mt-4 text-muted">Loans use the rate and payment from their schedule. Amounts are in {currency} at today's exchange rates. Interest is worked out monthly at a twelfth of the yearly rate.</p>
      </section>
    </div>
  );
};

export default DebtPayoffPlanner;

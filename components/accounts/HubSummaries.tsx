import React, { useMemo } from 'react';
import type { Account, Transaction } from '../../types';
import { convertCurrency, convertToMain, generateAmortizationSchedule, getCreditCardStatementDetails, getMainCurrency, parseLocalDate } from '../../utils';
import { computeAccountDisplayBalance } from '../../utils/accountsModel';
import { loansForAsset } from '../../utils/accountLinks';
import { statementPeriodFor } from '../../utils/accountPagesModel';
import { usePreferencesSelector } from '../../contexts/DomainProviders';
import { useScheduleContext } from '../../contexts/FinancialDataContext';
import { Badge, Row } from '../ui/Display';
import { Amount } from '../ui/Money';
import { StatGauge } from '../ui/StatGauge';
import { Figures, Section, ShareBar } from './charts';
import { daysUntil, shortDay } from './pageKit';

const useDisplay = () => {
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const currency = usePreferencesSelector(p => (p.currency || 'EUR') as string);
  const { loanPaymentOverrides } = useScheduleContext();
  return {
    currency,
    conversionRates,
    loanPaymentOverrides,
    toDisplay: (value: number, from: string) => convertCurrency(convertToMain(value, from, conversionRates), getMainCurrency(), currency, conversionRates),
  };
};

/** Cards tab: what's owed against the limits, and each card's next due date with what its pay-from account holds. */
export const CardsSummary: React.FC<{ cards: Account[]; accounts: Account[]; transactionsByAccount: Record<string, Transaction[]>; transactions: Transaction[]; onOpen: (id: string) => void }> = ({ cards, accounts, transactionsByAccount, transactions, onOpen }) => {
  const { currency, toDisplay, conversionRates, loanPaymentOverrides } = useDisplay();
  const credit = cards.filter(card => card.type === 'Credit Card' && card.status !== 'closed');
  const rows = useMemo(() => {
    const today = new Date();
    return credit.map(card => {
      const balance = computeAccountDisplayBalance(card, transactionsByAccount[card.id] || [], loanPaymentOverrides, { conversionRates });
      const settlement = accounts.find(item => item.id === card.settlementAccountId);
      const settlementBalance = settlement ? computeAccountDisplayBalance(settlement, transactionsByAccount[settlement.id] || [], loanPaymentOverrides, { conversionRates }) : null;
      let due: Date | null = null;
      let amount = Math.abs(Math.min(0, balance));
      if (card.statementStartDate && card.paymentDate) {
        const closed = statementPeriodFor(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 31), card.statementStartDate, card.paymentDate);
        const open = statementPeriodFor(today, card.statementStartDate, card.paymentDate);
        const period = closed.due >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? closed : open;
        due = period.due;
        const details = getCreditCardStatementDetails(card, period.start, period.end, transactions);
        if (period === closed) amount = Math.max(0, -details.statementBalance - details.amountPaid);
      }
      return { card, balance, settlement, settlementBalance, due, amount };
    }).sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
  }, [credit, accounts, transactionsByAccount, transactions, loanPaymentOverrides, conversionRates]);
  if (credit.length === 0) return null;
  const owed = rows.reduce((sum, row) => sum + toDisplay(Math.abs(Math.min(0, row.balance)), row.card.currency), 0);
  const limit = rows.reduce((sum, row) => sum + toDisplay(row.card.creditLimit || 0, row.card.currency), 0);
  const used = limit > 0 ? (owed / limit) * 100 : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
      <Section title="Credit used" subtitle="All credit cards together">
        <div className="flex items-center gap-5">
          {limit > 0 && <StatGauge fill={used} tone={used > 70 ? 'loss' : used > 30 ? 'amber' : 'pine'} display={`${Math.round(used)}%`} caption="of limits" label="Credit used" size={120} />}
          <Figures className="flex-1" items={[{ label: 'Owed', value: <Amount value={owed} currency={currency} /> }, { label: 'Limits', value: limit ? <Amount value={limit} currency={currency} /> : '—' }]} />
        </div>
      </Section>
      <Section title="Next payments" subtitle="Each card's statement and the account it's paid from">
        <ul className="divide-y divide-line">
          {rows.map(row => {
            const short = row.settlementBalance !== null && row.amount > row.settlementBalance;
            return (
              <li key={row.card.id}>
                <Row
                  title={row.card.name}
                  context={row.due ? `Due ${shortDay(row.due)}, in ${daysUntil(row.due)} days${row.settlement ? ` · from ${row.settlement.name}` : ''}` : 'No statement days set'}
                  trailing={
                    <span className="flex items-center gap-3">
                      {row.settlement && (short ? <Badge tone="negative">Short</Badge> : <Badge tone="positive">Covered</Badge>)}
                      <span className="type-figure-row text-ink"><Amount value={row.amount} currency={row.card.currency} /></span>
                    </span>
                  }
                  onPress={() => onOpen(row.card.id)}
                />
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
};

/** Loans tab: each loan from today to its end, with what is paid off. */
export const LoansSummary: React.FC<{ loans: Account[]; transactions: Transaction[]; onOpen: (id: string) => void }> = ({ loans, transactions, onOpen }) => {
  const { loanPaymentOverrides } = useDisplay();
  const rows = useMemo(() => loans.filter(loan => loan.type === 'Loan' || loan.type === 'Lending').map(loan => {
    const schedule = generateAmortizationSchedule(loan, transactions, loanPaymentOverrides[loan.id] || {});
    const paid = schedule.filter(item => item.status === 'Paid').reduce((sum, item) => sum + item.principal, 0);
    const principal = loan.principalAmount || schedule.reduce((sum, item) => sum + item.principal, 0) || 1;
    const end = schedule.length ? parseLocalDate(schedule[schedule.length - 1].date) : null;
    return { loan, progress: Math.min(100, (paid / principal) * 100), end, monthly: loan.monthlyPayment || schedule.find(item => item.status !== 'Paid')?.totalPayment || 0 };
  }).sort((a, b) => (a.end?.getTime() ?? Infinity) - (b.end?.getTime() ?? Infinity)), [loans, transactions, loanPaymentOverrides]);
  if (rows.length === 0) return null;
  return (
    <Section title="Payoff timeline" subtitle="How far along each loan is, soonest to finish first">
      <ul className="space-y-4">
        {rows.map(row => (
          <li key={row.loan.id}>
            <button type="button" onClick={() => onOpen(row.loan.id)} className="w-full cursor-pointer space-y-1.5 rounded-[var(--radius-md)] p-1 text-left hover:bg-inset">
              <span className="flex items-baseline justify-between gap-3">
                <span className="type-body-strong truncate text-ink">{row.loan.name}{row.loan.type === 'Lending' ? ' (lent)' : ''}</span>
                <span className="type-caption shrink-0 text-muted">{Math.round(row.progress)}% · ends {row.end ? row.end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'} · <Amount value={row.monthly} currency={row.loan.currency} /> a month</span>
              </span>
              <ShareBar value={row.progress} label={`${row.loan.name} paid off`} />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
};

/** Assets tab: total value against what's borrowed on it. */
export const AssetsSummary: React.FC<{ assets: Account[]; accounts: Account[]; transactionsByAccount: Record<string, Transaction[]>; onOpen: (id: string) => void }> = ({ assets, accounts, transactionsByAccount, onOpen }) => {
  const { currency, toDisplay, loanPaymentOverrides, conversionRates } = useDisplay();
  const rows = assets.map(asset => {
    const loans = loansForAsset(asset, accounts);
    const debt = loans.reduce((sum, loan) => sum + Math.abs(Math.min(0, computeAccountDisplayBalance(loan, transactionsByAccount[loan.id] || [], loanPaymentOverrides, { conversionRates }))), 0);
    return { asset, value: toDisplay(asset.balance, asset.currency), debt: toDisplay(debt, loans[0]?.currency ?? asset.currency), loan: loans[0] };
  });
  if (rows.length === 0) return null;
  const value = rows.reduce((sum, row) => sum + row.value, 0);
  const debt = rows.reduce((sum, row) => sum + row.debt, 0);
  return (
    <Section title="Value and equity" subtitle="What your assets are worth, less what's borrowed on them">
      <Figures className="mb-4" items={[{ label: 'Value', value: <Amount value={value} currency={currency} /> }, { label: 'Borrowed', value: <Amount value={debt} currency={currency} /> }, { label: 'Equity', value: <Amount value={value - debt} currency={currency} /> }]} />
      <ul className="divide-y divide-line">
        {rows.map(row => (
          <li key={row.asset.id}>
            <Row
              title={row.asset.name}
              context={row.loan ? `${row.asset.type} · secured ${row.loan.name}, ${Math.round(row.value > 0 ? (row.debt / row.value) * 100 : 0)}% loan to value` : row.asset.type}
              trailing={<span className="type-figure-row text-ink"><Amount value={row.value - row.debt} currency={currency} /></span>}
              onPress={() => onOpen(row.asset.id)}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import type { Account, Currency, InvestmentTransaction, Prediction, Transaction, UserStats, Warrant } from '../types';
import { parseLocalDate, toLocalISOString, convertCurrency, getMainCurrency } from '../utils';
import { BADGE_GROUPS, budgetMastery, challengeBadges, challengeMetrics, debtsAndGoals, healthScore, netWorthHistory, personalRecords, predictionValue, resolvePredictions, SPRINTS, sprintProgress, type ActiveSprint } from '../utils/challengesModel';
import { usePreferencesContext } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import PageHeader, { type PageStat } from '../components/PageHeader';
import PredictionCard from '../components/PredictionCard';
import PredictionModal from '../components/PredictionModal';
import { Button } from '../components/ui/Actions';
import { Badge, ProgressRing } from '../components/ui/Display';
import Icon from '../components/ui/Icon';
import { Amount } from '../components/ui/Money';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';

const TABS = [
  { id: 'score', label: 'Score' },
  { id: 'progress', label: 'Debts and goals' },
  { id: 'badges', label: 'Badges' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'records', label: 'Records' },
];
const SPRINT_STATUS = { active: { label: 'Under way', tone: 'blue' }, failed: { label: 'Missed', tone: 'negative' }, completed: { label: 'Done', tone: 'positive' } } as const;
const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5';
const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 min-[1100px]:grid-cols-3';

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const Meter: React.FC<{ percent: number; color?: string }> = ({ percent, color = 'var(--primary)' }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-inset"><div className="h-full rounded-full transition-[width] duration-[var(--duration-slow)]" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }} /></div>
);

const Heading: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <h2 className="type-card-title text-ink">{children}</h2>
    {aside && <span className="type-caption shrink-0 text-muted">{aside}</span>}
  </div>
);

interface ChallengesProps {
  userStats: UserStats;
  accounts: Account[];
  transactions: Transaction[];
  predictions: Prediction[];
  savePrediction: (prediction: Omit<Prediction, 'id'> & { id?: string }) => void;
  deletePrediction: (id: string) => void;
  saveUserStats: (stats: UserStats) => void;
  investmentTransactions: InvestmentTransaction[];
  warrants: Warrant[];
  assetPrices: Record<string, number | null>;
}

/** Score, progress, badges, budgets, sprints, predictions and records, in calm tabs with no battle styling (D-029). */
/** Challenge figures are worked out in EUR, because thresholds are set in EUR. They show in your main currency. */
const InMain: React.FC<{ value: number }> = ({ value }) => <Amount value={convertCurrency(value, 'EUR', getMainCurrency())} currency={getMainCurrency()} />;

const Challenges: React.FC<ChallengesProps> = ({ userStats, accounts, transactions, predictions, savePrediction, deletePrediction, saveUserStats, investmentTransactions, warrants, assetPrices }) => {
  const { budgets } = useBudgetsContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions, loanPaymentOverrides, memberships, billsAndPayments } = useScheduleContext();
  const { expenseCategories } = useCategoryContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const [tab, setTab] = useState('score');
  const [isPredicting, setPredicting] = useState(false);

  // Sprints live in preferences so they follow you across devices. Ones a browser started earlier carry over once.
  const [legacySprints, setLegacySprints] = useLocalStorage<ActiveSprint[]>('crystal_active_sprints', []);
  const activeSprints: ActiveSprint[] = preferences.activeSprints ?? legacySprints;
  const setActiveSprints = (next: ActiveSprint[]) => {
    setPreferences(prev => ({ ...prev, activeSprints: next }));
    if (legacySprints.length > 0) setLegacySprints([]);
  };

  const now = useMemo(() => new Date(), []);
  const today = toLocalISOString(now);
  const predictionContext = useMemo(() => ({ accounts, transactions, prices: assetPrices }), [accounts, transactions, assetPrices]);

  // Predictions settle while this page is open (AUT-44).
  useEffect(() => {
    const resolved = resolvePredictions(predictions, predictionContext, today);
    if (resolved.length === 0) return;
    resolved.forEach(savePrediction);
    saveUserStats({
      ...userStats,
      predictionWins: (userStats.predictionWins || 0) + resolved.filter(item => item.status === 'won').length,
      predictionTotal: (userStats.predictionTotal || 0) + resolved.length,
    });
  }, [predictions, predictionContext, today, userStats, savePrediction, saveUserStats]);

  const metrics = useMemo(() => challengeMetrics(accounts, transactions, budgets, expenseCategories, now), [accounts, transactions, budgets, expenseCategories, now]);
  const health = useMemo(() => healthScore(metrics), [metrics]);
  const progress = useMemo(() => debtsAndGoals(accounts, transactions, financialGoals, loanPaymentOverrides), [accounts, transactions, financialGoals, loanPaymentOverrides]);
  const mastery = useMemo(() => budgetMastery(budgets, metrics.spendingByCategory), [budgets, metrics.spendingByCategory]);
  const badges = useMemo(
    () => challengeBadges({ accounts, budgets, goals: financialGoals, metrics, memberships, bills: billsAndPayments, recurring: recurringTransactions, investmentTransactions, stats: userStats, predictions, now }),
    [accounts, budgets, financialGoals, metrics, memberships, billsAndPayments, recurringTransactions, investmentTransactions, userStats, predictions, now]
  );
  const sprints = useMemo(() => sprintProgress(activeSprints, accounts, transactions, now), [activeSprints, accounts, transactions, now]);
  const records = useMemo(() => {
    const { current, history } = netWorthHistory(accounts, transactions, now);
    return personalRecords(current, history);
  }, [accounts, transactions, now]);

  const priceCurrency = (prediction: Prediction): Currency => (prediction.type === 'price_target' && prediction.targetId ? preferences.investmentPriceConfigs?.[prediction.targetId]?.currency ?? 'EUR' : 'EUR');

  const stats: PageStat[] = [
    { label: 'Health score', icon: 'analytics-01', value: Math.round(health.score), format: 'number', badge: health.rank, badgeTone: 'pine' },
    { label: 'Day streak', icon: 'calendar-03', value: userStats.currentStreak, format: 'number', badge: `best ${userStats.longestStreak}`, badgeTone: 'butter' },
    { label: 'Savings rate', icon: 'piggy-bank', value: metrics.savingsRate * 100, format: 'percent' },
  ];

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader title="Challenges" stats={stats} actions={tab === 'predictions' ? <Button icon="add-01" onPress={() => setPredicting(true)}>New prediction</Button> : undefined} />
      <SegmentedControl scrollable items={TABS} activeId={tab} onChange={setTab} />

      {tab === 'score' && (
        <>
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
            <section aria-label="Health score" className={`${CARD} flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left min-[900px]:col-span-2`}>
              <ProgressRing value={health.score} tone={health.score >= 50 ? 'pine' : 'amber'} label={String(Math.round(health.score))} caption="of 100" />
              <div className="min-w-0">
                <p className="type-caption text-muted">Financial health</p>
                <h2 className="type-page-title text-ink">{health.rank}</h2>
                <p className="type-body mt-1 text-muted">Your score comes from what you save, the cash you can reach, what you owe and how spread out your accounts are.</p>
              </div>
            </section>
            <section aria-label="Streak" className={CARD}>
              <p className="type-caption text-muted">Days in a row</p>
              <p className="type-figure-lg mt-1 text-ink">{userStats.currentStreak}</p>
              <p className="type-caption mt-3 border-t border-line pt-3 text-muted">Your best is {userStats.longestStreak} days.</p>
            </section>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1100px]:grid-cols-4">
            {health.factors.map(factor => (
              <section key={factor.id} aria-label={factor.label} className={CARD}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-inset text-muted"><Icon name={factor.icon} size={18} /></span>
                  <span className="type-figure-row text-ink">{factor.score.toFixed(0)} <span className="type-caption text-muted">of {factor.max}</span></span>
                </div>
                <h3 className="type-body-strong mt-3 text-ink">{factor.label}</h3>
                <p className="type-caption mb-2 text-muted">{factor.value}</p>
                <Meter percent={(factor.score / factor.max) * 100} />
              </section>
            ))}
          </div>
        </>
      )}

      {tab === 'progress' && (
        progress.debts.length === 0 && progress.savings.length === 0
          ? <EmptyState icon="checkmark-circle-02" title="All quiet" description="You have no debts or open goals to work through right now." />
          : (
            <>
              {progress.debts.length > 0 && (
                <section aria-label="Debts">
                  <Heading>Debts</Heading>
                  <div className={GRID}>
                    {progress.debts.map(debt => (
                      <article key={debt.id} className={CARD}>
                        <h3 className="type-body-strong truncate text-ink">{debt.name}</h3>
                        <p className="type-figure-row mt-1 text-ink"><InMain value={debt.remaining} /> <span className="type-caption text-muted">left of <InMain value={debt.total} /></span></p>
                        <div className="mt-2"><Meter percent={(1 - debt.remaining / debt.total) * 100} /></div>
                        {debt.paidPrincipal > 0 && <p className="type-caption mt-2 text-muted">Paid <InMain value={debt.paidPrincipal} /> off the loan and <InMain value={debt.paidInterest} /> in interest.</p>}
                        {debt.payments.length > 0 && (
                          <ul className="mt-3 space-y-1 border-t border-line pt-2">
                            {debt.payments.map(payment => (
                              <li key={`${payment.date}${payment.amount}`} className="type-caption flex justify-between gap-3 text-muted"><span>{shortDate(payment.date)}</span><InMain value={payment.amount} /></li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {progress.savings.length > 0 && (
                <section aria-label="Savings goals">
                  <Heading>Savings goals</Heading>
                  <div className={GRID}>
                    {progress.savings.map(goal => (
                      <article key={goal.id} className={CARD}>
                        <h3 className="type-body-strong truncate text-ink">{goal.name}</h3>
                        <p className="type-figure-row mt-1 text-ink"><InMain value={goal.remaining} /> <span className="type-caption text-muted">to go of <InMain value={goal.total} /></span></p>
                        <div className="mt-2"><Meter percent={(1 - goal.remaining / goal.total) * 100} /></div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )
      )}

      {tab === 'badges' && BADGE_GROUPS.map(group => {
        const rows = badges.filter(badge => badge.group === group);
        return (
          <section key={group} aria-label={group}>
            <Heading aside={`${rows.filter(badge => badge.unlocked).length} of ${rows.length}`}>{group}</Heading>
            <ul className={GRID}>
              {rows.map(badge => (
                <li key={badge.id} className={`${CARD} flex items-center gap-3`}>
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${badge.unlocked ? 'bg-pine text-on-pine' : 'bg-inset text-muted'}`}><Icon name={badge.unlocked ? badge.icon : 'square-lock-02'} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="type-body-strong block truncate text-ink">{badge.title}</span>
                    <span className="type-caption block text-muted">{badge.description}</span>
                    {!badge.unlocked && <span className="mt-1.5 block"><Meter percent={badge.progress} color="var(--muted)" /></span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {tab === 'budgets' && (
        mastery.length === 0
          ? <EmptyState icon="sliders-horizontal" title="No budgets yet" description="Create a budget, and each one earns a level by how little of its limit you use." />
          : (
            <ul className={GRID}>
              {mastery.map(row => (
                <li key={row.categoryName} className={CARD}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-body-strong min-w-0 truncate text-ink">{row.categoryName}</span>
                    <Badge tone={row.level === 0 ? 'negative' : row.level === 4 ? 'positive' : 'neutral'}>{row.title}</Badge>
                  </div>
                  <p className="type-caption mt-1 text-muted"><InMain value={row.spent} /> of <InMain value={row.amount} />{row.level > 0 ? `, level ${row.level} of 4` : ''}</p>
                  <div className="mt-2"><Meter percent={row.ratio * 100} color={row.ratio > 1 ? 'var(--money-out)' : 'var(--primary)'} /></div>
                </li>
              ))}
            </ul>
          )
      )}

      {tab === 'sprints' && (
        <>
          {sprints.length > 0 && (
            <section aria-label="Your sprints">
              <Heading>Your sprints</Heading>
              <div className={GRID}>
                {sprints.map(sprint => (
                  <article key={sprint.id} className={CARD}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="type-body-strong min-w-0 truncate text-ink">{sprint.title}</h3>
                      <Badge tone={SPRINT_STATUS[sprint.status].tone}>{SPRINT_STATUS[sprint.status].label}</Badge>
                    </div>
                    <p className="type-caption mt-1 text-muted">{sprint.daysLeft === 0 ? 'Time is up' : `${sprint.daysLeft} ${sprint.daysLeft === 1 ? 'day' : 'days'} left`}</p>
                    <div className="mt-2"><Meter percent={sprint.timeProgress} /></div>
                    {sprint.targetType !== 'transaction_limit' && <p className="type-caption mt-2 text-muted"><InMain value={sprint.spent} /> spent{sprint.limitAmount > 0 ? <>, limit <InMain value={sprint.limitAmount} /></> : ''}</p>}
                    <Button className="mt-3" variant="secondary" size="sm" onPress={() => setActiveSprints(activeSprints.filter(item => item.id !== sprint.id))}>{sprint.status === 'active' ? 'Give up' : 'Clear'}</Button>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section aria-label="Start a sprint">
            <Heading>Start a sprint</Heading>
            <div className={GRID}>
              {SPRINTS.filter(sprint => !activeSprints.some(item => item.id === sprint.id)).map(sprint => (
                <article key={sprint.id} className={`${CARD} flex flex-col`}>
                  <h3 className="type-body-strong text-ink">{sprint.title}</h3>
                  <p className="type-caption mt-1 flex-1 text-muted">{sprint.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="type-caption text-muted">{sprint.durationDays} {sprint.durationDays === 1 ? 'day' : 'days'}</span>
                    <Button variant="secondary" size="sm" aria-label={`Start ${sprint.title}`} onPress={() => setActiveSprints([...activeSprints, { id: sprint.id, startDate: today }])}>Start</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === 'predictions' && (
        predictions.length === 0
          ? <EmptyState icon="target-01" title="No predictions yet" description="Bet on your own spending, net worth or a holding's price, and see how you do." actionLabel="New prediction" onAction={() => setPredicting(true)} />
          : (
            <div className={GRID}>
              {predictions.map(prediction => <PredictionCard key={prediction.id} prediction={prediction} value={predictionValue(prediction, predictionContext)} currency={priceCurrency(prediction)} onDelete={deletePrediction} />)}
            </div>
          )
      )}

      {tab === 'records' && (
        <section aria-label="Records" className={CARD}>
          <Heading>Your net worth records</Heading>
          {records.isNewRecord && <p className="type-body mb-2 text-ink">You're at your all-time high today.</p>}
          <ul className="divide-y divide-line">
            {records.rows.map(row => (
              <li key={row.label} className="flex min-h-14 items-center justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="type-body-strong block truncate text-ink">{row.label}</span>
                  <span className="type-caption block truncate text-muted">{row.detail}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="type-figure-row block text-ink"><InMain value={row.value} /></span>
                  {row.changePct !== undefined && <span className="type-caption block text-muted">{row.changePct >= 0 ? '+' : '−'}{Math.abs(row.changePct).toFixed(1)}%</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isPredicting && <PredictionModal onClose={() => setPredicting(false)} onSave={savePrediction} accounts={accounts} expenseCategories={expenseCategories} investmentTransactions={investmentTransactions} warrants={warrants} />}
    </div>
  );
};

export default Challenges;

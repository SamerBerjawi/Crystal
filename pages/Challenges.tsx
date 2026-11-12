import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Account, Currency, InvestmentTransaction, Prediction, Transaction, UserStats, Warrant } from '../types';
import { parseLocalDate, toLocalISOString, convertCurrency, getMainCurrency } from '../utils';
import { BADGE_GROUPS, budgetMastery, challengeBadges, challengeMetrics, debtsAndGoals, healthScore, netWorthHistory, personalRecords, predictionValue, resolvePredictions, SPRINTS, sprintProgress, updateActivityStreak, type ActiveSprint } from '../utils/challengesModel';
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
import { BadgeInspectModal, getBadgeRarity, type BadgeItem } from '../components/BadgeInspectModal';
import { fireConfetti } from '../components/ui/Confetti';

const TABS = [
  { id: 'score', label: 'Score & Level' },
  { id: 'badges', label: 'Trophy Room' },
  { id: 'sprints', label: 'Missions & Sprints' },
  { id: 'budgets', label: 'Budget Mastery' },
  { id: 'progress', label: 'Debts & Goals' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'records', label: 'Records' },
];

/** Compact cards that comfortably fit 3 columns across desktop and laptop viewports */
const CARD = 'surface-card min-w-0 rounded-[var(--radius-lg)] p-4 border border-line transition-all duration-200 hover:border-line-strong';
const GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const Meter: React.FC<{ percent: number; color?: string; className?: string }> = ({ percent, color = 'var(--primary)', className = '' }) => (
  <div className={`h-1.5 overflow-hidden rounded-full bg-inset ${className}`}>
    <div
      className="h-full rounded-full transition-[width] duration-[var(--duration-slow)]"
      style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
    />
  </div>
);

const Heading: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="mb-2.5 flex items-baseline justify-between gap-2">
    <h2 className="type-card-title text-ink text-sm sm:text-base">{children}</h2>
    {aside && <span className="type-caption shrink-0 text-muted">{aside}</span>}
  </div>
);

const getSprintDifficulty = (id: string): { stars: number; xp: number; difficultyLabel: string } => {
  switch (id) {
    case 'shopping_ban':
    case 'entertainment_fast':
    case 'impulse_control':
      return { stars: 3, xp: 600, difficultyLabel: 'Hard Quest' };
    case 'weekend_warrior':
    case 'dining_detox':
    case 'grocery_gauntlet':
    case 'transport_trim':
    case 'low_cost_living':
      return { stars: 2, xp: 300, difficultyLabel: 'Medium Quest' };
    default:
      return { stars: 1, xp: 150, difficultyLabel: 'Easy Quest' };
  }
};

const getStreakMilestone = (streak: number) => {
  if (streak < 7) {
    return { target: 7, label: '7-Day Streak Master', current: streak, max: 7, xp: 150 };
  }
  if (streak < 14) {
    return { target: 14, label: '14-Day Habit Forger', current: streak - 7, max: 7, xp: 300 };
  }
  if (streak < 30) {
    return { target: 30, label: '30-Day Iron Discipline', current: streak - 14, max: 16, xp: 500 };
  }
  if (streak < 100) {
    return { target: 100, label: 'Centurion 100-Day Club', current: streak - 30, max: 70, xp: 1000 };
  }
  return { target: streak + 50, label: 'Immortal Streak Legend', current: streak % 50, max: 50, xp: 2000 };
};

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

const InMain: React.FC<{ value: number }> = ({ value }) => <Amount value={convertCurrency(value, 'EUR', getMainCurrency())} currency={getMainCurrency()} />;

const Challenges: React.FC<ChallengesProps> = ({
  userStats,
  accounts,
  transactions,
  predictions,
  savePrediction,
  deletePrediction,
  saveUserStats,
  investmentTransactions,
  warrants,
  assetPrices,
}) => {
  const { budgets } = useBudgetsContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions, loanPaymentOverrides, memberships, billsAndPayments } = useScheduleContext();
  const { expenseCategories } = useCategoryContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const [tab, setTab] = useState('score');
  const [isPredicting, setPredicting] = useState(false);
  const [inspectingBadge, setInspectingBadge] = useState<BadgeItem | null>(null);

  // Trophy Room Filters
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [badgeGroupFilter, setBadgeGroupFilter] = useState<string>('all');

  // Sprints live in preferences so they follow you across devices.
  const [legacySprints, setLegacySprints] = useLocalStorage<ActiveSprint[]>('crystal_active_sprints', []);
  const activeSprints: ActiveSprint[] = preferences.activeSprints ?? legacySprints;
  const setActiveSprints = (next: ActiveSprint[]) => {
    setPreferences(prev => ({ ...prev, activeSprints: next }));
    if (legacySprints.length > 0) setLegacySprints([]);
  };

  const now = useMemo(() => new Date(), []);
  const today = toLocalISOString(now);
  const predictionContext = useMemo(() => ({ accounts, transactions, prices: assetPrices, expenseCategories }), [accounts, transactions, assetPrices, expenseCategories]);

  // Predictions settle and daily streak updates while this page is open (AUT-44, ENH-CHL-01).
  useEffect(() => {
    const updatedStats = updateActivityStreak(userStats, today);
    const resolved = resolvePredictions(predictions, predictionContext, today);
    if (resolved.length === 0) {
      if (updatedStats !== userStats) {
        saveUserStats(updatedStats);
      }
      return;
    }
    resolved.forEach(savePrediction);
    saveUserStats({
      ...updatedStats,
      predictionWins: (updatedStats.predictionWins || 0) + resolved.filter(item => item.status === 'won').length,
      predictionTotal: (updatedStats.predictionTotal || 0) + resolved.length,
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

  // Net worth history & personal records
  const { currentNetWorth, netWorthPoints, records } = useMemo(() => {
    const { current, history } = netWorthHistory(accounts, transactions, now);
    const recs = personalRecords(current, history);
    return { currentNetWorth: current, netWorthPoints: history, records: recs };
  }, [accounts, transactions, now]);

  // Debts and Goals aggregates for summary overview
  const debtsSummary = useMemo(() => {
    const totalRemaining = progress.debts.reduce((sum, d) => sum + d.remaining, 0);
    const totalInitial = progress.debts.reduce((sum, d) => sum + d.total, 0);
    const totalPaid = Math.max(0, totalInitial - totalRemaining);
    const totalPrincipal = progress.debts.reduce((sum, d) => sum + d.paidPrincipal, 0);
    const totalInterest = progress.debts.reduce((sum, d) => sum + d.paidInterest, 0);
    const paidPct = totalInitial > 0 ? (totalPaid / totalInitial) * 100 : 0;
    return { totalRemaining, totalInitial, totalPaid, totalPrincipal, totalInterest, paidPct };
  }, [progress.debts]);

  const savingsSummary = useMemo(() => {
    const totalTarget = progress.savings.reduce((sum, g) => sum + g.total, 0);
    const totalRemaining = progress.savings.reduce((sum, g) => sum + g.remaining, 0);
    const totalFunded = Math.max(0, totalTarget - totalRemaining);
    const fundedPct = totalTarget > 0 ? (totalFunded / totalTarget) * 100 : 0;
    return { totalTarget, totalRemaining, totalFunded, fundedPct };
  }, [progress.savings]);

  // RPG Leveling & XP Calculation
  const streakXp = (userStats.currentStreak || 0) * 25 + (userStats.longestStreak || 0) * 15;
  const badgeXp = badges.filter(b => b.unlocked).length * 150;
  const healthXp = Math.round(health.score) * 20;
  const predictionXp = (userStats.predictionWins || 0) * 100;
  const completedSprintsCount = sprints.filter(s => s.status === 'completed').length;
  const sprintXp = completedSprintsCount * 250;
  const totalXp = streakXp + badgeXp + healthXp + predictionXp + sprintXp;

  const playerLevel = Math.max(1, Math.floor(totalXp / 500) + 1);
  const currentLevelXp = totalXp % 500;
  const xpToNextLevel = 500 - currentLevelXp;
  const levelProgressPct = (currentLevelXp / 500) * 100;

  const getTier = (lvl: number) => {
    if (lvl >= 20) return { title: 'Celestial Luminary', icon: 'sparkles', badgeTone: 'purple' as const, color: '#8b5cf6', badge: '🌌' };
    if (lvl >= 15) return { title: 'Diamond Titan', icon: 'star', badgeTone: 'blue' as const, color: '#06b6d4', badge: '💎' };
    if (lvl >= 10) return { title: 'Gold Sovereign', icon: 'crown', badgeTone: 'butter' as const, color: '#f59e0b', badge: '🥇' };
    if (lvl >= 5) return { title: 'Silver Strategist', icon: 'medal', badgeTone: 'neutral' as const, color: '#94a3b8', badge: '🥈' };
    return { title: 'Bronze Pioneer', icon: 'target-01', badgeTone: 'amber' as const, color: '#d97706', badge: '🥉' };
  };
  const tier = getTier(playerLevel);

  const streakMilestone = getStreakMilestone(userStats.currentStreak);

  const priceCurrency = (prediction: Prediction): Currency =>
    (prediction.type === 'price_target' && prediction.targetId ? preferences.investmentPriceConfigs?.[prediction.targetId]?.currency ?? 'EUR' : 'EUR');

  const stats: PageStat[] = [
    { label: 'Player Level', icon: 'award-01', value: playerLevel, format: 'number', badge: tier.title, badgeTone: tier.badgeTone },
    { label: 'Health score', icon: 'analytics-01', value: Math.round(health.score), format: 'number', badge: health.rank, badgeTone: 'pine' },
    { label: 'Day streak', icon: 'fire', value: userStats.currentStreak, format: 'number', badge: `best ${userStats.longestStreak}`, badgeTone: 'butter' },
    { label: 'Savings rate', icon: 'piggy-bank', value: metrics.savingsRate * 100, format: 'percent' },
  ];

  const handleClaimSprint = (sprintId: string, xpReward: number) => {
    fireConfetti({ particleCount: 80, spread: 70 });
    toast.success(`Mission Accomplished! Claimed +${xpReward} XP! 🏆`);
    setActiveSprints(activeSprints.filter(item => item.id !== sprintId));
  };

  // Filtered badges for the Trophy Room
  const filteredBadges = useMemo(() => {
    return badges.filter(badge => {
      if (badgeFilter === 'unlocked' && !badge.unlocked) return false;
      if (badgeFilter === 'locked' && badge.unlocked) return false;
      if (badgeGroupFilter !== 'all' && badge.group !== badgeGroupFilter) return false;
      return true;
    });
  }, [badges, badgeFilter, badgeGroupFilter]);

  const unlockedBadgesCount = useMemo(() => badges.filter(b => b.unlocked).length, [badges]);

  // Record metrics
  const peakValue = records.rows[0]?.value ?? currentNetWorth;
  const peakPct = peakValue > 0 ? Math.min(100, (currentNetWorth / peakValue) * 100) : 100;
  const peakDiff = Math.max(0, peakValue - currentNetWorth);

  return (
    <div className="space-y-5 pb-8 max-md:space-y-4">
      <PageHeader
        title="Challenges & Levels"
        stats={stats}
        actions={tab === 'predictions' ? <Button icon="add-01" onPress={() => setPredicting(true)}>New prediction</Button> : undefined}
      />
      <SegmentedControl scrollable items={TABS} activeId={tab} onChange={setTab} />

      {/* TAB 1: SCORE & LEVEL */}
      {tab === 'score' && (
        <div className="space-y-4">
          {/* RPG Player Level Banner */}
          <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-primary/25 bg-gradient-to-r from-primary-soft via-surface-card to-surface-card p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/40 bg-surface-card text-2xl shadow-md">
                  {tier.badge}
                  <span className="absolute -bottom-1.5 -right-1 rounded-full bg-primary px-1.5 py-0.2 text-[9px] font-black text-white">
                    Lv.{playerLevel}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Financial Tier</span>
                    <Badge tone={tier.badgeTone}>{tier.title}</Badge>
                  </div>
                  <h3 className="type-card-title text-ink text-base mt-0.5">Level {playerLevel}</h3>
                  <p className="type-caption text-muted text-xs">
                    {totalXp.toLocaleString()} Total XP accumulated across habits and quests.
                  </p>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="w-full sm:max-w-xs">
                <div className="flex items-center justify-between text-xs font-medium mb-1">
                  <span className="text-ink font-semibold">{currentLevelXp} / 500 XP</span>
                  <span className="text-muted">+{xpToNextLevel} XP to Level {playerLevel + 1}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-inset border border-line">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-chart-4 transition-[width] duration-700"
                    style={{ width: `${levelProgressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Health Score & Flaming Streak Grid */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* Health Score */}
            <section aria-label="Health score" className={`${CARD} flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left lg:col-span-2`}>
              <ProgressRing value={health.score} tone={health.score >= 50 ? 'pine' : 'amber'} label={String(Math.round(health.score))} caption="of 100" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="type-caption text-muted">Financial Health</span>
                  <Badge tone={health.score >= 50 ? 'positive' : 'neutral'}>{health.rank}</Badge>
                </div>
                <h3 className="type-card-title text-ink mt-0.5 text-base">{health.rank}</h3>
                <p className="type-caption mt-1 text-muted text-xs leading-relaxed">
                  Evaluated from your savings velocity, liquidity runway, debt control, and asset diversification.
                </p>
              </div>
            </section>

            {/* Flaming Streak Card */}
            <section aria-label="Streak" className={`${CARD} relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-surface-card to-surface-card border-amber-500/25`}>
              <div className="flex items-center justify-between">
                <span className="type-caption text-amber-500 font-semibold uppercase tracking-wider text-[11px]">Activity Streak</span>
                <span className="text-lg">🔥</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="type-figure-lg text-ink font-black text-2xl">{userStats.currentStreak}</p>
                <span className="text-xs font-semibold text-amber-500">Days on Fire!</span>
              </div>
              <p className="type-caption text-muted text-xs mt-0.5">Best record: {userStats.longestStreak} consecutive days.</p>

              {/* Milestone Progress */}
              <div className="mt-3 border-t border-line pt-2.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink font-medium truncate text-[11px]">{streakMilestone.label}</span>
                  <span className="text-muted font-mono text-[11px]">{streakMilestone.current}/{streakMilestone.max}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-inset">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (streakMilestone.current / streakMilestone.max) * 100)}%` }}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* 4 Health Factors */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {health.factors.map(factor => (
              <section key={factor.id} aria-label={factor.label} className={CARD}>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-inset text-muted">
                    <Icon name={factor.icon} size={15} />
                  </span>
                  <span className="type-figure-row text-ink font-semibold text-sm">
                    {factor.score.toFixed(0)} <span className="type-caption text-muted font-normal text-[11px]">/ {factor.max}</span>
                  </span>
                </div>
                <h4 className="type-body-strong mt-2 text-ink text-xs truncate">{factor.label}</h4>
                <p className="type-caption mb-1.5 text-muted text-[11px] truncate">{factor.value}</p>
                <Meter percent={(factor.score / factor.max) * 100} />
              </section>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TROPHY ROOM (BADGES) - COMPACT 3 COLUMNS */}
      {tab === 'badges' && (
        <div className="space-y-4">
          {/* Trophy Room Filter Bar */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBadgeFilter('all')}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${badgeFilter === 'all' ? 'bg-primary text-white' : 'bg-inset text-muted hover:text-ink'}`}
              >
                All ({badges.length})
              </button>
              <button
                type="button"
                onClick={() => setBadgeFilter('unlocked')}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${badgeFilter === 'unlocked' ? 'bg-emerald-500 text-white' : 'bg-inset text-muted hover:text-ink'}`}
              >
                Unlocked ({unlockedBadgesCount})
              </button>
              <button
                type="button"
                onClick={() => setBadgeFilter('locked')}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${badgeFilter === 'locked' ? 'bg-slate-600 text-white' : 'bg-inset text-muted hover:text-ink'}`}
              >
                Locked ({badges.length - unlockedBadgesCount})
              </button>
            </div>

            {/* Group category filter */}
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted text-[11px]">Group:</span>
              <button
                type="button"
                onClick={() => setBadgeGroupFilter('all')}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${badgeGroupFilter === 'all' ? 'bg-inset text-ink font-bold' : 'text-muted hover:text-ink'}`}
              >
                All
              </button>
              {BADGE_GROUPS.map(group => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setBadgeGroupFilter(group)}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${badgeGroupFilter === group ? 'bg-inset text-ink font-bold' : 'text-muted hover:text-ink'}`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Trophy Badges Grid - 3 Columns */}
          <ul className={GRID}>
            {filteredBadges.map(badge => {
              const { rarity, glowClass, textColor, badgeTone } = getBadgeRarity(badge.id);
              return (
                <li
                  key={badge.id}
                  onClick={() => setInspectingBadge(badge)}
                  className={`${CARD} cursor-pointer group flex flex-col justify-between ${badge.unlocked ? glowClass : 'opacity-85'}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${badge.unlocked ? 'bg-surface-card border border-primary/30 shadow-sm' : 'bg-inset text-muted'}`}>
                        <Icon
                          name={badge.unlocked ? badge.icon : 'square-lock-02'}
                          size={18}
                          className={badge.unlocked ? textColor : 'text-muted'}
                        />
                      </span>
                      <div className="flex items-center gap-1">
                        <Badge tone={badgeTone}>{rarity.toUpperCase()}</Badge>
                        {badge.unlocked && (
                          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                            <Icon name="tick-02" size={10} />
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="type-body-strong text-ink group-hover:text-primary transition-colors text-xs sm:text-sm truncate">
                      {badge.title}
                    </h4>
                    <p className="type-caption text-muted mt-0.5 text-xs line-clamp-2 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-line">
                    <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                      <span>{badge.group}</span>
                      <span>{badge.unlocked ? 'Unlocked 🏆' : `${Math.round(badge.progress)}%`}</span>
                    </div>
                    {!badge.unlocked && <Meter percent={badge.progress} color="var(--primary)" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* TAB 3: MISSIONS & SPRINTS - COMPACT 3 COLUMNS */}
      {tab === 'sprints' && (
        <div className="space-y-5">
          {/* Active Missions */}
          {sprints.length > 0 && (
            <section aria-label="Active missions">
              <Heading aside={`${sprints.length} in play`}>Active Missions</Heading>
              <div className={GRID}>
                {sprints.map(sprint => {
                  const { stars, xp, difficultyLabel } = getSprintDifficulty(sprint.id);
                  const isDone = sprint.status === 'completed';
                  const isFailed = sprint.status === 'failed';

                  return (
                    <article
                      key={sprint.id}
                      className={`${CARD} flex flex-col justify-between ${isDone ? 'ring-2 ring-emerald-500/50 bg-emerald-500/5' : isFailed ? 'border-rose-500/30' : ''}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-amber-400">
                              {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                            </span>
                            <span className="text-[10px] font-medium text-muted">• {difficultyLabel}</span>
                          </div>
                          <Badge tone={isDone ? 'positive' : isFailed ? 'negative' : 'blue'}>
                            {isDone ? 'Accomplished! 🏆' : isFailed ? 'Missed' : `${sprint.daysLeft}d left`}
                          </Badge>
                        </div>

                        <h4 className="type-body-strong text-ink mt-1.5 text-sm truncate">{sprint.title}</h4>
                        <p className="type-caption text-muted mt-0.5 text-xs line-clamp-2">{sprint.description}</p>

                        {/* Progress */}
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted">Time Elapsed</span>
                            <span className="text-ink font-semibold">{sprint.daysLeft === 0 ? 'Completed' : `${sprint.daysLeft} days left`}</span>
                          </div>
                          <Meter percent={sprint.timeProgress} />

                          {sprint.targetType !== 'transaction_limit' && (
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="text-muted">Spent so far</span>
                              <span className="text-ink font-medium">
                                <InMain value={sprint.spent} /> {sprint.limitAmount > 0 ? <span className="text-muted">/ <InMain value={sprint.limitAmount} /></span> : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-3.5 pt-2.5 border-t border-line flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">+{xp} XP</span>
                        {isDone ? (
                          <Button
                            variant="primary"
                            size="sm"
                            icon="sparkles"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onPress={() => handleClaimSprint(sprint.id, xp)}
                          >
                            Claim Victory! 🎉
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => setActiveSprints(activeSprints.filter(item => item.id !== sprint.id))}
                          >
                            {isFailed ? 'Clear' : 'Abandon'}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Available Quests to Accept - 3 Columns */}
          <section aria-label="Available missions">
            <Heading aside="Take on a new challenge">Available Quests</Heading>
            <div className={GRID}>
              {SPRINTS.filter(sprint => !activeSprints.some(item => item.id === sprint.id)).map(sprint => {
                const { stars, xp, difficultyLabel } = getSprintDifficulty(sprint.id);
                return (
                  <article key={sprint.id} className={`${CARD} flex flex-col justify-between group`}>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-amber-400">
                            {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                          </span>
                          <span className="text-[10px] font-medium text-muted">• {difficultyLabel}</span>
                        </div>
                        <span className="rounded-full bg-inset px-1.5 py-0.2 text-[10px] font-bold text-ink">
                          {sprint.durationDays}d
                        </span>
                      </div>

                      <h4 className="type-body-strong text-ink group-hover:text-primary transition-colors text-sm truncate">
                        {sprint.title}
                      </h4>
                      <p className="type-caption text-muted mt-0.5 text-xs line-clamp-2 leading-relaxed">{sprint.description}</p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">+{xp} XP</span>
                      <Button
                        variant="primary"
                        size="sm"
                        icon="play"
                        onPress={() => {
                          setActiveSprints([...activeSprints, { id: sprint.id, startDate: today }]);
                          toast.success(`Quest Accepted: ${sprint.title}! 🚀`);
                        }}
                      >
                        Accept Quest
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: BUDGET MASTERY - COMPACT 3 COLUMNS */}
      {tab === 'budgets' && (
        mastery.length === 0 ? (
          <EmptyState icon="sliders-horizontal" title="No budgets yet" description="Create a budget, and each one earns a level by how little of its limit you use." />
        ) : (
          <ul className={GRID}>
            {mastery.map(row => {
              const medal = row.level === 4 ? '🥇' : row.level === 3 ? '🥈' : row.level === 2 ? '🥉' : '🎖️';
              return (
                <li key={row.categoryName} className={CARD}>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm">{medal}</span>
                      <span className="type-body-strong truncate text-ink text-sm">{row.categoryName}</span>
                    </div>
                    <Badge tone={row.level === 0 ? 'negative' : row.level === 4 ? 'positive' : 'neutral'}>
                      {row.title}
                    </Badge>
                  </div>
                  <p className="type-caption mt-1.5 text-muted text-xs">
                    <InMain value={row.spent} /> of <InMain value={row.amount} />
                    {row.level > 0 ? `, level ${row.level} of 4` : ''}
                  </p>
                  <div className="mt-2">
                    <Meter percent={row.ratio * 100} color={row.ratio > 1 ? 'var(--money-out)' : 'var(--primary)'} />
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {/* TAB 5: DEBTS & GOALS - ELEVATED DESIGN WITH 3 COLUMNS */}
      {tab === 'progress' && (
        progress.debts.length === 0 && progress.savings.length === 0 ? (
          <EmptyState icon="checkmark-circle-02" title="All quiet" description="You have no debts or open goals to work through right now." />
        ) : (
          <div className="space-y-6">
            {/* Dual Summary Progress Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {progress.debts.length > 0 && (
                <div className="surface-card rounded-[var(--radius-xl)] border border-chart-2/30 bg-gradient-to-br from-chart-2/10 via-surface-card to-surface-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-chart-2/20 text-chart-2">
                        <Icon name="credit-card" size={16} />
                      </span>
                      <span className="type-body-strong text-ink text-sm">Debt Elimination</span>
                    </div>
                    <Badge tone="pine">{debtsSummary.paidPct.toFixed(0)}% Slashed</Badge>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="type-caption text-muted text-xs">Remaining Balance</span>
                      <p className="type-figure-row text-ink font-bold text-lg"><InMain value={debtsSummary.totalRemaining} /></p>
                    </div>
                    <div className="text-right">
                      <span className="type-caption text-muted text-xs">Total Slashed</span>
                      <p className="type-figure-row text-emerald-500 font-bold text-lg">+<InMain value={debtsSummary.totalPaid} /></p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <Meter percent={debtsSummary.paidPct} color="var(--chart-2)" />
                  </div>
                </div>
              )}

              {progress.savings.length > 0 && (
                <div className="surface-card rounded-[var(--radius-xl)] border border-primary/30 bg-gradient-to-br from-primary/10 via-surface-card to-surface-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                        <Icon name="piggy-bank" size={16} />
                      </span>
                      <span className="type-body-strong text-ink text-sm">Savings Goals</span>
                    </div>
                    <Badge tone="positive">{savingsSummary.fundedPct.toFixed(0)}% Funded</Badge>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="type-caption text-muted text-xs">Total Saved</span>
                      <p className="type-figure-row text-money-in font-bold text-lg"><InMain value={savingsSummary.totalFunded} /></p>
                    </div>
                    <div className="text-right">
                      <span className="type-caption text-muted text-xs">Target Total</span>
                      <p className="type-figure-row text-ink font-bold text-lg"><InMain value={savingsSummary.totalTarget} /></p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <Meter percent={savingsSummary.fundedPct} color="var(--money-in)" />
                  </div>
                </div>
              )}
            </div>

            {/* Debts Grid in 3 Columns */}
            {progress.debts.length > 0 && (
              <section aria-label="Debts">
                <Heading aside={`${progress.debts.length} active`}>Debts in Progress</Heading>
                <div className={GRID}>
                  {progress.debts.map(debt => {
                    const paidPct = debt.total > 0 ? (1 - debt.remaining / debt.total) * 100 : 100;
                    return (
                      <article key={debt.id} className={`${CARD} flex flex-col justify-between`}>
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="type-body-strong truncate text-ink text-sm font-semibold">{debt.name}</h4>
                            <Badge tone={paidPct >= 50 ? 'positive' : 'blue'}>{paidPct.toFixed(0)}% Paid</Badge>
                          </div>
                          
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="type-figure-row text-ink font-bold text-base">
                              <InMain value={debt.remaining} />
                            </span>
                            <span className="type-caption text-muted text-xs">
                              of <InMain value={debt.total} />
                            </span>
                          </div>

                          <div className="mt-2">
                            <Meter percent={paidPct} color="var(--chart-2)" />
                          </div>

                          {/* Breakdown chips */}
                          {(debt.paidPrincipal > 0 || debt.paidInterest > 0) && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-muted">
                              {debt.paidPrincipal > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-inset px-1.5 py-0.5">
                                  <Icon name="tick-02" size={11} className="text-emerald-500" />
                                  <span>Principal: <InMain value={debt.paidPrincipal} /></span>
                                </span>
                              )}
                              {debt.paidInterest > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-inset px-1.5 py-0.5">
                                  <Icon name="coins-01" size={11} />
                                  <span>Interest: <InMain value={debt.paidInterest} /></span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Recent Payment History */}
                        {debt.payments.length > 0 && (
                          <div className="mt-3 border-t border-line pt-2">
                            <span className="type-caption text-muted text-[10px] uppercase font-semibold">Recent Payments</span>
                            <ul className="mt-1 space-y-0.5">
                              {debt.payments.slice(0, 3).map(payment => (
                                <li key={`${payment.date}${payment.amount}`} className="type-caption flex justify-between gap-2 text-muted text-[11px]">
                                  <span>{shortDate(payment.date)}</span>
                                  <span className="font-medium text-ink"><InMain value={payment.amount} /></span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Savings Goals Grid in 3 Columns */}
            {progress.savings.length > 0 && (
              <section aria-label="Savings goals">
                <Heading aside={`${progress.savings.length} active`}>Savings Goals</Heading>
                <div className={GRID}>
                  {progress.savings.map(goal => {
                    const funded = Math.max(0, goal.total - goal.remaining);
                    const fundedPct = goal.total > 0 ? (funded / goal.total) * 100 : 0;
                    return (
                      <article key={goal.id} className={`${CARD} flex flex-col justify-between`}>
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="type-body-strong truncate text-ink text-sm font-semibold">{goal.name}</h4>
                            <Badge tone={fundedPct >= 75 ? 'positive' : fundedPct >= 40 ? 'blue' : 'neutral'}>
                              {fundedPct.toFixed(0)}% Funded
                            </Badge>
                          </div>

                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="type-figure-row text-money-in font-bold text-base">
                              <InMain value={funded} />
                            </span>
                            <span className="type-caption text-muted text-xs">
                              goal <InMain value={goal.total} />
                            </span>
                          </div>

                          <div className="mt-2">
                            <Meter percent={fundedPct} color="var(--money-in)" />
                          </div>

                          <p className="type-caption mt-2 text-muted text-[11px]">
                            <InMain value={goal.remaining} /> remaining to hit your target.
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )
      )}

      {/* TAB 6: PREDICTIONS - COMPACT 3 COLUMNS */}
      {tab === 'predictions' && (
        predictions.length === 0 ? (
          <EmptyState
            icon="target-01"
            title="No predictions yet"
            description="Bet on your own spending, net worth or a holding's price, and see how you do."
            actionLabel="New prediction"
            onAction={() => setPredicting(true)}
          />
        ) : (
          <div className={GRID}>
            {predictions.map(prediction => (
              <PredictionCard
                key={prediction.id}
                prediction={prediction}
                value={predictionValue(prediction, predictionContext)}
                currency={priceCurrency(prediction)}
                onDelete={deletePrediction}
              />
            ))}
          </div>
        )
      )}

      {/* TAB 7: RECORDS - ELEVATED DESIGN WITH MONUMENTS & TRAJECTORY */}
      {tab === 'records' && (
        <div className="space-y-4">
          {/* Hero Peak Trophy Showcase */}
          <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-surface-card to-surface-card p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-400/40 bg-surface-card text-2xl shadow-md">
                  🏆
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Hall of Records</span>
                    {records.isNewRecord && <Badge tone="butter">All-Time Peak Today 🌟</Badge>}
                  </div>
                  <h3 className="type-page-title text-ink text-xl sm:text-2xl mt-0.5">
                    <InMain value={peakValue} />
                  </h3>
                  <p className="type-caption text-muted text-xs">
                    {records.rows[0]?.detail ?? 'Your peak financial summit'}
                  </p>
                </div>
              </div>

              {/* Status / Celebration Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {records.isNewRecord ? (
                  <Button
                    variant="primary"
                    icon="sparkles"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                    onPress={() => {
                      fireConfetti({ particleCount: 90, spread: 75 });
                      toast.success('Congratulations on your all-time record high! 🏆');
                    }}
                  >
                    Celebrate Record! 🎉
                  </Button>
                ) : (
                  <div className="w-full sm:w-48 text-right">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted text-[11px]">Distance to Peak</span>
                      <span className="text-amber-500 font-bold font-mono text-xs">{peakPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-inset border border-line">
                      <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${peakPct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted mt-1 block">
                      +<InMain value={peakDiff} /> to set a new record
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3 Personal Best Monument Cards (3 Columns) */}
          <div className={GRID}>
            {/* Monument 1: All-Time Peak */}
            <article className={`${CARD} border-amber-500/30 bg-amber-500/5 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="type-caption text-amber-500 font-semibold uppercase tracking-wider text-[11px]">Summit</span>
                  <span className="text-base">🥇</span>
                </div>
                <h4 className="type-body-strong text-ink text-sm">All-Time Peak</h4>
                <p className="type-figure-row text-ink font-bold text-xl mt-1.5"><InMain value={peakValue} /></p>
              </div>
              <p className="type-caption text-muted text-[11px] mt-3 border-t border-line pt-2">
                {records.rows[0]?.detail}
              </p>
            </article>

            {/* Monument 2: Today's Standing */}
            <article className={`${CARD} flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="type-caption text-primary font-semibold uppercase tracking-wider text-[11px]">Current</span>
                  <span className="text-base">📍</span>
                </div>
                <h4 className="type-body-strong text-ink text-sm">Today's Standing</h4>
                <p className="type-figure-row text-ink font-bold text-xl mt-1.5"><InMain value={currentNetWorth} /></p>
              </div>
              <div className="mt-3 border-t border-line pt-2 flex items-center justify-between text-[11px]">
                <span className="text-muted">From the Peak</span>
                <span className={`font-semibold ${peakDiff === 0 ? 'text-emerald-500' : 'text-muted'}`}>
                  {peakDiff === 0 ? 'At the high 🏆' : <>−<InMain value={peakDiff} /> ({((currentNetWorth - peakValue) / (peakValue || 1) * 100).toFixed(1)}%)</>}
                </span>
              </div>
            </article>

            {/* Monument 3: 1 Year Ago */}
            {records.rows[2] ? (
              <article className={`${CARD} flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="type-caption text-muted font-semibold uppercase tracking-wider text-[11px]">Historical</span>
                    <span className="text-base">📅</span>
                  </div>
                  <h4 className="type-body-strong text-ink text-sm">One Year Ago</h4>
                  <p className="type-figure-row text-ink font-bold text-xl mt-1.5"><InMain value={records.rows[2].value} /></p>
                </div>
                <div className="mt-3 border-t border-line pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-muted">12-Month Net Growth</span>
                  {records.rows[2].changePct !== undefined && (
                    <span className={`font-semibold ${records.rows[2].changePct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {records.rows[2].changePct >= 0 ? '+' : '−'}{Math.abs(records.rows[2].changePct).toFixed(1)}% YoY
                    </span>
                  )}
                </div>
              </article>
            ) : (
              <article className={`${CARD} flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="type-caption text-muted font-semibold uppercase tracking-wider text-[11px]">Milestone</span>
                    <span className="text-base">🌱</span>
                  </div>
                  <h4 className="type-body-strong text-ink text-sm">First Year Journey</h4>
                  <p className="type-caption text-muted text-xs mt-1.5">You are writing your first year of history on Crystal.</p>
                </div>
                <p className="type-caption text-muted text-[11px] mt-3 border-t border-line pt-2">Keep building records!</p>
              </article>
            )}
          </div>

          {/* 12-Month Momentum Journey Strip */}
          {netWorthPoints.length > 1 && (
            <section className={CARD}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="type-body-strong text-ink text-sm">12-Month Trajectory</h4>
                  <p className="type-caption text-muted text-xs">Walked back across your monthly ledger snapshots</p>
                </div>
                <span className="type-caption text-muted text-xs">60-Month Historical Range</span>
              </div>

              {/* Monthly mini sparkline bars */}
              <div className="grid grid-cols-12 items-end gap-1.5 sm:gap-2 h-20 pt-2 pb-1 border-t border-line">
                {netWorthPoints.slice(0, 12).reverse().map((point, index) => {
                  const points12 = netWorthPoints.slice(0, 12);
                  const maxPt = Math.max(...points12.map(p => p.value), 1);
                  const minPt = Math.min(...points12.map(p => p.value), 0);
                  const range = Math.max(1, maxPt - minPt);
                  const heightPct = Math.max(15, ((point.value - minPt) / range) * 100);
                  const isLatest = index === 11;

                  return (
                    <div
                      key={point.date}
                      className="flex flex-col items-center gap-1 group cursor-pointer"
                      title={`${point.date}: ${point.value.toFixed(0)}`}
                    >
                      <div
                        className={`w-full rounded-t transition-all duration-300 group-hover:opacity-100 ${isLatest ? 'bg-amber-500' : 'bg-primary/50 group-hover:bg-primary'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[9px] text-muted truncate max-w-[24px]">
                        {point.date.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Prediction Modal */}
      {isPredicting && (
        <PredictionModal
          onClose={() => setPredicting(false)}
          onSave={savePrediction}
          accounts={accounts}
          expenseCategories={expenseCategories}
          investmentTransactions={investmentTransactions}
          warrants={warrants}
        />
      )}

      {/* Badge Inspection Modal */}
      <BadgeInspectModal
        badge={inspectingBadge}
        onClose={() => setInspectingBadge(null)}
      />
    </div>
  );
};

export default Challenges;

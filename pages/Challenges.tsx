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

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line transition-all duration-200 hover:border-line-strong';
const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 min-[1100px]:grid-cols-3';

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
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <h2 className="type-card-title text-ink">{children}</h2>
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
  const records = useMemo(() => {
    const { current, history } = netWorthHistory(accounts, transactions, now);
    return personalRecords(current, history);
  }, [accounts, transactions, now]);

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

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Challenges & Levels"
        stats={stats}
        actions={tab === 'predictions' ? <Button icon="add-01" onPress={() => setPredicting(true)}>New prediction</Button> : undefined}
      />
      <SegmentedControl scrollable items={TABS} activeId={tab} onChange={setTab} />

      {/* TAB 1: SCORE & LEVEL */}
      {tab === 'score' && (
        <div className="space-y-5">
          {/* RPG Player Level Banner */}
          <section className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-primary/25 bg-gradient-to-r from-primary-soft via-surface-card to-surface-card p-6 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/40 bg-surface-card text-3xl shadow-lg">
                  {tier.badge}
                  <span className="absolute -bottom-2 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-white">
                    Lv.{playerLevel}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Financial Tier</span>
                    <Badge tone={tier.badgeTone}>{tier.title}</Badge>
                  </div>
                  <h2 className="type-page-title text-ink mt-0.5">Level {playerLevel}</h2>
                  <p className="type-caption text-muted">
                    {totalXp.toLocaleString()} Total XP accumulated across savings, streaks, and missions.
                  </p>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="w-full sm:max-w-xs">
                <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                  <span className="text-ink font-semibold">{currentLevelXp} / 500 XP</span>
                  <span className="text-muted">+{xpToNextLevel} XP to Level {playerLevel + 1}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-inset border border-line">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-chart-4 transition-[width] duration-700"
                    style={{ width: `${levelProgressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Health Score & Flaming Streak Grid */}
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
            {/* Health Score */}
            <section aria-label="Health score" className={`${CARD} flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left min-[900px]:col-span-2`}>
              <ProgressRing value={health.score} tone={health.score >= 50 ? 'pine' : 'amber'} label={String(Math.round(health.score))} caption="of 100" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="type-caption text-muted">Financial Health</span>
                  <Badge tone={health.score >= 50 ? 'positive' : 'neutral'}>{health.rank}</Badge>
                </div>
                <h3 className="type-page-title text-ink mt-1">{health.rank}</h3>
                <p className="type-body mt-1 text-muted text-sm">
                  Calculated from your saving velocity, liquidity buffer, debt management, and asset distribution.
                </p>
              </div>
            </section>

            {/* Flaming Streak Card */}
            <section aria-label="Streak" className={`${CARD} relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-surface-card to-surface-card border-amber-500/25`}>
              <div className="flex items-center justify-between">
                <span className="type-caption text-amber-500 font-semibold uppercase tracking-wider">Activity Streak</span>
                <span className="text-xl">🔥</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="type-figure-lg text-ink font-black">{userStats.currentStreak}</p>
                <span className="text-sm font-semibold text-amber-500">Days on Fire!</span>
              </div>
              <p className="type-caption text-muted mt-1">Best record: {userStats.longestStreak} consecutive days.</p>

              {/* Milestone Progress */}
              <div className="mt-4 border-t border-line pt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink font-medium truncate">{streakMilestone.label}</span>
                  <span className="text-muted font-mono">{streakMilestone.current}/{streakMilestone.max}</span>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1100px]:grid-cols-4">
            {health.factors.map(factor => (
              <section key={factor.id} aria-label={factor.label} className={CARD}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-inset text-muted">
                    <Icon name={factor.icon} size={18} />
                  </span>
                  <span className="type-figure-row text-ink font-semibold">
                    {factor.score.toFixed(0)} <span className="type-caption text-muted font-normal">of {factor.max}</span>
                  </span>
                </div>
                <h4 className="type-body-strong mt-3 text-ink">{factor.label}</h4>
                <p className="type-caption mb-2 text-muted">{factor.value}</p>
                <Meter percent={(factor.score / factor.max) * 100} />
              </section>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TROPHY ROOM (BADGES) */}
      {tab === 'badges' && (
        <div className="space-y-6">
          {/* Trophy Room Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBadgeFilter('all')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${badgeFilter === 'all' ? 'bg-primary text-white' : 'bg-inset text-muted hover:text-ink'}`}
              >
                All ({badges.length})
              </button>
              <button
                type="button"
                onClick={() => setBadgeFilter('unlocked')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${badgeFilter === 'unlocked' ? 'bg-emerald-500 text-white' : 'bg-inset text-muted hover:text-ink'}`}
              >
                Unlocked ({unlockedBadgesCount})
              </button>
              <button
                type="button"
                onClick={() => setBadgeFilter('locked')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${badgeFilter === 'locked' ? 'bg-slate-600 text-white' : 'bg-inset text-muted hover:text-ink'}`}
              >
                In Progress ({badges.length - unlockedBadgesCount})
              </button>
            </div>

            {/* Group category filter */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Group:</span>
              <button
                type="button"
                onClick={() => setBadgeGroupFilter('all')}
                className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${badgeGroupFilter === 'all' ? 'bg-inset text-ink font-bold' : 'text-muted hover:text-ink'}`}
              >
                All
              </button>
              {BADGE_GROUPS.map(group => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setBadgeGroupFilter(group)}
                  className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${badgeGroupFilter === group ? 'bg-inset text-ink font-bold' : 'text-muted hover:text-ink'}`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Trophy Badges Grid */}
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
                    <div className="flex items-center justify-between mb-3">
                      <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${badge.unlocked ? 'bg-surface-card border border-primary/30 shadow-md' : 'bg-inset text-muted'}`}>
                        <Icon
                          name={badge.unlocked ? badge.icon : 'square-lock-02'}
                          size={24}
                          className={badge.unlocked ? textColor : 'text-muted'}
                        />
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={badgeTone}>{rarity.toUpperCase()}</Badge>
                        {badge.unlocked && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                            <Icon name="tick-02" size={12} />
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="type-body-strong text-ink group-hover:text-primary transition-colors">
                      {badge.title}
                    </h4>
                    <p className="type-caption text-muted mt-1 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line">
                    <div className="flex items-center justify-between text-xs text-muted mb-1">
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

      {/* TAB 3: MISSIONS & SPRINTS */}
      {tab === 'sprints' && (
        <div className="space-y-6">
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
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-amber-400">
                              {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                            </span>
                            <span className="text-[11px] font-medium text-muted">• {difficultyLabel}</span>
                          </div>
                          <Badge tone={isDone ? 'positive' : isFailed ? 'negative' : 'blue'}>
                            {isDone ? 'Accomplished! 🏆' : isFailed ? 'Missed' : `${sprint.daysLeft}d left`}
                          </Badge>
                        </div>

                        <h4 className="type-body-strong text-ink mt-2 text-base">{sprint.title}</h4>
                        <p className="type-caption text-muted mt-1">{sprint.description}</p>

                        {/* Progress */}
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted">Time Elapsed</span>
                            <span className="text-ink font-semibold">{sprint.daysLeft === 0 ? 'Completed' : `${sprint.daysLeft} days left`}</span>
                          </div>
                          <Meter percent={sprint.timeProgress} />

                          {sprint.targetType !== 'transaction_limit' && (
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-muted">Spent so far</span>
                              <span className="text-ink font-medium">
                                <InMain value={sprint.spent} /> {sprint.limitAmount > 0 ? <span className="text-muted">/ <InMain value={sprint.limitAmount} /> limit</span> : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">+{xp} XP Bounty</span>
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

          {/* Available Quests to Accept */}
          <section aria-label="Available missions">
            <Heading aside="Take on a new challenge">Available Quests</Heading>
            <div className={GRID}>
              {SPRINTS.filter(sprint => !activeSprints.some(item => item.id === sprint.id)).map(sprint => {
                const { stars, xp, difficultyLabel } = getSprintDifficulty(sprint.id);
                return (
                  <article key={sprint.id} className={`${CARD} flex flex-col justify-between group`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-amber-400">
                            {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                          </span>
                          <span className="text-[11px] font-medium text-muted">• {difficultyLabel}</span>
                        </div>
                        <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-bold text-ink">
                          {sprint.durationDays} {sprint.durationDays === 1 ? 'day' : 'days'}
                        </span>
                      </div>

                      <h4 className="type-body-strong text-ink group-hover:text-primary transition-colors text-base">
                        {sprint.title}
                      </h4>
                      <p className="type-caption text-muted mt-1 leading-relaxed">{sprint.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
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

      {/* TAB 4: BUDGET MASTERY */}
      {tab === 'budgets' && (
        mastery.length === 0 ? (
          <EmptyState icon="sliders-horizontal" title="No budgets yet" description="Create a budget, and each one earns a level by how little of its limit you use." />
        ) : (
          <ul className={GRID}>
            {mastery.map(row => {
              const medal = row.level === 4 ? '🥇' : row.level === 3 ? '🥈' : row.level === 2 ? '🥉' : '🎖️';
              return (
                <li key={row.categoryName} className={CARD}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{medal}</span>
                      <span className="type-body-strong truncate text-ink">{row.categoryName}</span>
                    </div>
                    <Badge tone={row.level === 0 ? 'negative' : row.level === 4 ? 'positive' : 'neutral'}>
                      {row.title}
                    </Badge>
                  </div>
                  <p className="type-caption mt-2 text-muted">
                    <InMain value={row.spent} /> spent of <InMain value={row.amount} />
                    {row.level > 0 ? `, level ${row.level} of 4` : ''}
                  </p>
                  <div className="mt-2.5">
                    <Meter percent={row.ratio * 100} color={row.ratio > 1 ? 'var(--money-out)' : 'var(--primary)'} />
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {/* TAB 5: DEBTS & GOALS */}
      {tab === 'progress' && (
        progress.debts.length === 0 && progress.savings.length === 0 ? (
          <EmptyState icon="checkmark-circle-02" title="All quiet" description="You have no debts or open goals to work through right now." />
        ) : (
          <div className="space-y-6">
            {progress.debts.length > 0 && (
              <section aria-label="Debts">
                <Heading>Debts in Progress</Heading>
                <div className={GRID}>
                  {progress.debts.map(debt => (
                    <article key={debt.id} className={CARD}>
                      <h4 className="type-body-strong truncate text-ink">{debt.name}</h4>
                      <p className="type-figure-row mt-1 text-ink">
                        <InMain value={debt.remaining} /> <span className="type-caption text-muted">left of <InMain value={debt.total} /></span>
                      </p>
                      <div className="mt-2.5">
                        <Meter percent={(1 - debt.remaining / debt.total) * 100} color="var(--chart-2)" />
                      </div>
                      {debt.paidPrincipal > 0 && (
                        <p className="type-caption mt-2 text-muted">
                          Paid <InMain value={debt.paidPrincipal} /> off the loan and <InMain value={debt.paidInterest} /> in interest.
                        </p>
                      )}
                      {debt.payments.length > 0 && (
                        <ul className="mt-3 space-y-1 border-t border-line pt-2">
                          {debt.payments.map(payment => (
                            <li key={`${payment.date}${payment.amount}`} className="type-caption flex justify-between gap-3 text-muted">
                              <span>{shortDate(payment.date)}</span>
                              <InMain value={payment.amount} />
                            </li>
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
                <Heading>Savings Goals</Heading>
                <div className={GRID}>
                  {progress.savings.map(goal => (
                    <article key={goal.id} className={CARD}>
                      <h4 className="type-body-strong truncate text-ink">{goal.name}</h4>
                      <p className="type-figure-row mt-1 text-ink">
                        <InMain value={goal.remaining} /> <span className="type-caption text-muted">to go of <InMain value={goal.total} /></span>
                      </p>
                      <div className="mt-2.5">
                        <Meter percent={(1 - goal.remaining / goal.total) * 100} color="var(--emerald-500, #10b981)" />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )
      )}

      {/* TAB 6: PREDICTIONS */}
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

      {/* TAB 7: RECORDS */}
      {tab === 'records' && (
        <section aria-label="Records" className={CARD}>
          <Heading aside={records.isNewRecord ? '🌟 All-Time Record High!' : undefined}>
            Your Net Worth Records
          </Heading>
          {records.isNewRecord && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3.5 py-2 text-xs font-semibold text-amber-500">
              <Icon name="sparkles" size={16} />
              <span>Congratulations! Your net worth reached a brand new peak today!</span>
            </div>
          )}
          <ul className="divide-y divide-line">
            {records.rows.map(row => (
              <li key={row.label} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="type-body-strong block truncate text-ink">{row.label}</span>
                  <span className="type-caption block truncate text-muted">{row.detail}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="type-figure-row block text-ink font-semibold"><InMain value={row.value} /></span>
                  {row.changePct !== undefined && (
                    <span className="type-caption block text-muted">
                      {row.changePct >= 0 ? '+' : '−'}{Math.abs(row.changePct).toFixed(1)}%
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
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

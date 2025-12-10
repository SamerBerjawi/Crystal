import React from 'react';
import Card from '../components/Card';

interface ProgressBarProps {
  label: string;
  value: number;
  colorClass?: string;
  helper?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, colorClass = 'bg-primary-500', helper }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-sm font-semibold text-light-text dark:text-dark-text">
      <span>{label}</span>
      <span className="text-light-text-secondary dark:text-dark-text-secondary">{value}%</span>
    </div>
    <div className="h-2 rounded-full bg-light-fill dark:bg-dark-fill overflow-hidden">
      <div
        className={`h-full ${colorClass}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      />
    </div>
    {helper && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{helper}</p>}
  </div>
);

const CircularGauge: React.FC<{ value: number; label: string; helper?: string }> = ({ value, label, helper }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const angle = (clamped / 100) * 360;
  const gaugeGradient = `conic-gradient(#22c55e ${angle}deg, rgba(148,163,184,0.35) 0deg)`;
  const tone = clamped < 50 ? 'text-red-500' : clamped < 80 ? 'text-amber-500' : 'text-green-500';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative w-32 h-32 rounded-full flex items-center justify-center shadow-inner"
        style={{ background: gaugeGradient }}
        role="img"
        aria-label={`${label} is ${clamped}`}
      >
        <div className="w-24 h-24 rounded-full bg-white dark:bg-dark-card flex flex-col items-center justify-center">
          <p className={`text-3xl font-bold ${tone}`}>{clamped}</p>
          <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">/ 100</p>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-light-text dark:text-dark-text">{label}</p>
        {helper && (
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-snug max-w-xs">{helper}</p>
        )}
      </div>
    </div>
  );
};

const Challenges: React.FC = () => {
  const achievements = [
    { title: 'Debt Destroyer', status: 'Unlocked', description: 'Closed out a loan with the final payment last month.' },
    { title: 'Oracle', status: 'In Progress', description: 'Forecast accuracy is at 93% vs. the 95% goal.' },
    { title: 'Safety Net', status: 'Locked', description: 'Build a 3-month liquidity runway to earn this badge.' },
  ];

  const bossBattles = [
    { name: 'Credit Card Titan', progress: 62, helper: '€1,240 remaining on the €3,250 balance' },
    { name: 'Dream Home Down Payment', progress: 35, helper: 'Saved €7,000 of €20,000 target' },
  ];

  const categoryMastery = [
    { name: 'Groceries', level: 3, xp: 68 },
    { name: 'Dining Out', level: 2, xp: 42 },
    { name: 'Transportation', level: 4, xp: 81 },
  ];

  const savingsChallenges = [
    { title: 'No Spend Weekend', duration: '2 days', progress: 100, status: 'Completed' },
    { title: 'The Coffee Break', duration: '7 days', progress: 65, status: 'Active' },
    { title: 'Subscription Audit', duration: '14 days', progress: 20, status: 'Queued' },
  ];

  const predictionMarkets = [
    { category: 'Groceries', prediction: '€320', actual: '€305', result: 'Win' },
    { category: 'Transport', prediction: '€110', actual: '€124', result: 'Tracking' },
    { category: 'Dining Out', prediction: '€180', actual: '€220', result: 'Loss' },
  ];

  const questLog = { progress: 72, remaining: 3 };

  const leaderboard = [
    { label: 'This Month', value: '+€1,240', helper: 'Net worth momentum' },
    { label: 'Best Month Ever', value: '+€1,640', helper: 'June 2023 personal record' },
    { label: 'Last Year', value: '+€980', helper: 'Year-over-year benchmark' },
  ];

  return (
    <div className="p-6 space-y-6 text-light-text dark:text-dark-text">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-sm text-primary-600 dark:text-primary-300 font-semibold">
          <span className="material-symbols-outlined text-xl">stadia_controller</span>
          <span>Gamification Hub</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Challenges</h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-3xl">
            Track streaks, level up categories, and celebrate milestones that make building healthy financial habits feel like a
            game.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="col-span-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
                Daily Clarity Streak
              </p>
              <h2 className="text-3xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">local_fire_department</span>
                12 days
              </h2>
            </div>
            <div className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold dark:bg-amber-500/10 dark:text-amber-200">
              +2 ahead of goal
            </div>
          </div>
          <ProgressBar label="Current week check-ins" value={86} helper="Log or review at least once a day to keep the flame alive." />
          <div className="flex items-center gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>Next milestone: 21-day streak unlocks a limited-time badge.</span>
          </div>
        </Card>

        <Card className="col-span-1 flex flex-col items-center justify-between gap-4">
          <div className="w-full flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
                Financial Health
              </p>
              <h2 className="text-xl font-bold">Crystal Score</h2>
            </div>
            <span className="material-symbols-outlined text-primary-500">insights</span>
          </div>
          <CircularGauge value={78} label="Crystal Score" helper="Powered by savings rate, liquidity ratio, and debt-to-asset mix." />
          <div className="grid grid-cols-3 gap-3 w-full text-sm">
            <div>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">Savings Rate</p>
              <p className="font-semibold">19%</p>
            </div>
            <div>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">Liquidity</p>
              <p className="font-semibold">2.5 months</p>
            </div>
            <div>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">Debt / Assets</p>
              <p className="font-semibold">23%</p>
            </div>
          </div>
        </Card>

        <Card className="col-span-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
                Achievement Badges
              </p>
              <h2 className="text-xl font-bold">Trophy Case</h2>
            </div>
            <span className="material-symbols-outlined text-yellow-500">trophy</span>
          </div>
          <div className="space-y-3">
            {achievements.map((badge) => (
              <div key={badge.title} className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-300">
                  <span className="material-symbols-outlined text-lg">workspace_premium</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{badge.title}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-light-fill dark:bg-dark-fill text-light-text-secondary dark:text-dark-text-secondary font-semibold">
                      {badge.status}
                    </span>
                  </div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Budget Boss Battles</h3>
            <span className="material-symbols-outlined text-rose-500">swords</span>
          </div>
          <div className="space-y-4">
            {bossBattles.map((boss) => (
              <div key={boss.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">shield</span>
                    {boss.name}
                  </p>
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{boss.helper}</span>
                </div>
                <ProgressBar label="" value={boss.progress} colorClass="bg-rose-500" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Category Mastery Levels</h3>
            <span className="material-symbols-outlined text-indigo-500">auto_graph</span>
          </div>
          <div className="space-y-3">
            {categoryMastery.map((category) => (
              <div key={category.name} className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500">
                  <span className="material-symbols-outlined text-base">military_tech</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{category.name} • Lvl {category.level}</p>
                    <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{category.xp} XP</span>
                  </div>
                  <ProgressBar label="" value={category.xp} colorClass="bg-indigo-500" helper="Stay under budget to keep earning XP." />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Savings Challenges</h3>
            <span className="material-symbols-outlined text-emerald-500">flag</span>
          </div>
          <div className="space-y-3">
            {savingsChallenges.map((challenge) => (
              <div key={challenge.title} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-light-fill dark:bg-dark-fill">
                <div>
                  <p className="font-semibold">{challenge.title}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{challenge.duration}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{challenge.status}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{challenge.progress}%</p>
                  </div>
                  <div className="w-20 h-2 rounded-full bg-white/50 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${challenge.progress}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Prediction Markets</h3>
            <span className="material-symbols-outlined text-blue-500">timeline</span>
          </div>
          <div className="space-y-3">
            {predictionMarkets.map((prediction) => (
              <div key={prediction.category} className="p-3 rounded-lg bg-light-fill dark:bg-dark-fill">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{prediction.category}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 font-semibold">
                    {prediction.result}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  <span>Prediction: {prediction.prediction}</span>
                  <span>Actual: {prediction.actual}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Data Cleaning Quest Log</h3>
            <span className="material-symbols-outlined text-purple-500">playlist_add_check</span>
          </div>
          <div className="space-y-3">
            <ProgressBar
              label="Uncategorized transactions cleared"
              value={questLog.progress}
              colorClass="bg-purple-500"
              helper={`Only ${questLog.remaining} remaining to complete this month's quest.`}
            />
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-900 dark:text-purple-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-base">diamond</span>
              <div className="text-sm">
                <p className="font-semibold">Quest Reward</p>
                <p className="text-purple-800/80 dark:text-purple-100/80">Perfect month badge + bonus XP toward Crystal Score.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
              Personal Best Leaderboard
            </p>
            <h3 className="text-lg font-bold">Net Worth vs. Past You</h3>
          </div>
          <span className="material-symbols-outlined text-teal-500">leaderboard</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {leaderboard.map((entry) => (
            <div key={entry.label} className="p-4 rounded-lg bg-light-fill dark:bg-dark-fill">
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{entry.label}</p>
              <p className="text-2xl font-bold">{entry.value}</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{entry.helper}</p>
            </div>
          ))}
        </div>
        <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
          <span className="material-symbols-outlined text-base">emoji_events</span>
          <span>Beat last year and your personal best to unlock the Legendary Saver badge.</span>
        </div>
      </Card>
    </div>
  );
};

export default Challenges;

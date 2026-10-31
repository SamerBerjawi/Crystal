import React, { useMemo, useState } from 'react';
import type { FinancialGoal, GoalCategory } from '../../../types';
import { cn } from '../../../lib/utils';
import { formatShortDate } from '../../../utils/dateFormat';
import { goalCategoryOf } from '../../../utils/forecastModel';
import { accountCoverage, monthlyTargets, projectGoal, summaryRings, type GoalProjectionView, type Ring } from '../../../utils/goalsModel';
import type { ForecastData } from '../../../hooks/useForecastData';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Badge, Button, Card, EmptyState, Money, SegmentedTabs, Switch } from '../ui';
import { RowMenu, type MenuEntry } from '../schedule/parts';

/*
 * Goals tab (docs/FORECASTING_NEW_PLAN.md §4.3): three rings (savings, spending, income; F-07), accounts that can't
 * cover their goals (F-05), the goals with their projection and an "In forecast" switch, and monthly targets (F9).
 * The rings are plain SVG like Budget's: KokonutUI's apple-activity-card was not ported (it colours rings by position;
 * here each ring has a meaning, D2).
 */

export const KIND: Record<GoalCategory, { label: string; icon: NvIconName; stroke: string; track: string; text: string }> = {
  savings: { label: 'Savings', icon: 'piggy', stroke: 'var(--nv-violet)', track: 'var(--nv-violet-soft)', text: 'text-nv-violet-text' },
  expense: { label: 'Spending', icon: 'shoppingBag', stroke: 'var(--nv-orange)', track: 'var(--nv-orange-soft)', text: 'text-nv-orange-text' },
  income: { label: 'Income', icon: 'money', stroke: 'var(--nv-green)', track: 'var(--nv-green-soft)', text: 'text-nv-green-text' },
};

const STATUS: Record<GoalProjectionView['status'], { label: string; tone: 'green' | 'orange' | 'red' | 'neutral'; icon: NvIconName }> = {
  'on-track': { label: 'On track', tone: 'green', icon: 'checkCircle' },
  'at-risk': { label: 'At risk', tone: 'orange', icon: 'warning' },
  'off-track': { label: 'Off track', tone: 'red', icon: 'alert' },
  done: { label: 'Done', tone: 'green', icon: 'check' },
  'no-plan': { label: 'No plan', tone: 'neutral', icon: 'info' },
};

const Rings: React.FC<{ rings: Ring[]; size?: number }> = ({ rings, size = 156 }) => {
  const stroke = 13;
  const shown = rings.filter(r => r.count > 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" role="img" aria-label={shown.map(r => `${r.label} ${Math.round(r.pct)}%`).join(', ')}>
      {shown.map((ring, i) => {
        const r = size / 2 - stroke / 2 - i * (stroke + 5);
        const c = 2 * Math.PI * r;
        const k = KIND[ring.category];
        return (
          <g key={ring.category}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={k.track} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={k.stroke} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(ring.pct > 0 ? 1.5 : 0, ring.pct) / 100)} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000" />
          </g>
        );
      })}
    </svg>
  );
};

const GoalRow: React.FC<{
  goal: FinancialGoal; data: ForecastData; nested?: boolean; menu: MenuEntry[]; onOpen: (g: FinancialGoal) => void;
}> = ({ goal, data, nested, menu, onOpen }) => {
  const kind = KIND[goalCategoryOf(goal)];
  const p = projectGoal(goal, data.today);
  const status = STATUS[p.status];
  const pct = goal.amount > 0 ? Math.min(100, ((goal.currentAmount ?? 0) / goal.amount) * 100) : 0;
  const active = data.activeGoalIds.includes(goal.id);
  const due = goal.type === 'one-time' ? goal.date : goal.endDate;
  return (
    <li className={cn('flex items-center gap-2 rounded-nv-sub pr-1 hover:bg-nv-surface/70', nested && 'ml-6')}>
      <button type="button" onClick={() => onOpen(goal)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-nv-sub py-2 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-nv-ink">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', goal.completed ? 'bg-nv-green-soft text-nv-green-text' : 'bg-nv-surface', !goal.completed && kind.text)} aria-hidden>
          <NvIcon name={goal.completed ? 'check' : kind.icon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-[15px] font-semibold', goal.completed ? 'text-nv-muted line-through' : 'text-nv-ink')}>{goal.name}</span>
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-nv-inset" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: p.status === 'off-track' ? 'var(--nv-red)' : p.status === 'at-risk' ? 'var(--nv-orange)' : kind.stroke }} />
          </span>
          <span className="mt-1 block truncate text-[13px] text-nv-muted">
            <Money amount={goal.currentAmount ?? 0} currency={goal.currency} className="text-[13px]" /> of <Money amount={goal.amount} currency={goal.currency} className="text-[13px]" />
            {due && <> · by {formatShortDate(due, data.today)}</>}
            {p.projectedDate && p.status !== 'done' && <> · projected {formatShortDate(p.projectedDate, data.today)}</>}
            {goal.monthlyContribution ? <> · <Money amount={goal.monthlyContribution} currency={goal.currency} className="text-[13px]" /> {goal.frequency && goal.frequency !== 'monthly' ? `/ ${goal.frequency === 'biweekly' ? '2 weeks' : goal.frequency.replace('ly', '')}` : 'a month'}</> : null}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
            {p.status === 'no-plan' && p.neededMonthly !== undefined && <Badge icon="info"><Money amount={p.neededMonthly} currency={goal.currency} className="text-xs" /> a month needed</Badge>}
            {goal.paymentAccountId && <Badge icon="bank">{data.accountName(goal.paymentAccountId)}{goal.destinationAccountId ? ` → ${data.accountName(goal.destinationAccountId)}` : ''}</Badge>}
          </span>
        </span>
      </button>
      {!goal.completed && <Switch checked={active} onChange={on => data.setActive([goal.id], on)} label={`Include ${goal.name} in the forecast`} />}
      <RowMenu entries={menu} label={`Actions for ${goal.name}`} />
    </li>
  );
};

export const GoalsView: React.FC<{
  data: ForecastData;
  query: string;
  onOpen: (goal: FinancialGoal) => void;
  onAdd: (parentId?: string) => void;
  menuFor: (goal: FinancialGoal, index: number, count: number) => MenuEntry[];
}> = ({ data, query, onOpen, onAdd, menuFor }) => {
  const [by, setBy] = useState<'account' | 'month'>('month');
  const rings = useMemo(() => summaryRings(data.goals, data.convert), [data.goals, data.convert]);
  const coverage = useMemo(() => accountCoverage(data.goals, data.projection.days, data.startBalances, data.convert), [data.goals, data.projection.days, data.startBalances, data.convert]);
  const targets = useMemo(() => monthlyTargets(data.goals, data.activeGoalIds, data.accountName, data.today, data.convert, by), [data.goals, data.activeGoalIds, data.accountName, data.today, data.convert, by]);
  const live = data.goals.filter(g => !g.isBucket && !g.completed && !g.disabled);
  const monthly = live.reduce((s, g) => s + (g.monthlyContribution ? data.convert(g.monthlyContribution, g.currency) : 0), 0);
  const atRisk = live.filter(g => ['at-risk', 'off-track'].includes(projectGoal(g, data.today).status)).length;
  const q = query.trim().toLowerCase();
  const nodes = data.tree.filter(n => !q || n.goal.name.toLowerCase().includes(q) || n.children.some(c => c.name.toLowerCase().includes(q)));

  if (data.goals.length === 0) {
    return <Card><EmptyState icon="award" title="No goals yet" body="Save for something, plan a big expense or track an income target." action={<Button variant="primary" onClick={() => onAdd()}>Add goal</Button>} /></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Rings rings={rings} />
          <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            {rings.map(r => (
              <div key={r.category} className="min-w-0">
                <p className={cn('flex items-center gap-1.5 text-[13px] font-medium', KIND[r.category].text)}><NvIcon name={KIND[r.category].icon} size={15} />{r.label}</p>
                {r.count > 0 ? (
                  <>
                    <p className="mt-1"><Money amount={r.saved} currency={data.displayCurrency} size="lg" /></p>
                    <p className="text-xs text-nv-muted">of <Money amount={r.target} currency={data.displayCurrency} className="text-xs" /> · {Math.round(r.pct)}%</p>
                  </>
                ) : <p className="mt-1 text-sm text-nv-muted">No goals</p>}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-nv-muted">
          {live.length} active {live.length === 1 ? 'goal' : 'goals'} · <Money amount={monthly} currency={data.displayCurrency} className="text-sm" /> a month in contributions{atRisk > 0 && <> · <span className="text-nv-orange-text">{atRisk} at risk</span></>}
        </p>
        {coverage.length > 0 && (
          <ul className="mt-3 space-y-1">
            {coverage.map(c => (
              <li key={c.accountId} className="flex items-start gap-2 text-sm text-nv-ink">
                <NvIcon name="warning" size={16} className="mt-0.5 shrink-0 text-nv-orange-text" />
                <span>{data.accountName(c.accountId)}: <Money amount={c.goalsTotal} currency={data.displayCurrency} className="text-sm" /> of goals, <Money amount={c.projected} currency={data.displayCurrency} className="text-sm" /> projected{c.byDate ? ` on ${formatShortDate(c.byDate, data.today)}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="px-3 sm:px-4">
        {nodes.length === 0 ? <EmptyState icon="search" title="No goals match" /> : (
          <ul>
            {nodes.map((n, i) => (
              <React.Fragment key={n.goal.id}>
                {n.goal.isBucket ? (
                  <li className="flex items-center gap-2 px-2 pb-1 pt-4">
                    <button type="button" onClick={() => onOpen(n.goal)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
                      <NvIcon name="layers" size={16} className="text-nv-muted" />
                      <span className="truncate text-[13px] font-semibold uppercase tracking-wide text-nv-muted">{n.goal.name}</span>
                      <span className="text-[13px] text-nv-muted">· {n.children.length}</span>
                    </button>
                    <Switch
                      checked={data.activeGoalIds.includes(n.goal.id)}
                      onChange={on => data.setActive([n.goal.id, ...n.children.map(c => c.id)], on)}
                      label={`Include ${n.goal.name} in the forecast`}
                    />
                    <RowMenu entries={menuFor(n.goal, i, nodes.length)} label={`Actions for ${n.goal.name}`} />
                  </li>
                ) : (
                  <GoalRow goal={n.goal} data={data} menu={menuFor(n.goal, i, nodes.length)} onOpen={onOpen} />
                )}
                {n.children.map(c => <GoalRow key={c.id} goal={c} data={data} nested menu={menuFor(c, -1, 0)} onOpen={onOpen} />)}
              </React.Fragment>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-nv-ink">Monthly targets</h2>
          <SegmentedTabs<'account' | 'month'> label="Group targets" size="sm" value={by} onChange={setBy} items={[{ id: 'month', label: 'By month', icon: 'calendar' }, { id: 'account', label: 'By account', icon: 'bank' }]} />
        </div>
        {targets.length === 0 ? <p className="text-sm text-nv-muted">No contributions planned in the next six months.</p> : (
          <ul>
            {targets.map(t => (
              <li key={t.key} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-nv-line py-2 last:border-0">
                <span className="text-[15px] text-nv-ink">{t.label}</span>
                <span className="flex flex-wrap items-center gap-3 text-[13px]">
                  {t.savings > 0 && <span className="flex items-center gap-1 text-nv-violet-text"><NvIcon name="piggy" size={14} /><Money amount={t.savings} currency={data.displayCurrency} className="text-[13px]" /></span>}
                  {t.expense > 0 && <span className="flex items-center gap-1 text-nv-orange-text"><NvIcon name="shoppingBag" size={14} /><Money amount={t.expense} currency={data.displayCurrency} className="text-[13px]" /></span>}
                  {t.income > 0 && <span className="flex items-center gap-1 text-nv-green-text"><NvIcon name="money" size={14} /><Money amount={t.income} currency={data.displayCurrency} className="text-[13px]" /></span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

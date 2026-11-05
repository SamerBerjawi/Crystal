import React, { useMemo, useState } from 'react';
import type { Account, FinancialGoal } from '../types';
import { convertToMain, parseLocalDate, getMainCurrency } from '../utils';
import { goalCategoryOf } from '../utils/forecastModel';
import { goalCardView, isGoalDone } from '../utils/goalsModel';
import { cn } from '../lib/utils';
import { GOAL_STATUS } from './GoalCard';
import { IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Checkbox } from './ui/Fields';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import SegmentedControl from './ui/SegmentedControl';

interface GoalTableProps {
  goals: FinancialGoal[];
  accounts: Account[];
  today: Date;
  onEdit: (goal: FinancialGoal) => void;
  onDelete: (goal: FinancialGoal) => void;
  onToggleComplete: (goal: FinancialGoal) => void;
}

type SortField = 'name' | 'amount' | 'currentAmount' | 'date' | 'progress' | 'status';

const COLUMNS: { id: SortField; label: string; end?: boolean }[] = [
  { id: 'name', label: 'Goal' },
  { id: 'amount', label: 'Target', end: true },
  { id: 'currentAmount', label: 'Saved', end: true },
  { id: 'progress', label: 'Progress' },
  { id: 'date', label: 'Due' },
];
const GROUPINGS = [{ id: 'all', label: 'List all' }, { id: 'bucket', label: 'By bucket' }];
const CATEGORY_LABEL = { savings: 'Saving', expense: 'Spending', income: 'Income' };
const shortDate = (date?: string) => (date ? parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Goals as a sortable list (GOL-05). */
const GoalTable: React.FC<GoalTableProps> = ({ goals, accounts, today, onEdit, onDelete, onToggleComplete }) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [isAscending, setAscending] = useState(true);
  const [grouping, setGrouping] = useState('all');

  const rows = useMemo(() => {
    const value = (goal: FinancialGoal, view: ReturnType<typeof goalCardView>): string | number => {
      switch (sortField) {
        case 'name': return goal.name.toLowerCase();
        case 'amount': return view.target;
        case 'currentAmount': return view.saved;
        case 'progress': return view.pct;
        case 'status': return view.status;
        default: return goal.date ? parseLocalDate(goal.date).getTime() : Infinity;
      }
    };
    const direction = isAscending ? 1 : -1;
    return goals
      .filter(goal => !goal.isBucket)
      .map(goal => ({ goal, view: goalCardView(goal, [], today, convertToMain) }))
      .sort((a, b) => {
        const left = value(a.goal, a.view);
        const right = value(b.goal, b.view);
        return left < right ? -direction : left > right ? direction : 0;
      });
  }, [goals, today, sortField, isAscending]);

  const sortBy = (field: SortField) => {
    if (field === sortField) setAscending(ascending => !ascending);
    else {
      setSortField(field);
      setAscending(true);
    }
  };

  const groups = useMemo(() => {
    if (grouping === 'all') return [{ id: 'all', name: '', rows }];
    const buckets = goals.filter(goal => goal.isBucket).map(bucket => ({ id: bucket.id, name: bucket.name, rows: rows.filter(row => row.goal.parentId === bucket.id) }));
    return [...buckets, { id: 'loose', name: 'No bucket', rows: rows.filter(row => !row.goal.parentId) }].filter(group => group.rows.length > 0);
  }, [grouping, rows, goals]);

  const header = (column: { id: SortField; label: string; end?: boolean }) => (
    <th key={column.id} scope="col" aria-sort={sortField === column.id ? (isAscending ? 'ascending' : 'descending') : 'none'} className={cn('px-3 py-2', column.end && 'text-right')}>
      <button type="button" onClick={() => sortBy(column.id)} className={cn('type-label inline-flex min-h-11 cursor-pointer items-center gap-1 text-muted hover:text-ink', column.end && 'flex-row-reverse')}>
        {column.label}
        {sortField === column.id && <Icon name={isAscending ? 'arrow-up-01' : 'arrow-down-01'} size={14} />}
      </button>
    </th>
  );

  return (
    <section aria-label="Goals table" className="surface-card overflow-hidden rounded-[var(--radius-xl)]">
      <div className="flex justify-end p-3">
        <SegmentedControl items={GROUPINGS} activeId={grouping} onChange={setGrouping} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-y border-line text-left">
              {COLUMNS.map(header)}
              <th scope="col" className="type-label px-3 py-2 text-left text-muted">Expected</th>
              {header({ id: 'status', label: 'Status' })}
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          {groups.map(group => (
            <tbody key={group.id}>
              {group.name && <tr className="bg-inset"><th scope="rowgroup" colSpan={8} className="type-label px-3 py-1.5 text-left text-ink">{group.name}</th></tr>}
              {group.rows.map(({ goal, view }) => {
                const status = GOAL_STATUS[view.status];
                const account = accounts.find(item => item.id === goal.paymentAccountId)?.name;
                return (
                  <tr key={goal.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Checkbox isSelected={isGoalDone(goal)} onChange={() => onToggleComplete(goal)}><span className="sr-only">{goal.name} reached</span></Checkbox>
                        <button type="button" onClick={() => onEdit(goal)} className="min-w-0 cursor-pointer text-left">
                          <span className="type-body-strong block truncate text-ink">{goal.name}</span>
                          <span className="type-caption block truncate text-muted">{CATEGORY_LABEL[goalCategoryOf(goal)]}{account ? `, ${account}` : ''}</span>
                        </button>
                      </div>
                    </td>
                    <td className="type-figure-row px-3 py-2 text-right text-ink"><Amount value={view.target} currency={getMainCurrency()} /></td>
                    <td className="type-figure-row px-3 py-2 text-right text-ink"><Amount value={view.saved} currency={getMainCurrency()} /></td>
                    <td className="px-3 py-2">
                      <span className="type-caption text-ink">{Math.round(view.pct)}%</span>
                      <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-inset"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${view.pct}%` }} /></div>
                    </td>
                    <td className="type-body whitespace-nowrap px-3 py-2 text-ink">{shortDate(view.date)}</td>
                    <td className="type-body whitespace-nowrap px-3 py-2 text-ink">{shortDate(view.projectedDate)}</td>
                    <td className="px-3 py-2"><Badge tone={status.tone}>{status.label}</Badge></td>
                    <td className="px-1 py-2 text-right">
                      <IconButton icon="delete-02" label={`Delete ${goal.name}`} tooltipPlacement="left" onPress={() => onDelete(goal)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
};

export default GoalTable;

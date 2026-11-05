import React, { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FinancialGoal } from '../types';
import { convertToMain, getMainCurrency } from '../utils';
import { sortAccountsByType } from '../utils/accountsModel';
import GoalCard from '../components/GoalCard';
import GoalScenarioModal from '../components/GoalScenarioModal';
import GoalTable from '../components/GoalTable';
import PageHeader, { type PageStat } from '../components/PageHeader';
import { Button, IconButton } from '../components/ui/Actions';
import { AmountInput } from '../components/ui/Fields';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog, Dialog } from '../components/ui/Overlays';
import { Select, type PickerOption } from '../components/ui/Pickers';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { useInsightsView } from '../contexts/InsightsViewContext';
import { useAccountsContext } from '../contexts/DomainProviders';
import { useGoalsContext } from '../contexts/FinancialDataContext';
import { goalCategoryOf } from '../utils/forecastModel';
import { parseAmountInput } from '../utils/scheduleModel';
import { accountCoverage, completionChanges, goalTree, isGoalDone, monthlyNeed, monthlyTargetGroups, moveGoal, summaryRings, type GoalNode } from '../utils/goalsModel';

const VIEWS = [{ id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }];
const SCHEDULES = [{ id: 'account', label: 'By account' }, { id: 'month', label: 'By month' }];
const DOTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const ALL = 'all';
const SHARE_COLOURS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const Sortable: React.FC<{ id: string; children: (handle: React.ReactNode) => React.ReactNode; extra: React.ReactNode; isOn: boolean }> = ({ id, children, extra, isOn }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !isOn });
  const handle = isOn ? (
    <span className="flex shrink-0 items-center">
      {extra}
      <span {...attributes} {...listeners} aria-label="Drag to reorder" className="flex size-11 cursor-grab touch-none items-center justify-center text-muted">⠿</span>
    </span>
  ) : null;
  return <div ref={setNodeRef} className="min-w-0" style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>{children(handle)}</div>;
};

/** Goals, on a page of their own (D-017, D-042). Progress comes from each goal's own saved amount (D-094). */
const Goals: React.FC = () => {
  const { financialGoals, goalOrder, setGoalOrder, saveFinancialGoal, deleteFinancialGoal } = useGoalsContext();
  const { accounts } = useAccountsContext();
  const { activeGoalIds, setActiveGoalIds } = useInsightsView();

  const [isFormOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [parentForNew, setParentForNew] = useState<string | undefined>();
  const [deletingGoal, setDeletingGoal] = useState<FinancialGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<FinancialGoal | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [view, setView] = useState('cards');
  const [schedule, setSchedule] = useState<'account' | 'month'>('account');
  const [accountFilter, setAccountFilter] = useState(ALL);
  const [isReordering, setReordering] = useState(false);

  const today = useMemo(() => new Date(), []);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const visibleGoals = useMemo(
    () => financialGoals.filter(goal => accountFilter === ALL || !goal.paymentAccountId || goal.paymentAccountId === accountFilter),
    [financialGoals, accountFilter]
  );
  const tree = useMemo(() => goalTree(visibleGoals, goalOrder || []), [visibleGoals, goalOrder]);
  const rings = useMemo(() => summaryRings(visibleGoals, convertToMain), [visibleGoals]);
  const savings = rings[0];
  const need = useMemo(() => monthlyNeed(visibleGoals, today, convertToMain), [visibleGoals, today]);
  const coverageWarnings = useMemo(() => {
    const todayBalances: Record<string, number> = {};
    for (const acc of accounts) todayBalances[acc.id] = convertToMain(acc.balance, acc.currency);
    return accountCoverage(visibleGoals, [], todayBalances, convertToMain);
  }, [visibleGoals, accounts]);
  const targets = useMemo(() => {
    const nameOf = (id?: string) => accounts.find(account => account.id === id)?.name ?? '';
    return monthlyTargetGroups(visibleGoals, activeGoalIds, nameOf, today, convertToMain, schedule);
  }, [visibleGoals, activeGoalIds, accounts, today, schedule]);

  const shares = useMemo(() => {
    const leaves = (node: GoalNode) => (node.goal.isBucket ? node.children : [node.goal]);
    return tree
      .map(node => ({ id: node.goal.id, name: node.goal.name, saved: leaves(node).filter(goal => !isGoalDone(goal) && goalCategoryOf(goal) === 'savings').reduce((sum, goal) => sum + convertToMain(goal.currentAmount, goal.currency), 0) }))
      .filter(share => share.saved > 0);
  }, [tree]);
  const sharesTotal = shares.reduce((sum, share) => sum + share.saved, 0);

  const accountOptions = useMemo<PickerOption[]>(() => {
    const used = new Set(financialGoals.map(goal => goal.paymentAccountId).filter(Boolean));
    return [
      { id: ALL, label: 'All accounts' },
      ...sortAccountsByType(accounts.filter(account => used.has(account.id))).map(account => ({
        id: account.id,
        label: account.name,
        group: account.status === 'closed' ? 'Closed' : account.type,
      })),
    ];
  }, [accounts, financialGoals]);

  const isIncluded = (goal: FinancialGoal) => !goal.disabled && activeGoalIds.includes(goal.id);
  const allIncluded = visibleGoals.length > 0 && visibleGoals.every(goal => activeGoalIds.includes(goal.id));

  const toggleIncluded = (goal: FinancialGoal) => {
    const related = [goal, ...(goal.isBucket ? financialGoals.filter(item => item.parentId === goal.id) : [])];
    const disabled = isIncluded(goal);
    related.forEach(item => saveFinancialGoal({ ...item, disabled }));
    const ids = related.map(item => item.id);
    setActiveGoalIds(prev => (disabled ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  };

  const toggleAll = () => {
    const ids = visibleGoals.map(goal => goal.id);
    setActiveGoalIds(prev => (allIncluded ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  };

  const toggleComplete = (goal: FinancialGoal) => completionChanges(goal, financialGoals).forEach(saveFinancialGoal);

  const openForm = (goal?: FinancialGoal, parentId?: string) => {
    setEditingGoal(goal ?? null);
    setParentForNew(parentId);
    setFormOpen(true);
  };

  const duplicate = (goal: FinancialGoal) => {
    const { id: _id, ...rest } = goal;
    saveFinancialGoal({ ...rest, name: `${goal.name} (Copy)` });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = tree.map(node => node.goal.id);
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setGoalOrder([...moved, ...(goalOrder || []).filter(id => !ids.includes(id))]);
  };

  const pageStats: PageStat[] = [
    { label: 'Saved so far', icon: 'coins-01', value: savings.saved, format: 'money' },
    { label: 'Still to save', icon: 'target-01', value: Math.max(0, savings.target - savings.saved), format: 'money' },
    { label: 'Needed a month', icon: 'calendar-03', value: need, format: 'money' },
  ];

  const deletingItems = deletingGoal?.isBucket ? financialGoals.filter(goal => goal.parentId === deletingGoal.id).length : 0;

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader title="Goals" stats={pageStats} actions={<Button icon="add-01" onPress={() => openForm()}>New goal</Button>} />

      {financialGoals.length === 0 ? (
        <EmptyState icon="target-01" title="No goals yet" description="Set a number and a date, and Crystal works out the monthly amount." actionLabel="New goal" onAction={() => openForm()} />
      ) : (
        <>
          <section aria-label="Goals summary" className="surface-card rounded-[var(--radius-xl)] p-6 max-md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
              <div>
                <p className="type-label text-muted">Saved towards your goals</p>
                <p className="type-figure-hero text-ink"><Amount value={savings.saved} currency={getMainCurrency()} countUp /></p>
              </div>
              {rings.slice(1).filter(ring => ring.count > 0).map(ring => (
                <div key={ring.category}>
                  <p className="type-label text-muted">{ring.label} goals</p>
                  <p className="type-figure-lg text-ink"><Amount value={ring.saved} currency={getMainCurrency()} /> <span className="type-body text-muted">of <Amount value={ring.target} currency={getMainCurrency()} /></span></p>
                </div>
              ))}
            </div>
            {shares.length > 0 && (
              <>
                <div role="img" aria-label="Share of savings by goal" className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
                  {shares.map((share, index) => <div key={share.id} style={{ width: `${(share.saved / sharesTotal) * 100}%`, backgroundColor: SHARE_COLOURS[index % SHARE_COLOURS.length] }} />)}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  {shares.map((share, index) => (
                    <li key={share.id} className="type-caption flex items-center gap-1.5 text-muted">
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: SHARE_COLOURS[index % SHARE_COLOURS.length] }} />
                      {share.name} <span className="font-bold text-ink"><Amount value={share.saved} currency={getMainCurrency()} /></span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {coverageWarnings.length > 0 && (
            <section aria-label="Account coverage warnings" className="surface-card rounded-[var(--radius-xl)] border border-amber/40 bg-amber-soft p-4">
              <p className="type-label text-attention-text">Account coverage</p>
              <ul className="mt-1.5 space-y-1">
                {coverageWarnings.map(warning => {
                  const accountName = accounts.find(a => a.id === warning.accountId)?.name || 'Linked account';
                  return (
                    <li key={warning.accountId} className="type-body text-ink">
                      Savings goals on <span className="font-semibold">{accountName}</span> total <Amount value={warning.goalsTotal} currency={getMainCurrency()} />, which exceeds its current balance of <Amount value={warning.projected} currency={getMainCurrency()} />.
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Select className="w-56 max-sm:w-full" label="Show goals for" options={accountOptions} value={accountFilter} onChange={setAccountFilter} />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onPress={toggleAll}>{allIncluded ? 'Take all out of forecast' : 'Include all in forecast'}</Button>
              {view === 'cards' && <Button variant={isReordering ? 'primary' : 'secondary'} icon="arrow-up-down" onPress={() => setReordering(on => !on)}>{isReordering ? 'Done' : 'Reorder'}</Button>}
              <SegmentedControl items={VIEWS} activeId={view} onChange={setView} />
            </div>
          </div>

          {view === 'table' ? (
            <GoalTable goals={visibleGoals} accounts={accounts} today={today} onEdit={openForm} onDelete={setDeletingGoal} onToggleComplete={toggleComplete} />
          ) : tree.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tree.map(node => node.goal.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {tree.map((node, index) => (
                    <Sortable
                      key={node.goal.id}
                      id={node.goal.id}
                      isOn={isReordering}
                      extra={
                        <>
                          <IconButton icon="arrow-up-02" label={`Move ${node.goal.name} up`} isDisabled={index === 0} onPress={() => setGoalOrder(moveGoal(tree, node.goal.id, -1))} />
                          <IconButton icon="arrow-down-02" label={`Move ${node.goal.name} down`} isDisabled={index === tree.length - 1} onPress={() => setGoalOrder(moveGoal(tree, node.goal.id, 1))} />
                        </>
                      }
                    >
                      {handle => (
                        <GoalCard
                          goal={node.goal}
                          items={node.children}
                          isIncluded={isIncluded(node.goal)}
                          today={today}
                          onToggleIncluded={toggleIncluded}
                          onToggleComplete={toggleComplete}
                          onEdit={openForm}
                          onContribute={goal => {
                            setContributingGoal(goal);
                            setContributionAmount(goal.monthlyContribution ? String(goal.monthlyContribution) : '');
                          }}
                          onDuplicate={duplicate}
                          onDelete={setDeletingGoal}
                          onAddItem={id => openForm(undefined, id)}
                          reorder={handle}
                        />
                      )}
                    </Sortable>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <EmptyState icon="target-01" title="No goals for this account" description="Choose all accounts to see the rest." />
          )}

          <section aria-label="Monthly targets" className="surface-card rounded-[var(--radius-xl)] p-6 max-md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="type-card-title text-ink">What your goals ask for</h2>
                <p className="type-caption text-muted">Every account in every month for the next twelve months, for goals included in the forecast.</p>
              </div>
              <SegmentedControl items={SCHEDULES} activeId={schedule} onChange={id => setSchedule(id as 'account' | 'month')} />
            </div>
            {targets.length > 0 ? (
              <div className="mt-4 md:columns-2 md:gap-x-8">
                {targets.map((group, index) => (
                  <section key={group.key} aria-label={group.label} className="mb-6 min-w-0 break-inside-avoid">
                    <h3 className="type-body-strong flex items-center gap-2 text-ink">
                      {schedule === 'account' && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: DOTS[index % DOTS.length] }} />}
                      <span className="truncate">{group.label}</span>
                    </h3>
                    <ul className="mt-1 divide-y divide-line border-l-2 border-line pl-3">
                      {group.items.map(item => (
                        <li key={item.key} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                          <span className="type-body min-w-0 truncate text-muted">{item.label}</span>
                          <span className="flex flex-wrap justify-end gap-x-4">
                            {item.savings > 0 && <span className="type-caption text-muted">Saving <span className="type-figure-row whitespace-nowrap text-ink"><Amount value={item.savings} currency={getMainCurrency()} /></span></span>}
                            {item.expense > 0 && <span className="type-caption text-muted">Spending <span className="type-figure-row whitespace-nowrap text-ink"><Amount value={item.expense} currency={getMainCurrency()} /></span></span>}
                            {item.income > 0 && <span className="type-caption text-muted">Income <span className="type-figure-row whitespace-nowrap text-ink"><Amount value={item.income} currency={getMainCurrency()} /></span></span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="type-body mt-3 text-muted">Nothing is due in the next twelve months.</p>
            )}
          </section>
        </>
      )}

      {isFormOpen && (
        <GoalScenarioModal
          onClose={() => setFormOpen(false)}
          onSave={saveFinancialGoal}
          goalToEdit={editingGoal}
          financialGoals={financialGoals}
          parentId={parentForNew}
          accounts={accounts}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        onConfirm={() => {
          if (deletingGoal) deleteFinancialGoal(deletingGoal.id);
          setDeletingGoal(null);
        }}
        title={`Delete ${deletingGoal?.name ?? 'this goal'}?`}
        message={deletingItems ? `This also deletes the ${deletingItems} ${deletingItems === 1 ? 'item' : 'items'} inside it.` : "You can't undo this."}
        confirmLabel="Delete goal"
        isDestructive
      />

      <Dialog
        isOpen={!!contributingGoal}
        onClose={() => setContributingGoal(null)}
        title={contributingGoal ? `Add to ${contributingGoal.name}` : 'Record contribution'}
        footer={close => (
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button
              onPress={() => {
                const add = parseAmountInput(contributionAmount);
                if (!contributingGoal || !Number.isFinite(add) || add <= 0) return;
                const nextSaved = (contributingGoal.currentAmount ?? 0) + add;
                saveFinancialGoal({
                  ...contributingGoal,
                  currentAmount: nextSaved,
                  completed: nextSaved >= contributingGoal.amount ? true : contributingGoal.completed,
                });
                setContributingGoal(null);
              }}
            >
              Add contribution
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <AmountInput
            label="Contribution amount"
            currency={contributingGoal?.currency || getMainCurrency()}
            value={contributionAmount}
            onChange={setContributionAmount}
            autoFocus
          />
        </div>
      </Dialog>
    </div>
  );
};

export default Goals;

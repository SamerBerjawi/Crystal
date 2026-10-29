import React, { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import type { ScheduledPayment } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import { formatShortDate } from '../../../../utils/dateFormat';
import { loanOverrideKinds } from '../../../../utils/accountDetailModel';
import { parseAmount } from '../../../../utils/parseAmount';
import { NvIcon, type NvIconName } from '../../NvIcon';
import { FilterChip } from '../../tile';
import { toast } from '../../toast';
import { Badge, Button, Card, EmptyState, MoreButton, Money } from '../../ui';

/*
 * Payment plan tab (docs/ACCOUNTS_BUDGET_REVIEW_PLAN.md Phase 4.2): the full schedule with the
 * classic plan's changes: skip a payment, pay interest only, edit a payment, add extra principal,
 * mark paid, and reset. Every change goes through `applyLoanOverride` and has an Undo.
 */

type PlanFilter = 'all' | 'upcoming' | 'paid' | 'overdue' | 'changed';
type Editing = { paymentNumber: number; mode: 'extra' | 'edit' } | null;

const CHANGE_BADGES: Record<ReturnType<typeof loanOverrideKinds>[number], { label: string; icon: NvIconName }> = {
  skipped: { label: 'Skipped', icon: 'calendar' },
  interest_only: { label: 'Interest only', icon: 'calendar' },
  edited: { label: 'Edited', icon: 'edit' },
  extra: { label: 'Extra principal', icon: 'add' },
};

const inputClass =
  'h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3 text-sm text-nv-ink outline-none focus:border-nv-violet';

export const PaymentPlan: React.FC<{ data: AccountDetailData }> = ({ data }) => {
  const { account, loanMetrics, loanPaymentOverrides, updateLoanInstallment, resetLoanInstallments, recordAccountTransaction } = data;
  const [filter, setFilter] = useState<PlanFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [fields, setFields] = useState({ extra: '', total: '', principal: '', interest: '' });

  if (!account || !loanMetrics) return null;
  const schedule = loanMetrics.schedule;
  if (schedule.length === 0) return null;
  const isLending = account.type === 'Lending';
  const changedCount = Object.keys(loanPaymentOverrides).length;

  const filtered = schedule.filter((p) => {
    if (filter === 'upcoming') return p.status === 'Upcoming' || p.status === 'Due';
    if (filter === 'paid') return p.status === 'Paid';
    if (filter === 'overdue') return p.status === 'Overdue';
    if (filter === 'changed') return !!loanPaymentOverrides[p.paymentNumber];
    return true;
  });
  const visible = expanded ? filtered : filtered.slice(0, 12);

  const change = (pmt: ScheduledPayment, patch: Partial<ScheduledPayment> | 'clear', message: string) => {
    const res = updateLoanInstallment(pmt.paymentNumber, patch);
    if (res) toast.undo(message, res.undo);
    setEditing(null);
  };

  const startEdit = (pmt: ScheduledPayment, mode: 'extra' | 'edit') => {
    const o = loanPaymentOverrides[pmt.paymentNumber] || {};
    setFields({
      extra: o.extraPrincipal ? String(o.extraPrincipal) : '',
      total: o.totalPayment !== undefined ? String(o.totalPayment) : '',
      principal: o.principal !== undefined ? String(o.principal) : '',
      interest: o.interest !== undefined ? String(o.interest) : '',
    });
    setEditing({ paymentNumber: pmt.paymentNumber, mode });
  };

  // Blank means "use the schedule's own figure".
  const num = (text: string) => {
    const v = parseAmount(text);
    return text.trim() === '' || Number.isNaN(v) ? undefined : Math.max(0, v);
  };

  const saveEdit = (pmt: ScheduledPayment) => {
    if (editing?.mode === 'extra') {
      const extra = num(fields.extra);
      change(pmt, { extraPrincipal: extra && extra > 0 ? extra : undefined }, extra ? `Extra principal on #${pmt.paymentNumber}` : `Removed extra principal on #${pmt.paymentNumber}`);
      return;
    }
    change(
      pmt,
      { totalPayment: num(fields.total), principal: num(fields.principal), interest: num(fields.interest) },
      `Edited payment #${pmt.paymentNumber}`
    );
  };

  const markPaid = (pmt: ScheduledPayment) => {
    const res = recordAccountTransaction({
      date: pmt.date,
      description: `${account.name} — installment #${pmt.paymentNumber}`,
      merchant: account.financialInstitution || account.name,
      amount: pmt.totalPayment,
      category: 'Loan & Debt Payment',
      type: isLending ? 'expense' : 'income',
      principalAmount: pmt.principal,
      interestAmount: pmt.interest,
    });
    if (res?.undo) toast.undo(`Recorded installment #${pmt.paymentNumber}`, res.undo);
  };

  const resetAll = () => {
    const res = resetLoanInstallments();
    if (res) toast.undo('Payment plan reset', res.undo);
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-nv-ink">
          Payment plan <span className="text-nv-muted">· {schedule.length} payments</span>
        </h2>
        {changedCount > 0 && (
          <Button variant="secondary" size="sm" icon="undo" onClick={resetAll}>
            Reset changes
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show payments">
        <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip label="Upcoming" active={filter === 'upcoming'} onClick={() => setFilter('upcoming')} />
        <FilterChip label="Paid" active={filter === 'paid'} onClick={() => setFilter('paid')} />
        {schedule.some((p) => p.status === 'Overdue') && (
          <FilterChip label="Overdue" icon="alert" active={filter === 'overdue'} onClick={() => setFilter('overdue')} />
        )}
        {changedCount > 0 && (
          <FilterChip label={`Changed (${changedCount})`} icon="edit" active={filter === 'changed'} onClick={() => setFilter('changed')} />
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="calendar" title="No payments here" body="Try another filter." />
      ) : (
        <div className="space-y-1.5">
          {visible.map((pmt) => {
            const override = loanPaymentOverrides[pmt.paymentNumber];
            const kinds = loanOverrideKinds(override);
            const isPaid = pmt.status === 'Paid';
            const isEditing = editing?.paymentNumber === pmt.paymentNumber;
            const isDeferred = override?.status === 'Deferred';
            return (
              <div key={pmt.paymentNumber} className="rounded-nv-sub bg-nv-surface px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="nv-tabular font-semibold text-nv-ink">
                        #{pmt.paymentNumber} · {formatShortDate(pmt.date)}
                      </span>
                      <Badge
                        tone={isPaid ? 'green' : pmt.status === 'Overdue' ? 'red' : 'neutral'}
                        icon={isPaid ? 'check' : pmt.status === 'Overdue' ? 'alert' : 'calendar'}
                      >
                        {pmt.status === 'Deferred' ? 'Deferred' : pmt.status}
                      </Badge>
                      {kinds.map((k) => (
                        <Badge key={k} tone="violet" icon={CHANGE_BADGES[k].icon}>
                          {CHANGE_BADGES[k].label}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-nv-muted">
                      Principal <Money amount={pmt.principal} currency={account.currency} /> · Interest{' '}
                      <Money amount={pmt.interest} currency={account.currency} />
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Money amount={pmt.totalPayment} currency={account.currency} />
                    {!isPaid && (
                      <Menu.Root>
                        <Menu.Trigger
                          aria-label={`Change payment #${pmt.paymentNumber}`}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-nv-muted transition-colors hover:bg-nv-inset hover:text-nv-ink"
                        >
                          <NvIcon name="more" size={18} />
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Positioner sideOffset={6} align="end" className="pointer-events-auto z-popover">
                            <Menu.Popup className="crystal-new min-w-56 rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                              {[
                                { label: 'Mark paid', icon: 'check' as const, run: () => markPaid(pmt), hide: isDeferred },
                                { label: 'Extra principal…', icon: 'add' as const, run: () => startEdit(pmt, 'extra'), hide: isDeferred },
                                { label: 'Edit payment…', icon: 'edit' as const, run: () => startEdit(pmt, 'edit'), hide: isDeferred },
                                {
                                  label: 'Skip this payment',
                                  icon: 'calendar' as const,
                                  run: () => change(pmt, { status: 'Deferred', deferralType: 'full' }, `Skipped payment #${pmt.paymentNumber}`),
                                  hide: isDeferred && override?.deferralType !== 'interest_only',
                                },
                                {
                                  label: 'Pay interest only',
                                  icon: 'calendar' as const,
                                  run: () => change(pmt, { status: 'Deferred', deferralType: 'interest_only' }, `Interest only on #${pmt.paymentNumber}`),
                                  hide: isDeferred && override?.deferralType === 'interest_only',
                                },
                                {
                                  label: isDeferred ? 'Pay as scheduled' : 'Clear changes',
                                  icon: 'undo' as const,
                                  run: () => change(pmt, isDeferred ? { status: undefined } : 'clear', `Restored payment #${pmt.paymentNumber}`),
                                  hide: !override,
                                },
                              ]
                                .filter((item) => !item.hide)
                                .map((item) => (
                                  <Menu.Item
                                    key={item.label}
                                    onClick={item.run}
                                    className="flex min-h-11 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
                                  >
                                    <NvIcon name={item.icon} size={16} className="text-nv-muted" />
                                    {item.label}
                                  </Menu.Item>
                                ))}
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.Root>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-3 rounded-nv-sub bg-nv-inset p-3">
                    {editing.mode === 'extra' ? (
                      <label className="block space-y-1.5">
                        <span className="text-xs text-nv-muted">Extra principal</span>
                        <input
                          inputMode="decimal"
                          value={fields.extra}
                          onChange={(e) => setFields((f) => ({ ...f, extra: e.target.value }))}
                          className={inputClass}
                        />
                      </label>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {(['total', 'principal', 'interest'] as const).map((key) => (
                          <label key={key} className="block space-y-1.5">
                            <span className="text-xs text-nv-muted">
                              {key === 'total' ? 'Total payment' : key === 'principal' ? 'Principal' : 'Interest'}
                            </span>
                            <input
                              inputMode="decimal"
                              placeholder={String(key === 'total' ? pmt.totalPayment : key === 'principal' ? pmt.principal : pmt.interest)}
                              value={fields[key]}
                              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                              className={inputClass}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => saveEdit(pmt)}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 12 && (
        <div className="flex justify-center pt-1">
          <MoreButton expanded={expanded} total={filtered.length} onToggle={() => setExpanded((v) => !v)} />
        </div>
      )}
    </Card>
  );
};

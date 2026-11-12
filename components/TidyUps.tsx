import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CleanupProposal } from '../types';
import { useTransactionsContext } from '../contexts/DomainProviders';
import { applyProposal, pendingProposals, refreshProposals, undoProposal } from '../utils/cleanup';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';

const SAMPLE = 3;
const RECENT = 4;

const sameList = (a: CleanupProposal[], b: CleanupProposal[]) => a.length === b.length && a.every((item, index) => item.id === b[index].id && item.status === b[index].status && item.changes.length === b[index].changes.length);

const ProposalRow: React.FC<{
  proposal: CleanupProposal;
  onApprove: (proposal: CleanupProposal) => void;
  onDismiss: (proposal: CleanupProposal) => void;
}> = ({ proposal, onApprove, onDismiss }) => (
  <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-body-strong text-ink">{proposal.title}</p>
        <Badge tone="neutral">{proposal.changes.length} {proposal.changes.length === 1 ? 'change' : 'changes'}</Badge>
        {proposal.source === 'assistant' && <Badge tone="blue">Ask Crystal</Badge>}
      </div>
      <p className="type-caption mt-0.5 text-muted">{proposal.detail}</p>
      <ul className="type-caption mt-1.5 space-y-0.5 text-muted">
        {proposal.changes.slice(0, SAMPLE).map(change => (
          <li key={`${change.transactionId}-${change.field}`} className="truncate">
            {change.field === 'merchant' ? 'Name' : 'Category'}: <span className="line-through">{change.from || 'none'}</span> → <span className="text-ink">{change.to}</span>
          </li>
        ))}
        {proposal.changes.length > SAMPLE && <li>and {proposal.changes.length - SAMPLE} more</li>}
      </ul>
    </div>
    <div className="flex gap-2">
      <Button size="sm" variant="ghost" onPress={() => onDismiss(proposal)}>Dismiss</Button>
      <Button size="sm" onPress={() => onApprove(proposal)}>Approve</Button>
    </div>
  </li>
);

/**
 * Tidy-ups Crystal found in your transactions. They sit here until you approve them; nothing changes before that.
 * Approving makes the same edits you could make by hand, and Undo puts the old values back.
 */
const TidyUps: React.FC = () => {
  const { transactions, saveTransaction, cleanupProposals, setCleanupProposals } = useTransactionsContext();
  const [isOpen, setOpen] = useState(true);

  // Look again whenever the transactions change; only write when something is different.
  useEffect(() => {
    const next = refreshProposals(transactions, cleanupProposals, new Date().toISOString());
    if (!sameList(next, cleanupProposals)) setCleanupProposals(next);
  }, [transactions, cleanupProposals, setCleanupProposals]);

  const pending = useMemo(() => pendingProposals(cleanupProposals), [cleanupProposals]);
  const recent = useMemo(
    () => cleanupProposals.filter(proposal => proposal.status === 'applied').sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')).slice(0, RECENT),
    [cleanupProposals],
  );

  const setStatus = useCallback((ids: string[], status: CleanupProposal['status']) => {
    const now = new Date().toISOString();
    setCleanupProposals(list => list.map(item => ids.includes(item.id) ? { ...item, status, resolvedAt: status === 'pending' ? undefined : now } : item));
  }, [setCleanupProposals]);

  const undo = useCallback((proposal: CleanupProposal) => {
    const { changed, skipped } = undoProposal(transactions, proposal);
    if (changed.length > 0) saveTransaction(changed, undefined, { skipRules: true });
    // Back in the list for another look; a changed mind is not a dismissal.
    setCleanupProposals(list => list.filter(item => item.id !== proposal.id));
    toast.success(changed.length > 0 ? `Put ${changed.length} back${skipped ? `, ${skipped} had changed since` : ''}` : 'Nothing to put back');
  }, [transactions, saveTransaction, setCleanupProposals]);

  const approve = useCallback((proposals: CleanupProposal[]) => {
    const edits = new Map<string, ReturnType<typeof applyProposal>['changed'][number]>();
    let skipped = 0;
    proposals.forEach(proposal => {
      const source = transactions.map(tx => edits.get(tx.id) ?? tx);
      const result = applyProposal(source, proposal);
      result.changed.forEach(tx => edits.set(tx.id, tx));
      skipped += result.skipped;
    });
    if (edits.size > 0) saveTransaction([...edits.values()], undefined, { skipRules: true });
    setStatus(proposals.map(proposal => proposal.id), 'applied');
    const label = proposals.length === 1 ? proposals[0].title : `${proposals.length} tidy-ups`;
    toast.success(`${label}: ${edits.size} updated${skipped ? `, ${skipped} skipped because you changed them` : ''}`, {
      action: proposals.length === 1 ? { label: 'Undo', onClick: () => undo({ ...proposals[0], status: 'applied' }) } : undefined,
    });
  }, [transactions, saveTransaction, setStatus, undo]);

  if (pending.length === 0 && recent.length === 0) return null;

  return (
    <section aria-label="Tidy-ups" className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="flex items-center gap-2 text-left" aria-expanded={isOpen} onClick={() => setOpen(open => !open)}>
          <h2 className="type-body-strong text-ink">Tidy-ups</h2>
          <Badge tone={pending.length > 0 ? 'attention' : 'neutral'}>{pending.length} waiting</Badge>
        </button>
        {isOpen && pending.length > 1 && <Button size="sm" variant="soft" onPress={() => approve(pending)}>Approve all</Button>}
      </div>
      {isOpen && (
        <div className="mt-3 space-y-4">
          {pending.length > 0 ? (
            <>
              <p className="type-caption text-muted">Crystal found these in your transactions. Nothing changes until you approve.</p>
              <ul className="divide-y divide-line">
                {pending.map(proposal => <ProposalRow key={proposal.id} proposal={proposal} onApprove={item => approve([item])} onDismiss={item => setStatus([item.id], 'dismissed')} />)}
              </ul>
            </>
          ) : (
            <p className="type-caption text-muted">Nothing new to tidy up.</p>
          )}
          {recent.length > 0 && (
            <div>
              <h3 className="type-label mb-1 text-muted">Done recently</h3>
              <ul className="divide-y divide-line">
                {recent.map(proposal => (
                  <li key={proposal.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="type-caption min-w-0 truncate text-muted">{proposal.title}</span>
                    <Button size="sm" variant="ghost" onPress={() => undo(proposal)}>Undo</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default TidyUps;

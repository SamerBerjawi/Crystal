import React from 'react';
import { TransactionRule } from '../types';
import { cn } from '../lib/utils';
import { useAccountsContext } from '../contexts/DomainProviders';
import { accountNameOf, ruleSentence } from '../utils/rulesModel';
import { IconButton } from './ui/Actions';
import { Switch } from './ui/Fields';
import Icon from './ui/Icon';
import { Menu, MenuAction } from './ui/Menu';

/** A rule in plain words, marking its values. */
export const RuleSentence: React.FC<{ rule: TransactionRule; className?: string }> = ({ rule, className }) => {
  const { accounts } = useAccountsContext();
  return (
    <p className={cn('type-body text-muted', className)}>
      {ruleSentence(rule, accountNameOf(accounts)).map((part, index) => (part.isValue ? <strong key={index} className="font-semibold text-ink">{part.text}</strong> : <span key={index}>{part.text}</span>))}
    </p>
  );
};

interface RuleRowProps {
  rule: TransactionRule;
  matchCount: number;
  menuItems: MenuAction[];
  onToggle: (isActive: boolean) => void;
  onOpen: () => void;
  drag?: {
    isDragging: boolean;
    dropEdge: 'before' | 'after' | null;
    onStart: () => void;
    onOver: (edge: 'before' | 'after') => void;
    onLeave: () => void;
    onDrop: () => void;
    onEnd: () => void;
  };
}

const RuleRow: React.FC<RuleRowProps> = ({ rule, matchCount, menuItems, onToggle, onOpen, drag }) => (
  <li
    draggable={!!drag}
    onDragStart={drag?.onStart}
    onDragEnd={drag?.onEnd}
    onDrop={drag?.onDrop}
    onDragLeave={drag?.onLeave}
    onDragOver={drag && (event => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      drag.onOver(event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    })}
    className={cn('relative flex min-h-16 flex-wrap items-center gap-x-2 py-2 md:flex-nowrap', drag?.isDragging && 'opacity-50', !rule.isActive && 'opacity-60')}
  >
    {drag?.dropEdge === 'before' && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-primary" />}
    {drag?.dropEdge === 'after' && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
    {drag && <Icon name="drag_indicator" size={16} className="hidden shrink-0 cursor-grab text-muted md:block" />}
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 basis-full cursor-pointer rounded-[var(--radius-md)] py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary md:basis-0">
      <RuleSentence rule={rule} />
      <span className="type-caption mt-0.5 block text-muted">{matchCount} {matchCount === 1 ? 'transaction' : 'transactions'}</span>
    </button>
    <Switch aria-label={`${rule.isActive ? 'Turn off' : 'Turn on'} ${rule.name}`} isSelected={rule.isActive} onChange={onToggle} className="ml-auto shrink-0 max-md:w-auto">{' '}</Switch>
    <Menu title={rule.name} trigger={<IconButton icon="more_horiz" label={`More for ${rule.name}`} />} items={menuItems} />
  </li>
);

export default RuleRow;

import React from 'react';
import { TransactionRule } from '../types';
import { cn } from '../lib/utils';
import { useAccountsContext } from '../contexts/DomainProviders';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { isAlwaysFile } from '../utils/rules';
import { getCategoryDetails } from '../utils/categories';
import { accountNameOf, ruleSentence, type NameOf } from '../utils/rulesModel';
import { IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Switch } from './ui/Fields';
import Icon from './ui/Icon';
import { Menu, MenuAction } from './ui/Menu';
import { EntityGlyph, MerchantLogo } from './EntityIcon';

/** A rule in plain words, marking its values. */
export const RuleSentence: React.FC<{ rule: TransactionRule; nameOf?: NameOf; className?: string }> = ({ rule, nameOf, className }) => {
  const { accounts } = useAccountsContext();
  const resolveName = nameOf ?? accountNameOf(accounts);

  return (
    <p className={cn('type-body text-muted', className)}>
      {ruleSentence(rule, resolveName).map((part, index) => (
        part.isValue ? (
          <strong key={index} className="font-semibold text-ink">
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        )
      ))}
    </p>
  );
};

interface RuleRowProps {
  rule: TransactionRule;
  matchCount: number;
  menuItems: MenuAction[];
  onToggle: (isActive: boolean) => void;
  onOpen: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  nameOf?: NameOf;
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

const RuleRow: React.FC<RuleRowProps> = ({
  rule,
  matchCount,
  menuItems,
  onToggle,
  onOpen,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  nameOf,
  drag,
}) => {
  const alwaysFile = isAlwaysFile(rule);
  const categoryAction = rule.actions.find(a => a.field === 'category')?.value;
  const descriptionAction = rule.actions.find(a => a.field === 'description')?.value;
  const { expenseCategories, incomeCategories } = useCategoryContext();
  const allCategories = React.useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);
  const cat = React.useMemo(() => categoryAction ? getCategoryDetails(categoryAction, allCategories) : undefined, [categoryAction, allCategories]);

  return (
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
      className={cn(
        'group relative flex min-h-16 flex-wrap items-center gap-3 py-3 transition-colors duration-150 md:flex-nowrap',
        drag?.isDragging && 'opacity-50',
        !rule.isActive && 'opacity-60'
      )}
    >
      {drag?.dropEdge === 'before' && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-primary" />}
      {drag?.dropEdge === 'after' && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}

      {/* Drag handle */}
      {drag && (
        <span aria-hidden="true" className="hidden shrink-0 cursor-grab text-muted/60 group-hover:text-ink md:block">
          <Icon name="drag_indicator" size={18} />
        </span>
      )}

      {/* Visual Identity Logo / Glyph */}
      <div className="shrink-0">
        {alwaysFile ? (
          <MerchantLogo merchant={rule.name} size={36} className="shrink-0" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
            <Icon name="flash" size={18} />
          </span>
        )}
      </div>

      {/* Rule summary button */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 basis-full cursor-pointer rounded-[var(--radius-md)] py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary md:basis-0"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="type-body-strong truncate text-ink">{rule.name}</span>
          {categoryAction && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-inset py-0.5 pl-1.5 pr-2 text-xs font-semibold text-primary">
              <span className="text-muted">→</span>
              <EntityGlyph icon={cat?.icon} label={categoryAction} color={cat?.color} size={14} />
              <span>{categoryAction}</span>
            </span>
          )}
          {!rule.isActive && <Badge tone="neutral">Off</Badge>}
        </div>

        <RuleSentence rule={rule} nameOf={nameOf} className="mt-0.5" />

        <span className="type-caption mt-0.5 block text-muted">
          {matchCount} {matchCount === 1 ? 'transaction' : 'transactions'} matched
        </span>
      </button>

      {/* Reordering Controls (for ordinary rules) */}
      {(onMoveUp || onMoveDown) && (
        <div className="hidden items-center gap-0.5 md:flex">
          {onMoveUp && (
            <IconButton
              icon="arrow-up-02"
              label="Move up in priority"
              isDisabled={isFirst}
              onPress={onMoveUp}
            />
          )}
          {onMoveDown && (
            <IconButton
              icon="arrow-down-02"
              label="Move down in priority"
              isDisabled={isLast}
              onPress={onMoveDown}
            />
          )}
        </div>
      )}

      {/* Active Toggle Switch */}
      <div className="ml-auto flex items-center gap-2 shrink-0 max-md:w-auto">
        <Switch
          aria-label={`${rule.isActive ? 'Disable' : 'Enable'} ${rule.name}`}
          isSelected={rule.isActive}
          onChange={onToggle}
        >
          {null}
        </Switch>
        <Menu
          title={rule.name}
          trigger={<IconButton icon="more_horiz" label={`More actions for ${rule.name}`} />}
          items={menuItems}
        />
      </div>
    </li>
  );
};

export default RuleRow;

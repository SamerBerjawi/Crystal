import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Account, Currency } from '../../types';
import { heroClassFor } from '../../utils/accountHero';
import { AccountLogo } from '../AccountCard';
import { Button, IconButton } from '../ui/Actions';
import { Menu, type MenuAction } from '../ui/Menu';
import { Amount } from '../ui/Money';
import { cn } from '../../lib/utils';
import type { AccountLink } from '../../utils/accountLinks';
import ConnectionsStrip from './ConnectionsStrip';

export interface ShellAction {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
}

export interface ShellTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface Kpi {
  label: string;
  value: React.ReactNode;
  context?: React.ReactNode;
  /** A small visual under the figure: a sparkline, a gauge, a bar. */
  visual?: React.ReactNode;
}

export interface AccountShellProps {
  account: Account;
  context: string;
  /** The hero figure and its label. */
  value: number;
  valueLabel?: string;
  valueCurrency?: Currency;
  /** One line under the hero figure, such as the change over 30 days. */
  heroNote?: React.ReactNode;
  /** Content on the right of the hero: a card face, a photo, a gauge. */
  heroAside?: React.ReactNode;
  kpis: Kpi[];
  links: AccountLink[];
  onOpenAccount: (id: string) => void;
  onOpenGoals?: () => void;
  banner?: React.ReactNode;
  mainAction?: ShellAction;
  actions?: ShellAction[];
  tabs: ShellTab[];
  onBack: () => void;
  /** Steps to the previous and next account of the same kind. */
  siblings?: { previous?: Account; next?: Account };
}

/**
 * The frame every account page shares (12-account-pages): header, type-coloured hero with key figures, the
 * Connections strip, then tabs. What goes in the Overview tab is each type's own layout.
 */
const AccountShell: React.FC<AccountShellProps> = ({ account, context, value, valueLabel = 'Balance', valueCurrency, heroNote, heroAside, kpis, links, onOpenAccount, onOpenGoals, banner, mainAction, actions = [], tabs, onBack, siblings }) => {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find(tab => tab.id === activeId) ?? tabs[0];
  const menuItems = useMemo<MenuAction[]>(() => actions.map(action => ({ id: action.id, label: action.label, icon: action.icon, onAction: action.onPress })), [actions]);

  return (
    <div className="space-y-5 max-md:space-y-4">
      <header className="flex items-center gap-2">
        <IconButton icon="ArrowLeft" label="Back to accounts" onPress={onBack} tooltipPlacement="bottom" />
        <AccountLogo account={account} />
        <div className="min-w-0 flex-1">
          <h1 className="type-section-title truncate text-ink">{account.name}</h1>
          <p className="type-caption truncate text-muted">{context}</p>
        </div>
        {siblings && (siblings.previous || siblings.next) && (
          <div className="flex shrink-0 gap-1 max-md:hidden">
            <IconButton icon="arrow-left-01" label={siblings.previous ? `Previous: ${siblings.previous.name}` : 'No previous account'} isDisabled={!siblings.previous} onPress={() => siblings.previous && onOpenAccount(siblings.previous.id)} tooltipPlacement="bottom" />
            <IconButton icon="arrow-right-01" label={siblings.next ? `Next: ${siblings.next.name}` : 'No next account'} isDisabled={!siblings.next} onPress={() => siblings.next && onOpenAccount(siblings.next.id)} tooltipPlacement="bottom" />
          </div>
        )}
        {actions.length > 0 && (
          <div className="flex shrink-0 gap-2 max-lg:hidden">
            {actions.map(action => <Button key={action.id} variant="secondary" icon={action.icon} onPress={action.onPress}>{action.label}</Button>)}
          </div>
        )}
        {actions.length > 0 && <div className="lg:hidden max-md:hidden"><Menu title="Account actions" trigger={<IconButton icon="more-horizontal" label="More actions" />} items={menuItems} /></div>}
        {mainAction && <Button icon={mainAction.icon} className="shrink-0 max-md:hidden" onPress={mainAction.onPress}>{mainAction.label}</Button>}
      </header>

      {banner}

      <section aria-label={valueLabel} className={cn('flex gap-6 rounded-[var(--radius-xl)] p-6 text-on-pine max-md:flex-col max-md:p-5 [--focus:var(--on-pine)]', heroClassFor(account.type))}>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
          <div>
            <p className="type-label">{valueLabel}</p>
            <p className="type-figure-hero break-words"><Amount value={value} currency={valueCurrency ?? account.currency} /></p>
            {heroNote && <p className="type-body mt-1">{heroNote}</p>}
          </div>
          {kpis.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {kpis.map(kpi => (
                <div key={kpi.label} className="min-w-0">
                  <dt className="type-caption truncate">{kpi.label}</dt>
                  <dd className="type-figure-row truncate">{kpi.value}</dd>
                  {kpi.context && <dd className="type-caption truncate opacity-90">{kpi.context}</dd>}
                  {kpi.visual && <dd className="mt-1.5">{kpi.visual}</dd>}
                </div>
              ))}
            </dl>
          )}
        </div>
        {heroAside && <div className="flex shrink-0 items-center justify-center md:w-[min(34%,320px)]">{heroAside}</div>}
      </section>

      {(mainAction || actions.length > 0) && (
        <div className="flex gap-2 md:hidden">
          {mainAction && <Button icon={mainAction.icon} className="min-w-0 flex-1" onPress={mainAction.onPress}>{mainAction.label}</Button>}
          {menuItems.length > 0 && <Menu title="Account actions" trigger={<IconButton icon="more-horizontal" label="More actions" />} items={menuItems} />}
        </div>
      )}

      <ConnectionsStrip account={account} links={links} onOpenAccount={onOpenAccount} onOpenGoals={onOpenGoals} />

      {tabs.length > 1 && (
        <div role="tablist" aria-label={`${account.name} sections`} className="no-scrollbar flex gap-5 overflow-x-auto border-b border-line">
          {tabs.map(tab => {
            const isActive = tab.id === active?.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(tab.id)}
                className={cn('relative h-11 shrink-0 cursor-pointer whitespace-nowrap text-sm font-bold', isActive ? 'text-ink' : 'text-muted hover:text-ink')}
              >
                {tab.label}
                {isActive && <motion.span layoutId="account-tab" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-pill" />}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" className="space-y-4">{active?.content}</div>
    </div>
  );
};

export default AccountShell;

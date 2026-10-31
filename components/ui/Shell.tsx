import React, { useEffect, useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { motion } from 'motion/react';
import { CrystalLogo } from '../../constants';
import { APP_VERSION } from '../../version';
import type { Page, Theme, User } from '../../types';
import { HUBS, PHONE_BAR_HUBS, hubForPage } from '../../utils/navigation';
import { setUrlTab, useUrlTab } from '../../hooks/useUrlTab';
import Icon from './Icon';
import { IconButton } from './Actions';
import { Menu } from './Menu';
import { BottomSheet, SheetRow } from './Overlays';
import { cn } from '../../lib/utils';

const HIGHLIGHT = { type: 'spring', stiffness: 420, damping: 38 } as const;

export interface ShellProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  user: User;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  isSyncing: boolean;
  onSync: () => void;
  onSearch: () => void;
  onCreate: () => void;
  onLogout: () => void;
  notifications: React.ReactNode;
}

const isDarkNow = (theme: Theme) =>
  theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark';

/** Keyboard users jump past the navigation straight to the page. */
export const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}
    className="fixed left-4 top-2 z-[var(--z-toast)] -translate-y-20 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary focus:translate-y-0"
  >
    Skip to content
  </a>
);

const Avatar: React.FC<{ user: User; size?: number }> = ({ user, size = 36 }) => {
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  return user.profilePictureUrl ? (
    <img src={user.profilePictureUrl} alt="" style={{ width: size, height: size }} className="rounded-full bg-inset object-cover" loading="lazy" decoding="async" />
  ) : (
    <span style={{ width: size, height: size }} className="type-caption flex items-center justify-center rounded-full bg-primary-soft text-ink">{initials}</span>
  );
};

/** Seven hub pills. They compress at tablet widths and never become a menu. */
const TopPills: React.FC<Pick<ShellProps, 'currentPage' | 'setCurrentPage'>> = ({ currentPage, setCurrentPage }) => {
  const activeHub = hubForPage(currentPage);
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-0.5 rounded-[22px] border border-line bg-surface p-1">
        {HUBS.map(hub => {
          const isActive = hub.id === activeHub.id;
          return (
            <li key={hub.id}>
              <button
                type="button"
                onClick={() => setCurrentPage(hub.home)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-[38px] cursor-pointer items-center whitespace-nowrap rounded-full px-3 text-[.8125rem] font-bold transition-colors duration-[var(--duration-base)] pointer-coarse:h-11 lg:px-[15px] lg:text-sm',
                  isActive ? 'text-on-primary' : 'text-ink hover:bg-inset'
                )}
              >
                {isActive && <motion.span layoutId="hub-pill" transition={HIGHLIGHT} className="absolute inset-0 rounded-full bg-primary" />}
                <span className="relative">{hub.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

/** The hub's pages, underlined. Scrolls sideways when it doesn't fit, with the next tab partly showing. */
export const TabRow: React.FC<Pick<ShellProps, 'currentPage' | 'setCurrentPage'>> = ({ currentPage, setCurrentPage }) => {
  const hub = hubForPage(currentPage);
  const activeRef = useRef<HTMLButtonElement>(null);
  const urlTab = useUrlTab();

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [currentPage, urlTab]);

  if (!hub.tabs.length) return null;

  return (
    <nav aria-label={`${hub.label} pages`} className="border-b border-line">
      <ul className="no-scrollbar mx-auto flex max-w-[1488px] gap-5 overflow-x-auto px-4 md:px-6 md:pl-[84px] lg:pl-[96px] lg:pr-8">
        {hub.tabs.map(tab => {
          const isActive = tab.page === currentPage && (tab.tab ?? null) === urlTab;
          return (
            <li key={tab.label} className="shrink-0">
              <button
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => { setCurrentPage(tab.page); setUrlTab(tab.tab ?? null); }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-11 cursor-pointer items-center whitespace-nowrap text-sm font-bold transition-colors duration-[var(--duration-base)]',
                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                )}
              >
                {tab.label}
                {isActive && <motion.span layoutId="tab-line" transition={HIGHLIGHT} className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const ProfileMenu: React.FC<ShellProps> = ({ user, setCurrentPage, isPrivacyMode, togglePrivacyMode, onLogout }) => (
  <Menu
    title="Your account"
    trigger={
      <AriaButton aria-label="Your account" className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full pointer-coarse:size-11">
        <Avatar user={user} />
      </AriaButton>
    }
    header={
      <div className="px-2.5 pb-2 pt-1.5">
        <p className="type-body-strong truncate text-ink">{user.firstName} {user.lastName}</p>
        <p className="type-caption truncate text-muted">{user.email}</p>
      </div>
    }
    footer={<p className="type-caption px-2.5 pb-1 pt-2 text-muted tabular-nums">{APP_VERSION}</p>}
    items={[
      { id: 'profile', label: 'Profile', icon: 'person', onAction: () => setCurrentPage('Personal Info') },
      { id: 'preferences', label: 'Preferences', icon: 'settings', onAction: () => setCurrentPage('Preferences') },
      { id: 'privacy', label: isPrivacyMode ? 'Show amounts' : 'Hide amounts', icon: isPrivacyMode ? 'visibility' : 'visibility_off', onAction: togglePrivacyMode },
      { id: 'logout', label: 'Sign out', icon: 'logout', startsGroup: true, isDestructive: true, onAction: onLogout },
    ]}
  />
);

/** Logo, seven pills, then notifications and profile. The logo steps aside on narrow tablets, where the pills need the room. */
export const TopBar: React.FC<ShellProps> = props => (
  <div className="mx-auto flex h-[72px] max-w-[1488px] items-center justify-between gap-2 px-4 lg:px-8">
    <button
      type="button"
      onClick={() => props.setCurrentPage('Dashboard')}
      aria-label="Crystal, go to Overview"
      className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full max-[899px]:hidden"
    >
      <CrystalLogo showText={false} />
      <span className="type-card-title hidden text-ink xl:block">Crystal</span>
    </button>
    <TopPills currentPage={props.currentPage} setCurrentPage={props.setCurrentPage} />
    <div className="flex shrink-0 items-center gap-1">
      {props.notifications}
      <ProfileMenu {...props} />
    </div>
  </div>
);

/** Seven tools in frosted glass, vertically centred in the left margin (D-018, D-052). Lock joins in module 11. */
export const ToolRail: React.FC<ShellProps> = ({ currentPage, setCurrentPage, theme, setTheme, isSyncing, onSync, onSearch, onCreate }) => {
  const isDark = isDarkNow(theme);
  const tool = { variant: 'glass', tooltipPlacement: 'right', iconSize: 24, className: 'size-11' } as const;
  return (
    <nav aria-label="Tools" className="glass-float fixed left-3 top-1/2 z-[var(--z-bar)] flex w-[60px] -translate-y-1/2 flex-col items-center gap-1 rounded-[30px] p-2 lg:left-4">
      <IconButton {...tool} icon="search" label="Search (⌘K)" onPress={onSearch} />
      <IconButton {...tool} icon="add" label="Add transaction (N)" onPress={onCreate} />
      <IconButton {...tool} icon="today" label="Today" isActive={currentPage === 'Schedule & Bills'} onPress={() => setCurrentPage('Schedule & Bills')} />
      <IconButton {...tool} icon="review_queue" label="Review queue" onPress={() => { setCurrentPage('Transactions'); setUrlTab('review'); }} />
      <IconButton {...tool} icon="sync_banks" label="Sync banks" isBusy={isSyncing} onPress={onSync} />
      <IconButton {...tool} icon="settings" label="Settings" isActive={hubForPage(currentPage).id === 'settings'} onPress={() => setCurrentPage('Personal Info')} />
      <IconButton {...tool} icon={isDark ? 'light_mode' : 'dark_mode'} label={isDark ? 'Use light theme' : 'Use dark theme'} onPress={() => setTheme(isDark ? 'light' : 'dark')} />
    </nav>
  );
};

/** Logo, Search, notifications and Create. Phones. */
export const PhoneTopBar: React.FC<ShellProps> = ({ setCurrentPage, onSearch, onCreate, notifications }) => (
  <div className="flex h-14 items-center justify-between gap-2 px-4">
    <button type="button" onClick={() => setCurrentPage('Dashboard')} aria-label="Crystal, go to Overview" className="flex min-h-11 cursor-pointer items-center">
      <CrystalLogo showText={false} />
    </button>
    <div className="flex items-center gap-1">
      <IconButton icon="search" label="Search" iconSize={24} onPress={onSearch} />
      {notifications}
      <IconButton icon="add" label="Add transaction" variant="primary" iconSize={24} onPress={onCreate} />
    </div>
  </div>
);

/** True while the on-screen keyboard covers the page, so the bar can step aside (D-070). */
const useKeyboardOpen = () => {
  const [isOpen, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const check = () => setOpen(window.innerHeight - viewport.height > 150);
    viewport.addEventListener('resize', check);
    return () => viewport.removeEventListener('resize', check);
  }, []);
  return isOpen;
};

const barItem = 'relative flex h-[58px] min-w-0 flex-[1_1_auto] cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[20px] text-xs font-bold text-ink';

/** Overview, Accounts, Transactions, Planning and More, in glass, always labelled (D-054). */
export const PhoneBar: React.FC<ShellProps> = props => {
  const { currentPage, setCurrentPage, theme, setTheme, isPrivacyMode, togglePrivacyMode, isSyncing, onSync, onLogout, user } = props;
  const [isMoreOpen, setMoreOpen] = useState(false);
  const isKeyboardOpen = useKeyboardOpen();
  const activeHub = hubForPage(currentPage);
  const barHubs = HUBS.filter(hub => PHONE_BAR_HUBS.includes(hub.id));
  const moreHubs = HUBS.filter(hub => !PHONE_BAR_HUBS.includes(hub.id));
  const isMoreActive = moreHubs.includes(activeHub);
  const isDark = isDarkNow(theme);

  const go = (page: Page) => {
    setCurrentPage(page);
    setMoreOpen(false);
  };

  return (
    <>
      {!isKeyboardOpen && (
        <nav aria-label="Main" className="glass-float fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom,0px))] z-[var(--z-bar)] flex gap-0.5 rounded-[var(--radius-2xl)] p-[7px]">
          {barHubs.map(hub => {
            const isActive = hub.id === activeHub.id;
            return (
              <button key={hub.id} type="button" onClick={() => go(hub.home)} aria-current={isActive ? 'page' : undefined} className={barItem}>
                {isActive && <motion.span layoutId="bar-pill" transition={HIGHLIGHT} className="absolute inset-0 rounded-[20px] bg-primary-soft" />}
                <Icon name={hub.icon} size={24} weight={isActive ? 'bold' : 'regular'} className="relative" />
                <span className="relative whitespace-nowrap px-1">{hub.label}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={isMoreOpen} aria-current={isMoreActive ? 'page' : undefined} className={barItem}>
            {isMoreActive && <motion.span layoutId="bar-pill" transition={HIGHLIGHT} className="absolute inset-0 rounded-[20px] bg-primary-soft" />}
            <Icon name="more_horiz" size={24} weight={isMoreActive ? 'bold' : 'regular'} className="relative" />
            <span className="relative">More</span>
          </button>
        </nav>
      )}

      <BottomSheet isOpen={isMoreOpen} onClose={() => setMoreOpen(false)} title="More" height="content">
        <div className="-mx-1 flex flex-col">
          {moreHubs.map(hub => (
            <SheetRow key={hub.id} icon={hub.icon} label={hub.label} isCurrent={hub.id === activeHub.id} onPress={() => go(hub.home)} />
          ))}
          <div className="mx-3 my-1.5 border-t border-line" />
          <SheetRow icon="sync_banks" label={isSyncing ? 'Syncing banks' : 'Sync banks'} onPress={onSync} />
          <SheetRow icon={isPrivacyMode ? 'visibility' : 'visibility_off'} label={isPrivacyMode ? 'Show amounts' : 'Hide amounts'} onPress={togglePrivacyMode} />
          <SheetRow icon={isDark ? 'light_mode' : 'dark_mode'} label={isDark ? 'Use light theme' : 'Use dark theme'} onPress={() => setTheme(isDark ? 'light' : 'dark')} />
          <div className="mx-3 my-1.5 border-t border-line" />
          <SheetRow icon="person" label={`${user.firstName} ${user.lastName}`} isCurrent={currentPage === 'Personal Info'} onPress={() => go('Personal Info')} />
          <SheetRow icon="logout" label="Sign out" tone="danger" onPress={() => { setMoreOpen(false); onLogout(); }} />
          <p className="type-caption px-3 pt-2 text-muted tabular-nums">{APP_VERSION}</p>
        </div>
      </BottomSheet>
    </>
  );
};

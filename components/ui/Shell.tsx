import React, { useEffect, useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { motion } from 'motion/react';
import { CrystalLogo } from '../../constants';
import { APP_VERSION } from '../../version';
import type { Page, Theme, User } from '../../types';
import { HUBS, PHONE_BAR_HUBS, hubForPage } from '../../utils/navigation';
import { setUrlTab, useUrlTab } from '../../hooks/useUrlTab';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  SearchingIcon,
  AddInvoiceIcon,
  AiAutoRotateIcon,
  LogsIcon,
  ChartEvaluationIcon,
  ChartCandlestickIcon,
  Settings05Icon,
  Sun01Icon,
  Moon02Icon,
  EyeClosedIcon,
  EyeIcon,
} from '@hugeicons/core-free-icons';
import Icon from './Icon';
import { IconButton, Tooltip } from './Actions';
import { Spinner } from './States';
import { Dock, DockIcon, DockSeparator } from './dock';
import { SwitchButton } from './switch-button';
import { Menu } from './Menu';
import { BottomSheet, SheetRow } from './Overlays';
import { cn } from '../../lib/utils';

const HIGHLIGHT = { type: 'spring', stiffness: 420, damping: 38 } as const;

export interface ShellProps {
  currentPage: Page;
  setCurrentPage: (page: Page, tab?: string | null) => void;
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
  /** Unset in demo mode, which has no server to hold a lock. */
  onLock?: () => void;
  notifications: React.ReactNode;
  syncStatus?: 'saved' | 'saving' | 'unsaved';
}

const isDarkNow = (theme: Theme) =>
  theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark';

/** Keyboard users jump past the navigation straight to the page. */
export const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}
    className="fixed left-4 top-2 z-[var(--z-toast)] -translate-y-20 rounded-full bg-pill px-4 py-2 text-sm font-bold text-on-pill focus:translate-y-0"
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

/** Collapsible left sidebar with nested sub-page tree and collapsed hover flyout. */
export const Sidebar: React.FC<Pick<ShellProps, 'currentPage' | 'setCurrentPage'>> = ({ currentPage, setCurrentPage }) => {
  const [isCollapsed, setCollapsed] = useLocalStorage<boolean>('crystal-sidebar-collapsed', typeof window !== 'undefined' && window.innerWidth < 1024);
  const activeHub = hubForPage(currentPage);
  const urlTab = useUrlTab();
  const [openHubIds, setOpenHubIds] = useState<Record<string, boolean>>(() => ({ [activeHub.id]: true }));
  const [hoveredHubId, setHoveredHubId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setOpenHubIds(prev => (prev[activeHub.id] ? prev : { ...prev, [activeHub.id]: true }));
  }, [activeHub.id]);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
  }, []);

  const effectivePage: Page =
    currentPage === 'AccountDetail' ? 'Accounts' :
    currentPage === 'HoldingDetail' ? 'Investments' :
    currentPage;

  const isTabActive = (hub: (typeof HUBS)[number], tab: (typeof HUBS)[number]['tabs'][number]) => {
    if (hub.id !== activeHub.id) return false;
    const exactMatch = hub.tabs.some(t => t.page === effectivePage && (t.tab ?? null) === urlTab);
    return tab.page === effectivePage && (exactMatch ? (tab.tab ?? null) === urlTab : !tab.tab);
  };

  const handleHubPress = (hub: (typeof HUBS)[number]) => {
    const isCurrentHub = hub.id === activeHub.id;
    if (!isCollapsed && hub.tabs.length > 0) {
      if (isCurrentHub) {
        setOpenHubIds(prev => ({ ...prev, [hub.id]: !prev[hub.id] }));
        return;
      }
      setOpenHubIds(prev => ({ ...prev, [hub.id]: true }));
    }
    setCurrentPage(hub.home, null);
    setUrlTab(null);
  };

  const handleMouseEnterHub = (hubId: string) => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    setHoveredHubId(hubId);
  };

  const handleMouseLeaveHub = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => setHoveredHubId(null), 120);
  };

  const renderSubmenuTree = (hub: (typeof HUBS)[number], onSelectDone?: () => void) => (
    <ul className="flex flex-col">
      {hub.tabs.map((tab, index) => {
        const isSubActive = isTabActive(hub, tab);
        const isLast = index === hub.tabs.length - 1;
        return (
          <li key={tab.label} className="relative pl-4 pt-1">
            {!isLast && (
              <span
                aria-hidden="true"
                className=" pointer-events-none absolute bottom-0 left-0 top-0 border-l-[1.5px] border-line-strong"
              />
            )}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 h-[22px] w-3.5 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px] border-line-strong"
            />
            <button
              type="button"
              onClick={() => {
                setCurrentPage(tab.page, tab.tab ?? null);
                setUrlTab(tab.tab ?? null);
                onSelectDone?.();
              }}
              aria-current={isSubActive ? 'page' : undefined}
              className={cn(
                'relative flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 text-[.8125rem] transition-colors duration-[var(--duration-fast)]',
                isSubActive
                  ? 'bg-inset font-bold text-ink'
                  : 'font-medium text-muted hover:bg-inset/60 hover:text-ink'
              )}
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                {tab.icon && <Icon name={tab.icon} size={15} className={cn('shrink-0', isSubActive ? 'text-ink' : 'text-muted')} />}
                <span className="truncate">{tab.label}</span>
              </span>
              {isSubActive && <Icon name="chevron_right" size={15} className="shrink-0 text-ink" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        'safe-top relative z-[var(--z-sticky)] flex h-dvh shrink-0 flex-col bg-black/[0.015] dark:bg-white/[0.02] transition-[width] duration-[var(--duration-base)] ease-[var(--ease-standard)]',
        isCollapsed ? 'w-[76px]' : 'w-[252px]'
      )}
    >
      {/* Subtle separator with faded edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-px"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, var(--line) 15%, var(--line) 85%, transparent 100%)',
        }}
      />

      {/* Floating collapse / expand button on the right border */}
      <button
        type="button"
        onClick={() => setCollapsed(prev => !prev)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className=" 
          absolute -right-3.5 top-[22px] z-20 flex size-7 cursor-pointer items-center justify-center
          rounded-full border border-line bg-solid/90 backdrop-blur-md text-muted hover:text-ink shadow-xs
          transition-transform duration-[var(--duration-fast)] hover:scale-105 active:scale-95
        "
      >
        <Icon name={isCollapsed ? 'chevron_right' : 'chevron_left'} size={15} />
      </button>

      {/* Top Logo */}
      <div className={cn('flex h-[72px] shrink-0 items-center', isCollapsed ? 'justify-center px-2' : 'px-5')}>
        <button
          type="button"
          onClick={() => {
            setCurrentPage('Dashboard', null);
            setUrlTab(null);
          }}
          aria-label="Crystal, go to Home"
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-2xl outline-none transition-opacity hover:opacity-85',
            isCollapsed && 'justify-center'
          )}
        >
          <CrystalLogo showText={false} />
          {!isCollapsed && <span className="type-card-title text-ink">Crystal</span>}
        </button>
      </div>

      {/* Main Navigation */}
      <nav
        aria-label="Main"
        className={cn(
          'no-scrollbar flex-1 py-2',
          isCollapsed ? 'overflow-visible px-3' : 'overflow-y-auto overflow-x-hidden px-4'
        )}
      >
        <ul className="flex flex-col gap-1.5">
          {HUBS.map(hub => {
            const isActive = hub.id === activeHub.id;
            const hasTabs = hub.tabs.length > 0;
            const isOpen = Boolean(openHubIds[hub.id]);
            const isHovered = hoveredHubId === hub.id;

            return (
              <li
                key={hub.id}
                className="relative"
                onMouseEnter={() => isCollapsed && handleMouseEnterHub(hub.id)}
                onMouseLeave={() => isCollapsed && handleMouseLeaveHub()}
                onFocus={() => isCollapsed && handleMouseEnterHub(hub.id)}
                onBlur={e => {
                  if (isCollapsed && !e.currentTarget.contains(e.relatedTarget as Node)) {
                    handleMouseLeaveHub();
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => handleHubPress(hub)}
                  aria-label={isCollapsed ? hub.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  aria-expanded={!isCollapsed && hasTabs ? isOpen : undefined}
                  className={cn(
                    'relative flex h-11 cursor-pointer items-center rounded-xl text-sm transition-colors duration-[var(--duration-fast)]',
                    isCollapsed
                      ? 'mx-auto size-11 justify-center px-0'
                      : 'w-full justify-between px-3.5',
                    isActive || (isCollapsed && isHovered)
                      ? 'bg-inset font-bold text-ink'
                      : 'font-medium text-muted hover:bg-inset/60 hover:text-ink'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon
                      name={hub.icon}
                      size={20}
                      weight={isActive ? 'bold' : 'regular'}
                      className={cn('shrink-0', isActive ? 'text-ink' : 'text-muted')}
                    />
                    {!isCollapsed && <span className="truncate">{hub.label}</span>}
                  </span>
                  {!isCollapsed && hasTabs && (
                    <Icon
                      name={isOpen ? 'chevron_up' : 'chevron_down'}
                      size={16}
                      className="shrink-0 text-muted"
                    />
                  )}
                </button>

                {/* Expanded mode: inline nested tree */}
                {!isCollapsed && hasTabs && isOpen && (
                  <div className="mb-1 ml-[22px] mt-0.5 pr-1">
                    {renderSubmenuTree(hub)}
                  </div>
                )}

                {/* Collapsed mode: floating label pill + submenu tree card on hover */}
                {isCollapsed && isHovered && (
                  <div
                    className="absolute left-full top-0 z-[var(--z-popover)] pl-3"
                    onMouseEnter={() => handleMouseEnterHub(hub.id)}
                    onMouseLeave={handleMouseLeaveHub}
                  >
                    <div className="flex flex-col items-start">
                      <div className="mt-1.5 inline-flex items-center rounded-xl bg-pill px-3.5 py-1.5 text-xs font-bold text-on-pill shadow-md whitespace-nowrap">
                        {hub.label}
                      </div>
                      {hasTabs && (
                        <div className="mt-2 min-w-[196px] rounded-2xl border border-line bg-solid p-3 shadow-lg">
                          <div className="ml-1.5">
                            {renderSubmenuTree(hub, () => setHoveredHubId(null))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

/** The active hub's page tabs rendered as top pills. */
export const TopPills: React.FC<Pick<ShellProps, 'currentPage' | 'setCurrentPage'>> = ({ currentPage, setCurrentPage }) => {
  const hub = hubForPage(currentPage);
  const activeRef = useRef<HTMLButtonElement>(null);
  const urlTab = useUrlTab();

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [currentPage, urlTab]);

  if (!hub.tabs.length) return null;

  const effectivePage: Page =
    currentPage === 'AccountDetail' ? 'Accounts' :
    currentPage === 'HoldingDetail' ? 'Investments' :
    currentPage;
  const exactMatch = hub.tabs.some(t => t.page === effectivePage && (t.tab ?? null) === urlTab);

  return (
    <nav aria-label={`${hub.label} pages`} className="max-w-full overflow-hidden">
      <ul className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[22px] surface-card p-1">
        {hub.tabs.map(tab => {
          const isActive = tab.page === effectivePage && (exactMatch ? (tab.tab ?? null) === urlTab : !tab.tab);
          return (
            <li key={tab.label} className="shrink-0">
              <button
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => { setCurrentPage(tab.page, tab.tab ?? null); setUrlTab(tab.tab ?? null); }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-[38px] cursor-pointer items-center whitespace-nowrap rounded-full px-3 text-[.8125rem] font-bold transition-colors duration-[var(--duration-base)] pointer-coarse:h-11 lg:px-[15px] lg:text-sm',
                  isActive ? 'text-on-pill' : 'text-ink hover:bg-inset'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId={`page-pill-${hub.id}`}
                    transition={HIGHLIGHT}
                    className="absolute inset-0 rounded-full bg-pill"
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {tab.icon && (
                    <Icon
                      name={tab.icon}
                      size={15}
                      className={cn('shrink-0 transition-opacity', isActive ? 'text-on-pill' : 'text-muted')}
                    />
                  )}
                  <span>{tab.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};


/** True when a swipe starting on this element belongs to something else: a scrolling strip, field, chart or dialog. */
const ownsHorizontalSwipe = (start: EventTarget | null): boolean => {
  let el = start instanceof Element ? start : null;
  while (el && el !== document.body) {
    if (el.matches('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="slider"], [data-no-swipe], svg')) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
};

/** Phone: swipe the page sideways to move to the next or previous tab of the current hub. */
export const usePageTabSwipe = (currentPage: Page, setCurrentPage: ShellProps['setCurrentPage']) => {
  const urlTab = useUrlTab();
  const start = useRef<{ x: number; y: number; blocked: boolean } | null>(null);

  const hub = hubForPage(currentPage);
  const effectivePage: Page =
    currentPage === 'AccountDetail' ? 'Accounts' :
    currentPage === 'HoldingDetail' ? 'Investments' :
    currentPage;
  const exactMatch = hub.tabs.some(t => t.page === effectivePage && (t.tab ?? null) === urlTab);
  const index = hub.tabs.findIndex(tab => tab.page === effectivePage && (exactMatch ? (tab.tab ?? null) === urlTab : !tab.tab));
  const isDetail = currentPage === 'AccountDetail' || currentPage === 'HoldingDetail';

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, blocked: e.touches.length > 1 || ownsHorizontalSwipe(e.target) };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s0 = start.current;
      start.current = null;
      if (!s0 || s0.blocked || isDetail || index < 0 || hub.tabs.length < 2) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s0.x;
      const dy = t.clientY - s0.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const next = hub.tabs[index + (dx < 0 ? 1 : -1)];
      if (!next) return;
      setCurrentPage(next.page, next.tab ?? null);
      setUrlTab(next.tab ?? null);
    },
    onTouchCancel: () => { start.current = null; },
  };
};

/** Mobile top pill row for the active hub's page tabs. */
export const TabRow: React.FC<Pick<ShellProps, 'currentPage' | 'setCurrentPage'>> = ({ currentPage, setCurrentPage }) => {
  const hub = hubForPage(currentPage);
  if (!hub.tabs.length) return null;

  return (
    <div className="flex justify-center px-4 pb-2 pt-0.5 md:px-6">
      <TopPills currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
};

const ProfileMenu: React.FC<ShellProps> = ({ user, setCurrentPage, isPrivacyMode, togglePrivacyMode, onLogout, onLock }) => (
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
      ...(onLock ? [{ id: 'lock', label: 'Lock Crystal', icon: 'lock', startsGroup: true, onAction: onLock }] : []),
      { id: 'logout', label: 'Sign out', icon: 'logout', startsGroup: !onLock, isDestructive: true, onAction: onLogout },
    ]}
  />
);

/** Page tab pills in the center, then notifications and profile on the right. */
export const TopBar: React.FC<ShellProps> = props => (
  <div className="mx-auto flex h-[72px] max-w-[1488px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
    <div className="hidden flex-1 items-center justify-start min-w-0 lg:flex" aria-hidden="true" />
    <div className="flex min-w-0 items-center justify-center">
      <TopPills currentPage={props.currentPage} setCurrentPage={props.setCurrentPage} />
    </div>
    <div className="flex flex-1 shrink-0 items-center justify-end gap-1.5">
      {props.syncStatus && props.syncStatus !== 'saved' && (
        <span
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-full bg-inset px-2.5 py-1 text-xs font-medium text-muted"
        >
          {props.syncStatus === 'saving' ? (
            <>
              <Spinner className="size-3" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-amber" aria-hidden="true" />
              <span>Unsaved</span>
            </>
          )}
        </span>
      )}
      {props.notifications}
      <ProfileMenu {...props} />
    </div>
  </div>
);

interface DockToolProps {
  icon: any;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  isBusy?: boolean;
  mouseX?: any;
}

const DockTool: React.FC<DockToolProps> = ({ icon, label, onPress, isActive, isBusy, mouseX }) => (
  <DockIcon mouseX={mouseX}>
    <Tooltip label={label} placement="top" delay={150}>
      <AriaButton
        onPress={onPress}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        isPending={isBusy}
        className={cn(
          'flex size-full items-center justify-center rounded-full text-ink outline-none transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-primary/50',
          isActive
            ? 'bg-primary-soft text-primary font-bold shadow-xs ring-1 ring-primary/20'
            : 'hover:bg-primary-soft data-[hovered]:bg-primary-soft hover:text-primary data-[hovered]:text-primary active:scale-95'
        )}
      >
        {isBusy ? (
          <Spinner className="size-5" />
        ) : (
          <HugeiconsIcon
            icon={icon}
            size={20}
            strokeWidth={isActive ? 2 : 1.5}
            className={cn('shrink-0', isActive && 'text-primary')}
          />
        )}
      </AriaButton>
    </Tooltip>
  </DockIcon>
);

/**
 * Dock-based tool rail built on @magicui/dock, with custom spacing,
 * spring physics magnification, Hugeicons, and hover tooltips.
 */
export const ToolRail: React.FC<ShellProps> = ({
  currentPage,
  setCurrentPage,
  theme,
  setTheme,
  isPrivacyMode,
  togglePrivacyMode,
  isSyncing,
  onSync,
  onSearch,
  onCreate,
}) => {
  const isDark = isDarkNow(theme);

  return (
    <Dock
      direction="middle"
      role="toolbar"
      aria-label="Tools"
      iconSize={36}
      iconMagnification={48}
      className="glass-float fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-1/2 z-[var(--z-bar)] mt-0 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-2xl"
    >
      <DockTool icon={SearchingIcon} label="Search (⌘K)" onPress={onSearch} />
      <DockTool icon={AddInvoiceIcon} label="Add transaction (N)" onPress={onCreate} />
      <DockTool
        icon={AiAutoRotateIcon}
        label={isSyncing ? 'Syncing banks...' : 'Sync banks'}
        isBusy={isSyncing}
        onPress={onSync}
      />

      <DockSeparator />

      <DockTool
        icon={LogsIcon}
        label="Ledger"
        isActive={currentPage === 'Transactions'}
        onPress={() => {
          setCurrentPage('Transactions');
          setUrlTab(null);
        }}
      />
      <DockTool
        icon={ChartCandlestickIcon}
        label="Portfolio"
        isActive={currentPage === 'Investments' || currentPage === 'HoldingDetail'}
        onPress={() => {
          setCurrentPage('Investments');
          setUrlTab(null);
        }}
      />
      <DockTool
        icon={ChartEvaluationIcon}
        label="Forecast"
        isActive={currentPage === 'Forecasting'}
        onPress={() => {
          setCurrentPage('Forecasting');
          setUrlTab(null);
        }}
      />

      <DockSeparator />

      <DockTool
        icon={Settings05Icon}
        label="Settings"
        isActive={hubForPage(currentPage).id === 'settings'}
        onPress={() => {
          setCurrentPage('Personal Info');
          setUrlTab(null);
        }}
      />
      <DockIcon>
        <Tooltip label={isDark ? 'Use light theme' : 'Use dark theme'} placement="top" delay={150}>
          <SwitchButton
            theme={isDark ? 'dark' : 'light'}
            onThemeChange={nextTheme => setTheme(nextTheme)}
            aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
            className="flex size-full items-center justify-center rounded-full text-ink outline-none transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-primary/50 hover:bg-primary-soft data-[hovered]:bg-primary-soft hover:text-primary data-[hovered]:text-primary active:scale-95"
          >
            <HugeiconsIcon
              icon={isDark ? Sun01Icon : Moon02Icon}
              size={20}
              strokeWidth={1.5}
              className="shrink-0"
            />
          </SwitchButton>
        </Tooltip>
      </DockIcon>
      <DockTool
        icon={isPrivacyMode ? EyeClosedIcon : EyeIcon}
        label={isPrivacyMode ? 'Show amounts' : 'Hide amounts'}
        isActive={isPrivacyMode}
        onPress={togglePrivacyMode}
      />
    </Dock>
  );
};

/** Logo, Search, notifications and Create. Phones. */
export const PhoneTopBar: React.FC<ShellProps> = ({ setCurrentPage, onSearch, onCreate, notifications }) => (
  <div className="flex h-14 items-center justify-between gap-2 px-4">
    <button type="button" onClick={() => { setCurrentPage('Dashboard', null); setUrlTab(null); }} aria-label="Crystal, go to Home" className="flex min-h-11 cursor-pointer items-center">
      <CrystalLogo showText={false} />
    </button>
    <div className="flex items-center gap-1">
      <IconButton icon="search-01" label="Search" iconSize={24} onPress={onSearch} />
      {notifications}
      <IconButton icon="add-01" label="Add transaction" variant="primary" iconSize={24} onPress={onCreate} />
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

const barItem = 'relative flex h-[58px] min-w-11 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[20px] text-xs font-bold text-ink';

/** Home, Accounts, Transactions, Planning and More, in glass, always labelled (D-054). */
export const PhoneBar: React.FC<ShellProps> = props => {
  const { currentPage, setCurrentPage, theme, setTheme, isPrivacyMode, togglePrivacyMode, isSyncing, onSync, onLogout, onLock, user } = props;
  const [isMoreOpen, setMoreOpen] = useState(false);
  const isKeyboardOpen = useKeyboardOpen();
  const activeHub = hubForPage(currentPage);
  const barHubs = HUBS.filter(hub => PHONE_BAR_HUBS.includes(hub.id));
  const moreHubs = HUBS.filter(hub => !PHONE_BAR_HUBS.includes(hub.id));
  const isMoreActive = moreHubs.includes(activeHub);
  const isDark = isDarkNow(theme);

  const go = (page: Page) => {
    setCurrentPage(page, null);
    setUrlTab(null);
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
          {onLock && <SheetRow icon="lock" label="Lock Crystal" onPress={() => { setMoreOpen(false); onLock(); }} />}
          <SheetRow icon="logout" label="Sign out" tone="danger" onPress={() => { setMoreOpen(false); onLogout(); }} />
          <p className="type-caption px-3 pt-2 text-muted tabular-nums">{APP_VERSION}</p>
        </div>
      </BottomSheet>
    </>
  );
};

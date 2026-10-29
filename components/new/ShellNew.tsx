import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { cn } from '../../lib/utils';
import type { Theme, User } from '../../types';
import { NEW_PAGE_SUBTITLES, NEW_PAGE_TITLES, newNavPageFor, newPathFor, type NewPage } from '../../utils/newRoutes';
import { NvIcon, type NvIconName } from './NvIcon';
import { Button, IconButton, SegmentedTabs } from './ui';
import { Drawer, useMediaQuery } from './Drawer';
import ScrollIndex from '../kokonutui/scroll-index';
import { ToastHostNew } from './toast';
import { ConfirmHostNew } from './ConfirmDialog';
import { ErrorBoundaryNew } from './ErrorPanel';
import { PageSkeletonNew, type SkeletonShape } from './Skeleton';
import { ShellNewContext, type PageActionConfig, type PageSearchConfig, type PageTabsConfig } from './shellContext';
import { HeaderSearch, type PageTarget } from './HeaderSearch';
import { QuickAddSheet } from './transactions/sheets';
import './new.css';

/*
 * App frame for the New pages (UI_UX_DESIGN_REFERENCE.md §2, §11 R4). No sidebar: a grey top band holds the
 * header row (menu button, logo disc, two-tone title, the page's search, quick add, notifications, profile) and
 * the page's tabs (Q7). The menu opens the grouped navigation in a drawer (left on desktop, bottom sheet on
 * phones). Below 1024px a floating dock shows Home, Accounts, Activity, Forecast and More with names (§13, §14);
 * the page's primary action is the header's violet button on every width (§14).
 */

interface NavItem { page: NewPage; label: string; icon: NvIconName }

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'Overview', items: [
    { page: 'Dashboard', label: 'Dashboard', icon: 'dashboard' },
    { page: 'Accounts', label: 'Accounts', icon: 'wallet' },
    { page: 'Transactions', label: 'Transactions', icon: 'transactions' },
    { page: 'Reports', label: 'Reports', icon: 'analytics' },
  ] },
  { title: 'Planning', items: [
    { page: 'Budget', label: 'Budget', icon: 'budget' },
    { page: 'Forecasting', label: 'Forecasting', icon: 'forecast' },
    { page: 'Schedule & Bills', label: 'Schedule', icon: 'calendar' },
    { page: 'Investments', label: 'Investments', icon: 'investments' },
  ] },
  { title: 'Manage', items: [
    { page: 'Subscriptions', label: 'Subscriptions', icon: 'repeat' },
    { page: 'Quotes & Invoices', label: 'Invoices', icon: 'invoice' },
    { page: 'Tasks', label: 'Tasks', icon: 'tasks' },
    { page: 'Challenges', label: 'Challenges', icon: 'award' },
    { page: 'Settings', label: 'Settings', icon: 'settings' },
  ] },
];

const DOCK: NavItem[] = [
  { page: 'Dashboard', label: 'Home', icon: 'home' },
  { page: 'Accounts', label: 'Accounts', icon: 'wallet' },
  { page: 'Transactions', label: 'Activity', icon: 'transactions' },
  { page: 'Forecasting', label: 'Forecast', icon: 'forecast' },
];

export interface ShellNewProps {
  /** `null` on the not-found page and the gallery. */
  page: NewPage | null;
  title?: string;
  navigate: (path: string) => void;
  user: User;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  onLogout: () => void;
  /** Path of the same page in the classic UI. */
  classicPath: string;
  isDemoMode: boolean;
  notificationCount: number;
  /** Changes on navigation: resets the page error boundary. */
  routeKey: string;
  /** Loading placeholder shape while the page chunk loads. */
  skeleton?: SkeletonShape;
  children: React.ReactNode;
}

const Avatar: React.FC<{ user: User; size?: number }> = ({ user, size = 44 }) => {
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  return user.profilePictureUrl
    ? <img src={user.profilePictureUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    : <span className="flex shrink-0 items-center justify-center rounded-full bg-nv-violet-soft text-sm font-semibold text-nv-violet-text" style={{ width: size, height: size }} aria-hidden>{initials}</span>;
};

const onPlainClick = (fn: () => void) => (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  fn();
};

const ThemeChoice: React.FC<{ theme: Theme; setTheme: (t: Theme) => void }> = ({ theme, setTheme }) => (
  <SegmentedTabs
    label="Theme"
    size="sm"
    className="w-full [&>button]:flex-1"
    value={theme}
    onChange={setTheme}
    items={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'Auto' }]}
  />
);

const MenuRow: React.FC<{ icon: NvIconName; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn('flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors hover:bg-nv-inset', danger ? 'text-nv-red-text' : 'text-nv-ink')}
  >
    <NvIcon name={icon} size={19} className={danger ? '' : 'text-nv-muted'} />
    {label}
  </button>
);

/** Account menu (§4.2: Account Menu): the profile in the header. A Base UI popover until the KokonutUI profile-dropdown is ported. */
const AccountMenu: React.FC<Pick<ShellNewProps, 'user' | 'theme' | 'setTheme' | 'isPrivacyMode' | 'togglePrivacyMode' | 'onLogout' | 'classicPath' | 'navigate' | 'isDemoMode' | 'notificationCount'>> = ({
  user, theme, setTheme, isPrivacyMode, togglePrivacyMode, onLogout, classicPath, navigate, isDemoMode, notificationCount,
}) => (
  <Popover.Root>
    <Popover.Trigger aria-label="Account menu" className="flex items-center gap-3 rounded-full text-left transition-colors lg:pr-2">
      <Avatar user={user} />
      <span className="hidden min-w-0 xl:block">
        <span className="block max-w-[180px] truncate text-[15px] font-medium text-nv-ink">{user.firstName} {user.lastName}</span>
        <span className="block max-w-[180px] truncate text-[13px] text-nv-muted">{isDemoMode ? 'Demo mode' : user.role}</span>
      </span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner sideOffset={10} align="end" className="pointer-events-auto z-popover">
        <Popover.Popup className="crystal-new w-72 origin-[var(--transform-origin)] rounded-nv-tile bg-nv-surface p-2 shadow-nv-float transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar user={user} size={40} />
            <div className="min-w-0">
              <p className="truncate font-medium text-nv-ink">{user.firstName} {user.lastName}</p>
              <p className="truncate text-[13px] text-nv-muted">{isDemoMode ? 'Demo mode' : user.email}</p>
            </div>
          </div>
          <div className="px-2 pb-2 pt-1"><ThemeChoice theme={theme} setTheme={setTheme} /></div>
          <div className="my-1 h-px bg-nv-line" />
          {/* Phones have no bell in the header: notifications live here (§14 N4). */}
          <div className="sm:hidden">
            <MenuRow icon="notification" label={notificationCount ? `${notificationCount} bill${notificationCount === 1 ? '' : 's'} due soon` : 'No notifications'} onClick={() => navigate(newPathFor('Schedule & Bills'))} />
          </div>
          <MenuRow icon={isPrivacyMode ? 'viewOff' : 'view'} label={isPrivacyMode ? 'Show amounts' : 'Hide amounts'} onClick={togglePrivacyMode} />
          <MenuRow icon="settings" label="Settings" onClick={() => navigate(newPathFor('Settings'))} />
          <MenuRow icon="external" label="Open in classic UI" onClick={() => navigate(classicPath)} />
          <div className="my-1 h-px bg-nv-line" />
          <MenuRow icon="logout" label={isDemoMode ? 'Leave demo' : 'Sign out'} onClick={onLogout} danger />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);

const Notifications: React.FC<{ count: number; navigate: (p: string) => void }> = ({ count, navigate }) => (
  <Popover.Root>
    <Popover.Trigger
      render={<IconButton icon="notification" label={count ? `Notifications, ${count} new` : 'Notifications'} badge={count > 0} tone="outline" />}
    />
    <Popover.Portal>
      <Popover.Positioner sideOffset={10} align="end" className="pointer-events-auto z-popover">
        <Popover.Popup className="crystal-new w-72 rounded-nv-tile bg-nv-surface p-4 shadow-nv-float">
          <p className="font-medium text-nv-ink">Notifications</p>
          <p className="mt-1 text-sm text-nv-muted">
            {count ? `${count} bill${count === 1 ? ' is' : 's are'} due soon.` : 'You are all caught up.'}
          </p>
          {count > 0 && <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigate(newPathFor('Schedule & Bills'))}>Open schedule</Button>}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);

/** The grouped page links (R4), shared by the permanent sidebar (desktop) and the menu drawer (phone, tablet). */
const NavList: React.FC<{ activeNav: NewPage | null; go: (p: NewPage) => void; onNavigate?: () => void }> = ({ activeNav, go, onNavigate }) => (
  <nav aria-label="Main navigation" className="space-y-5">
    {NAV_GROUPS.map(group => (
      <div key={group.title}>
        <p className="mb-1 px-3 text-xs font-medium text-nv-muted">{group.title}</p>
        {group.items.map(item => {
          const active = activeNav === item.page;
          return (
            <a
              key={item.page}
              href={newPathFor(item.page)}
              onClick={onPlainClick(() => { go(item.page); onNavigate?.(); })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-full px-3 text-[15px] transition-colors',
                active ? 'bg-nv-ink font-medium text-nv-on-ink' : 'text-nv-ink hover:bg-nv-inset',
              )}
            >
              <NvIcon name={item.icon} size={20} className={active ? '' : 'text-nv-muted'} />
              {item.label}
            </a>
          );
        })}
      </div>
    ))}
  </nav>
);

/** The menu on phone and tablet, opened by the menu button and the dock's More. Search lives in the header (§13 N2). */
const NavDrawer: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void; activeNav: NewPage | null; go: (p: NewPage) => void }> = ({
  open, onOpenChange, activeNav, go,
}) => (
  <Drawer open={open} onOpenChange={onOpenChange} title="Menu" side="left" width={340}>
    <NavList activeNav={activeNav} go={go} onNavigate={() => onOpenChange(false)} />
  </Drawer>
);

/** The permanent sidebar on desktop (N12): always open, the same grouped links, its own scroll. */
const Sidebar: React.FC<{ activeNav: NewPage | null; go: (p: NewPage) => void }> = ({ activeNav, go }) => (
  <aside className="fixed bottom-4 left-4 top-4 z-sticky hidden w-64 flex-col overflow-hidden rounded-[32px] bg-nv-tile lg:flex">
    <a href={newPathFor('Dashboard')} onClick={onPlainClick(() => go('Dashboard'))} aria-label="Crystal home" className="flex items-center gap-3 px-6 pb-4 pt-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nv-ink text-nv-on-ink"><NvIcon name="sparkles" size={20} /></span>
      <span className="text-xl font-semibold text-nv-ink">Crystal</span>
    </a>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6"><NavList activeNav={activeNav} go={go} /></div>
  </aside>
);

const PAGE_TARGETS: PageTarget[] = NAV_GROUPS.flatMap(g => g.items.map(i => ({ id: i.page, label: i.label, icon: i.icon, group: g.title })));

export const ShellNew: React.FC<ShellNewProps> = props => {
  const { page, title, navigate, notificationCount, routeKey, skeleton, children } = props;
  const [pageTabs, setPageTabsState] = useState<PageTabsConfig | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [pageSearch, setPageSearchState] = useState<PageSearchConfig | null>(null);
  const [pageAction, setPageActionState] = useState<PageActionConfig | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [toolsSlot, setToolsSlot] = useState<HTMLElement | null>(null);
  const [phoneSearchOpen, setPhoneSearchOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const phoneSearchRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const setPageTabs = useCallback((tabs: PageTabsConfig | null) => setPageTabsState(tabs), []);
  const setPageSearch = useCallback((search: PageSearchConfig | null) => setPageSearchState(search), []);
  const setPageAction = useCallback((action: PageActionConfig | null) => setPageActionState(action), []);
  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const contextValue = useMemo(
    () => ({ setPageTabs, setPageSearch, setPageAction, headerSlot, toolsSlot, isDark: props.theme === 'dark' || (props.theme === 'system' && prefersDark), navigate, openQuickAdd }),
    [setPageTabs, setPageSearch, setPageAction, headerSlot, toolsSlot, props.theme, prefersDark, navigate, openQuickAdd],
  );
  // The header's violet button (§14 N4): the page's own primary action, else quick add.
  const action: PageActionConfig = pageAction ?? { label: 'Add transaction', icon: 'add', onClick: openQuickAdd };
  const activeNav = page ? newNavPageFor(page) : null;
  const heading = title ?? (page ? NEW_PAGE_TITLES[page] : 'Crystal');
  const subtitle = page ? NEW_PAGE_SUBTITLES[page] : undefined;
  const resolvedTheme = props.theme === 'system' ? (prefersDark ? 'dark' : 'light') : props.theme;

  useEffect(() => {
    const previous = document.title;
    document.title = `${heading} · Crystal`;
    return () => { document.title = previous; };
  }, [heading]);

  // ⌘K / Ctrl+K focuses the header search (the page's own search, or pages).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) return;
      e.preventDefault();
      if (isDesktop) desktopSearchRef.current?.focus();
      else { setPhoneSearchOpen(true); setTimeout(() => phoneSearchRef.current?.focus(), 30); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDesktop]);

  // A page with its own search keeps the phone field open while it has a query.
  useEffect(() => { if (pageSearch?.value) setPhoneSearchOpen(true); }, [pageSearch?.value]);
  useEffect(() => { setPhoneSearchOpen(false); }, [routeKey]);
  // The page scrolls with the window, so a new route would otherwise open at the previous page's scroll position.
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [routeKey]);

  const go = (p: NewPage) => navigate(newPathFor(p));

  return (
    <ShellNewContext.Provider value={contextValue}>
      <div className="crystal-new min-h-dvh lg:pl-72">
        <a href="#nv-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-full focus:bg-nv-surface focus:px-4 focus:py-2">Skip to content</a>

        <Sidebar activeNav={activeNav} go={go} />

        {/* Top band (R2, R4): grey, holds the header row and the page tabs. */}
        <header className="rounded-b-[32px] bg-nv-tile px-4 pb-4 pt-[max(env(safe-area-inset-top),16px)] lg:mx-4 lg:mt-4 lg:rounded-[32px] lg:px-8 lg:pb-6 lg:pt-6">
          <div className="flex items-center gap-3">
            <IconButton icon="menu" label="Menu" tone="chip" className="lg:hidden" onClick={() => setNavOpen(true)} />
            <a href={newPathFor('Dashboard')} onClick={onPlainClick(() => go('Dashboard'))} aria-label="Crystal home" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nv-ink text-nv-on-ink sm:flex lg:hidden">
              <NvIcon name="sparkles" size={20} />
            </a>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold leading-tight tracking-tight text-nv-ink lg:text-2xl">{heading}</h1>
              {subtitle && <p className="mt-0.5 hidden truncate text-sm text-nv-muted sm:block">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <HeaderSearch ref={desktopSearchRef} config={pageSearch} pages={PAGE_TARGETS} onPickPage={id => go(id as NewPage)} className="hidden w-64 lg:block xl:w-80" />
              <IconButton
                icon={phoneSearchOpen ? 'close' : 'search'}
                label={phoneSearchOpen ? 'Close search' : (pageSearch?.placeholder ?? 'Search pages')}
                tone="outline"
                className="lg:hidden"
                onClick={() => {
                  if (phoneSearchOpen) { setPhoneSearchOpen(false); pageSearch?.onChange(''); }
                  else { setPhoneSearchOpen(true); setTimeout(() => phoneSearchRef.current?.focus(), 30); }
                }}
              />
              <Button variant="cta" icon={action.icon} className="hidden lg:inline-flex" onClick={action.onClick}>{action.label}</Button>
              <IconButton icon={action.icon} label={action.label} tone="violet" className="lg:hidden" onClick={action.onClick} />
              <div className="hidden sm:block"><Notifications count={notificationCount} navigate={navigate} /></div>
              <AccountMenu {...props} />
            </div>
          </div>
          {phoneSearchOpen && (
            <HeaderSearch ref={phoneSearchRef} config={pageSearch} pages={PAGE_TARGETS} onPickPage={id => { setPhoneSearchOpen(false); go(id as NewPage); }} className="mt-3 lg:hidden" />
          )}
          {/* Tabs on the left, the page's tools (HeaderTools) on the right of the same row (§15 N6). */}
          <div className="mt-4 hidden flex-wrap items-center justify-between gap-3 has-[[role=tablist]]:flex has-[[data-nv-tools]>*]:flex lg:mt-6">
            {pageTabs && <SegmentedTabs label={pageTabs.label} items={pageTabs.items} value={pageTabs.value} onChange={pageTabs.onChange} className="bg-nv-surface" />}
            <div ref={setToolsSlot} data-nv-tools className="ml-auto flex items-center gap-2" />
          </div>
          {/* The page's controls (filters, period, tools) render here through HeaderControls (§14 N5). */}
          <div ref={setHeaderSlot} className="mt-4 empty:hidden" />
        </header>

        <main id="nv-main" tabIndex={-1} className="mx-auto min-w-0 max-w-[1600px] px-4 pb-32 pt-5 focus:outline-none lg:px-8 lg:pb-10 lg:pt-6">
          <ErrorBoundaryNew resetKey={routeKey} onHome={() => go('Dashboard')}>
            {/* On desktop a rail of ticks, one per section title and day, scrolls the page (N13). */}
            <ScrollIndex key={routeKey} scroller="window" selector="h2, [data-nv-index]">
              <Suspense fallback={<PageSkeletonNew shape={skeleton} />}>{children}</Suspense>
            </ScrollIndex>
          </ErrorBoundaryNew>
        </main>

        {/* Phone and tablet dock (Q8, §13 N1, §14 N3): five named links, no +; More opens the menu with every page. */}
        <nav aria-label="Quick navigation" className="nv-safe-bottom fixed inset-x-0 bottom-0 z-sticky px-3 lg:hidden">
          <div className="relative mx-auto flex h-[72px] max-w-lg items-center rounded-[28px] bg-nv-surface px-1 shadow-nv-float">
            {DOCK.slice(0, 2).map(item => <DockLink key={item.page} item={item} active={activeNav === item.page} onClick={() => go(item.page)} />)}
            {DOCK.slice(2).map(item => <DockLink key={item.page} item={item} active={activeNav === item.page} onClick={() => go(item.page)} />)}
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={navOpen}
              className={cn('flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium', activeNav && !DOCK.some(d => d.page === activeNav) ? 'text-nv-ink' : 'text-nv-muted')}
            >
              <NvIcon name="more" size={24} strokeWidth={activeNav && !DOCK.some(d => d.page === activeNav) ? 2 : 1.6} />
              <span>More</span>
            </button>
          </div>
        </nav>

        <NavDrawer open={navOpen} onOpenChange={setNavOpen} activeNav={activeNav} go={go} />

        <QuickAddSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} />
        <ToastHostNew theme={resolvedTheme} />
        <ConfirmHostNew />
      </div>
    </ShellNewContext.Provider>
  );
};

const DockLink: React.FC<{ item: NavItem; active: boolean; onClick: () => void }> = ({ item, active, onClick }) => (
  <a
    href={newPathFor(item.page)}
    onClick={onPlainClick(onClick)}
    aria-current={active ? 'page' : undefined}
    className={cn('flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium', active ? 'text-nv-ink' : 'text-nv-muted')}
  >
    <NvIcon name={item.icon} size={24} strokeWidth={active ? 2 : 1.6} />
    <span className="max-w-full truncate">{item.label}</span>
  </a>
);

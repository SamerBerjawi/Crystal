import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { cn } from '../../lib/utils';
import type { Theme, User } from '../../types';
import { NEW_PAGE_TITLES, newNavPageFor, newPathFor, type NewPage } from '../../utils/newRoutes';
import { NvIcon, type NvIconName } from './NvIcon';
import { Button, IconButton, SegmentedTabs } from './ui';
import { TwoToneTitle } from './tile';
import { Drawer, useMediaQuery } from './Drawer';
import { ToastHostNew } from './toast';
import { ConfirmHostNew } from './ConfirmDialog';
import { ErrorBoundaryNew } from './ErrorPanel';
import { PageSkeletonNew, type SkeletonShape } from './Skeleton';
import { ShellNewContext, type PageTabsConfig } from './shellContext';
import './new.css';

/*
 * App frame for the New pages (UI_UX_DESIGN_REFERENCE.md §2, §11 R4). No sidebar: a grey top band holds the
 * header row (menu button, logo disc, two-tone title, quick add, notifications, profile, search) and the page's
 * tabs (Q7). The menu and search open the grouped navigation in a drawer (left on desktop, bottom sheet on
 * phones). Below 1024px a floating dock adds Home, Accounts | + | Transactions, Forecasting (Q8, D10).
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

/** Quick-add kinds in their accent (D1): spending orange, income green, transfers sky. */
const QUICK_ADD: { icon: NvIconName; label: string; tile: string }[] = [
  { icon: 'money', label: 'Expense', tile: 'bg-nv-orange-soft text-nv-orange-text' },
  { icon: 'wallet', label: 'Income', tile: 'bg-nv-green-soft text-nv-green-text' },
  { icon: 'transactions', label: 'Transfer', tile: 'bg-nv-sky-soft text-nv-sky-text' },
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
const AccountMenu: React.FC<Pick<ShellNewProps, 'user' | 'theme' | 'setTheme' | 'isPrivacyMode' | 'togglePrivacyMode' | 'onLogout' | 'classicPath' | 'navigate' | 'isDemoMode'>> = ({
  user, theme, setTheme, isPrivacyMode, togglePrivacyMode, onLogout, classicPath, navigate, isDemoMode,
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
      <Popover.Positioner sideOffset={10} align="end" className="z-popover">
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
      <Popover.Positioner sideOffset={10} align="end" className="z-popover">
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

/** The grouped navigation (R4), with a search that filters pages. Opened by the menu and search buttons. */
const NavDrawer: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void; focusSearch: boolean; activeNav: NewPage | null; go: (p: NewPage) => void }> = ({
  open, onOpenChange, focusSearch, activeNav, go,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) { setQuery(''); return; }
    if (focusSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open, focusSearch]);
  const q = query.trim().toLowerCase();
  const groups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => !q || i.label.toLowerCase().includes(q)) }))
    .filter(g => g.items.length > 0);
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Menu" side="left" width={340}>
      <label className="relative mb-4 block">
        <span className="sr-only">Search pages</span>
        <NvIcon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-nv-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && groups[0]) { go(groups[0].items[0].page); onOpenChange(false); } }}
          placeholder="Search pages"
          className="h-12 w-full rounded-full bg-nv-inset pl-11 pr-4 text-[15px] text-nv-ink outline-none placeholder:text-nv-muted focus-visible:ring-2 focus-visible:ring-nv-violet"
        />
      </label>
      <nav aria-label="Main navigation" className="space-y-5">
        {groups.map(group => (
          <div key={group.title}>
            <p className="mb-1 px-3 text-xs font-medium text-nv-muted">{group.title}</p>
            {group.items.map(item => {
              const active = activeNav === item.page;
              return (
                <a
                  key={item.page}
                  href={newPathFor(item.page)}
                  onClick={onPlainClick(() => { go(item.page); onOpenChange(false); })}
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
        {groups.length === 0 && <p className="px-3 text-sm text-nv-muted">No page matches “{query}”.</p>}
      </nav>
    </Drawer>
  );
};

export const ShellNew: React.FC<ShellNewProps> = props => {
  const { page, title, navigate, notificationCount, routeKey, skeleton, children } = props;
  const [pageTabs, setPageTabsState] = useState<PageTabsConfig | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [nav, setNav] = useState<{ open: boolean; search: boolean }>({ open: false, search: false });
  const setPageTabs = useCallback((tabs: PageTabsConfig | null) => setPageTabsState(tabs), []);
  const contextValue = useMemo(() => ({ setPageTabs, navigate }), [setPageTabs, navigate]);
  const activeNav = page ? newNavPageFor(page) : null;
  const heading = title ?? (page ? NEW_PAGE_TITLES[page] : 'Crystal');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedTheme = props.theme === 'system' ? (prefersDark ? 'dark' : 'light') : props.theme;

  useEffect(() => {
    const previous = document.title;
    document.title = `${heading} · Crystal`;
    return () => { document.title = previous; };
  }, [heading]);

  // ⌘K / Ctrl+K opens the page search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setNav({ open: true, search: true }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (p: NewPage) => navigate(newPathFor(p));

  return (
    <ShellNewContext.Provider value={contextValue}>
      <div className="crystal-new min-h-dvh">
        <a href="#nv-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-full focus:bg-nv-surface focus:px-4 focus:py-2">Skip to content</a>

        {/* Top band (R2, R4): grey, holds the header row and the page tabs. */}
        <header className="rounded-b-[32px] bg-nv-tile px-4 pb-4 pt-[max(env(safe-area-inset-top),16px)] lg:mx-4 lg:mt-4 lg:rounded-[32px] lg:px-8 lg:pb-6 lg:pt-6">
          <div className="flex items-center gap-3">
            <IconButton icon="menu" label="Menu" tone="chip" onClick={() => setNav({ open: true, search: false })} />
            <a href={newPathFor('Dashboard')} onClick={onPlainClick(() => go('Dashboard'))} aria-label="Crystal home" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nv-ink text-nv-on-ink sm:flex">
              <NvIcon name="sparkles" size={20} />
            </a>
            <TwoToneTitle first="Crystal" second={heading} stacked className="min-w-0 truncate text-lg leading-tight lg:text-xl" />
            <div className="flex-1" />
            <div className="flex items-center gap-2 lg:gap-3">
              <IconButton icon="add" label="Add" tone="outline" className="hidden lg:inline-flex" onClick={() => setQuickAddOpen(true)} />
              <Notifications count={notificationCount} navigate={navigate} />
              <AccountMenu {...props} />
              <button
                type="button"
                onClick={() => setNav({ open: true, search: true })}
                className="hidden h-11 items-center gap-3 rounded-full pr-2 text-[15px] text-nv-muted lg:flex"
                aria-label="Search pages"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-nv-line text-nv-ink"><NvIcon name="search" size={20} /></span>
                <span className="hidden xl:inline">Start searching here…</span>
              </button>
            </div>
          </div>
          {pageTabs && (
            <div className="mt-4 lg:mt-6">
              <SegmentedTabs label={pageTabs.label} items={pageTabs.items} value={pageTabs.value} onChange={pageTabs.onChange} className="bg-nv-surface" />
            </div>
          )}
        </header>

        <main id="nv-main" tabIndex={-1} className="mx-auto min-w-0 max-w-[1600px] px-4 pb-32 pt-5 focus:outline-none lg:px-8 lg:pb-10 lg:pt-6">
          <ErrorBoundaryNew resetKey={routeKey} onHome={() => go('Dashboard')}>
            <Suspense fallback={<PageSkeletonNew shape={skeleton} />}>{children}</Suspense>
          </ErrorBoundaryNew>
        </main>

        {/* Phone and tablet dock (Q8, D10) */}
        <nav aria-label="Quick navigation" className="nv-safe-bottom fixed inset-x-0 bottom-0 z-sticky px-4 lg:hidden">
          <div className="relative mx-auto flex h-[72px] max-w-md items-center rounded-[28px] bg-nv-surface px-2 shadow-nv-float">
            {DOCK.slice(0, 2).map(item => <DockLink key={item.page} item={item} active={activeNav === item.page} onClick={() => go(item.page)} />)}
            <div className="w-[76px] shrink-0" aria-hidden />
            {DOCK.slice(2).map(item => <DockLink key={item.page} item={item} active={activeNav === item.page} onClick={() => go(item.page)} />)}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <IconButton icon="add" label="Add" tone="violet" size={64} className="ring-[6px] ring-nv-canvas" onClick={() => setQuickAddOpen(true)} />
            </div>
          </div>
        </nav>

        <NavDrawer open={nav.open} onOpenChange={open => setNav(n => ({ ...n, open }))} focusSearch={nav.search} activeNav={activeNav} go={go} />

        <Drawer
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          title="Add"
          description="Quick add arrives with the new Transactions page."
          footer={<Button variant="cta" size="lg" className="w-full" onClick={() => { setQuickAddOpen(false); go('Transactions'); }}>Go to Transactions</Button>}
        >
          <div className="grid grid-cols-3 gap-3 pt-2">
            {QUICK_ADD.map(({ icon, label, tile }) => (
              <div key={label} className={cn('flex flex-col items-center gap-2 rounded-nv-tile px-2 py-5 text-sm font-medium', tile)}>
                <NvIcon name={icon} size={24} />
                {label}
              </div>
            ))}
          </div>
        </Drawer>
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
    aria-label={item.label}
    className={cn('flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium', active ? 'text-nv-ink' : 'text-nv-muted')}
  >
    <NvIcon name={item.icon} size={24} strokeWidth={active ? 2 : 1.6} />
    {/* D10: only the active tab shows its name; the others are icon-only with the name as their label. */}
    {active && <span aria-hidden>{item.label}</span>}
  </a>
);

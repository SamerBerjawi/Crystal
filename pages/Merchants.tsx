
import { setFiling, withFiling } from '../utils/rules';
import React, { useEffect, useMemo, useState } from 'react';
import { Page, MerchantRule, Category } from '../types';
import { useAccountsContext, usePreferencesContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey, isBrandfetchLogoRefreshable } from '../utils/brandfetch';
import { fuzzySearch, convertToMain, formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { generateSmartRuleSuggestions, SmartRuleSuggestion, convertSuggestionToTransactionRule } from '../utils/ruleSuggestions';
import MerchantDetailModal from '../components/MerchantDetailModal';
import PlaceMap from '../components/PlaceMap';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { toast } from 'sonner';
import Icon from '../components/ui/Icon';
import PageHeader from '../components/PageHeader';
import { Button, IconButton, TextLink } from '../components/ui/Actions';
import { Badge, Row, Sparkline } from '../components/ui/Display';
import { Switch, controlStyles } from '../components/ui/Fields';
import { Menu } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { Popover } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import { Banner, EmptyState, SyncStatus } from '../components/ui/States';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';
import { branchesOf, branchName, googleMapsUrl, hasCoordinates, keywordOf, keywordRulesFor } from '../utils/merchantModel';
import { computeSpendTrends } from '../utils/merchantTrends';

interface MerchantsProps {
  setCurrentPage: (page: Page) => void;
}

type EntityType = 'Merchant' | 'Institution';

interface EntityItem {
    id: string; // unique key
    logoKey: string; // normalized key for branding overrides
    name: string;
    type: EntityType;
    count: number; // Transactions count or Accounts count
    originalName: string; // Case sensitive
    totalValue: number; // EUR value (Balance for Inst, Sum for Merch)
    lastActivity?: string; // ISO Date
    currency?: string; // Dominant currency (optional/cosmetic)
    rule?: MerchantRule;
}

// --- Custom Guess Helper & Sparkline Mini charts ---
const guessDomainName = (name: string): string | null => {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanName || cleanName.length < 2) return null;
    
    const commonMap: Record<string, string> = {
        netflix: 'netflix.com',
        spotify: 'spotify.com',
        uber: 'uber.com',
        apple: 'apple.com',
        amazon: 'amazon.com',
        google: 'google.com',
        youtube: 'youtube.com',
        microsoft: 'microsoft.com',
        steam: 'steampowered.com',
        github: 'github.com',
        paypal: 'paypal.com',
        stripe: 'stripe.com',
        revolut: 'revolut.com',
        mcdonalds: 'mcdonalds.com',
        starbucks: 'starbucks.com',
        shell: 'shell.com',
        total: 'totalenergies.com',
        bp: 'bp.com',
        airbnb: 'airbnb.com',
        booking: 'booking.com',
        lidl: 'lidl.com',
        aldi: 'aldi.com',
        ikea: 'ikea.com',
        hm: 'hm.com',
        zara: 'zara.com',
        nike: 'nike.com',
        adidas: 'adidas.com',
        patreon: 'patreon.com',
        substack: 'substack.com',
        target: 'target.com',
        walmart: 'walmart.com',
        costco: 'costco.com',
        chevron: 'chevron.com',
        exxon: 'exxon.com',
        starlink: 'starlink.com',
        tesla: 'tesla.com',
        openai: 'openai.com',
        adobe: 'adobe.com',
        figma: 'figma.com',
        slack: 'slack.com',
        zoom: 'zoom.us',
        discord: 'discord.com',
        trello: 'trello.com',
        notion: 'notion.so'
    };
    
    for (const [key, domain] of Object.entries(commonMap)) {
        if (cleanName.includes(key)) return domain;
    }
    return `${cleanName}.com`;
};

const MERCHANT_SORTS = [
  { id: 'recent', label: 'Recently active' },
  { id: 'count', label: 'Most frequent' },
  { id: 'value', label: 'Highest total' },
  { id: 'name', label: 'Name' },
];

const Merchants: React.FC<MerchantsProps> = ({ setCurrentPage }) => {
  const { transactions, saveTransaction } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const showBalanceAdjustments = usePreferencesSelector(p => p.showBalanceAdjustments ?? true);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  
  // Migrate old overrides or rules if needed (simplified: just read both)
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {});
  const legacyOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const hiddenMerchants = usePreferencesSelector(p => p.hiddenMerchants || []);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'value' | 'recent'>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isPhone = useIsMobile();
  const [showHidden, setShowHidden] = useState(false);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});
  const [logoRefreshTimestamps, setLogoRefreshTimestamps] = useState<Record<string, number>>({});
  
  const [editingEntity, setEditingEntity] = useState<EntityItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentName: '' });

  const smartSuggestions = useMemo(() => {
    return generateSmartRuleSuggestions(transactions, preferences.transactionRules || []);
  }, [transactions, preferences.transactionRules]);

  const handleDeploySmartSuggestion = (suggestion: SmartRuleSuggestion) => {
    const newRule = convertSuggestionToTransactionRule(suggestion);

    setPreferences(prev => ({
      ...prev,
      transactionRules: [newRule, ...(prev.transactionRules || [])]
    }));

    const kw = suggestion.keyword.toLowerCase();
    const matching = transactions.filter(t => 
      (t.description && t.description.toLowerCase().includes(kw)) ||
      (t.merchant && t.merchant.toLowerCase().includes(kw))
    );

    if (matching.length > 0) {
      const updated = matching.map(t => ({
        ...t,
        merchant: suggestion.suggestedMerchant || t.merchant,
        category: suggestion.suggestedCategory || t.category,
      }));
      saveTransaction(updated);
      toast.success(`Created rule and updated ${updated.length} past transaction(s) for "${suggestion.suggestedMerchant}"!`);
    } else {
      toast.success(`Created auto-categorization rule for "${suggestion.suggestedMerchant}"!`);
    }
  };

  const effectiveMerchantRules = useMemo(() => {
    const migratedRules = { ...merchantRules };

    hiddenMerchants.forEach(merchantName => {
      const merchantKey = normalizeMerchantKey(merchantName);
      if (!merchantKey) return;

      migratedRules[merchantKey] = {
        ...(migratedRules[merchantKey] || {}),
        isHidden: true,
      };
    });

    return withFiling(migratedRules, preferences.transactionRules);
  }, [merchantRules, hiddenMerchants, preferences.transactionRules]);

  useEffect(() => {
    if (!hiddenMerchants.length) return;

    const needsMigration = hiddenMerchants.some(merchantName => {
      const merchantKey = normalizeMerchantKey(merchantName);
      return merchantKey && !merchantRules[merchantKey]?.isHidden;
    });

    if (!needsMigration) return;

    setPreferences(prev => {
      const nextRules = { ...(prev.merchantRules || {}) };
      hiddenMerchants.forEach(merchantName => {
        const merchantKey = normalizeMerchantKey(merchantName);
        if (!merchantKey) return;
        nextRules[merchantKey] = {
          ...(nextRules[merchantKey] || {}),
          isHidden: true,
        };
      });

      return {
        ...prev,
        merchantRules: nextRules,
      };
    });
  }, [hiddenMerchants, merchantRules, setPreferences]);

  const missingMerchantCount = useMemo(() => 
    transactions.filter(tx => !tx.merchant || !tx.merchant.trim()).length,
  [transactions]);

  const entities = useMemo(() => {
    const map = new Map<string, EntityItem>();

    // 1. Process Merchants from ALL Transactions
    transactions.forEach(tx => {
      if (!showBalanceAdjustments && tx.isBalanceAdjustment) return;
      if (!tx.merchant) return;
      const key = normalizeMerchantKey(tx.merchant);
      if (!key) return;
      const mapKey = `merchant:${key}`;
      
      const val = convertToMain(tx.amount, tx.currency);
      const existing = map.get(mapKey);

      if (existing) {
        existing.count += 1;
        existing.totalValue += val;
        if (tx.date > (existing.lastActivity || '')) {
            existing.lastActivity = tx.date;
        }
      } else {
        // Construct effective rule by merging legacy overrides if rule doesn't exist
        // This ensures backward compatibility
        const effectiveRule = effectiveMerchantRules[key] || (legacyOverrides[key] ? { logo: legacyOverrides[key] } : undefined);

        map.set(mapKey, { 
            id: mapKey, 
            logoKey: key,
            name: tx.merchant.trim(), 
            type: 'Merchant', 
            count: 1, 
            originalName: tx.merchant,
            totalValue: val,
            lastActivity: tx.date,
            currency: tx.currency,
            rule: effectiveRule
        });
      }
    });

    // 2. Process Financial Institutions from ALL Accounts
    accounts.forEach(acc => {
        if (!acc.financialInstitution) return;
        const key = normalizeMerchantKey(acc.financialInstitution);
        if (!key) return;
        const mapKey = `institution:${key}`;

        const val = convertToMain(acc.balance, acc.currency);
        const existing = map.get(mapKey);

        if (existing) {
            existing.count += 1;
            existing.totalValue += val;
        } else {
            const effectiveRule = effectiveMerchantRules[key] || (legacyOverrides[key] ? { logo: legacyOverrides[key] } : undefined);

            map.set(mapKey, { 
                id: mapKey, 
                logoKey: key,
                name: acc.financialInstitution.trim(), 
                type: 'Institution', 
                count: 1, 
                originalName: acc.financialInstitution,
                totalValue: val,
                lastActivity: undefined, 
                currency: acc.currency,
                rule: effectiveRule
            });
        }
    });

    return Array.from(map.values());
  }, [transactions, accounts, effectiveMerchantRules, legacyOverrides]);

  const spendTrendsMap = useMemo(() => {
      const now = new Date();
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          // Local year/month: toISOString() would shift the 1st of the month into the previous month east of UTC.
          months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); // "YYYY-MM"
      }
      return computeSpendTrends(entities, transactions, accounts, months, showBalanceAdjustments);
  }, [entities, transactions, accounts, showBalanceAdjustments]);

  // Filtering & Sorting
  const filteredEntities = useMemo(() => {
      let result = entities;

      if (!showHidden) {
          result = result.filter(e => !e.rule?.isHidden);
      }
      
      if (searchTerm) {
          result = result.filter(e => fuzzySearch(searchTerm, e.name));
      }
      
      return result.sort((a, b) => {
          if (sortBy === 'count') return b.count - a.count;
          if (sortBy === 'value') return Math.abs(b.totalValue) - Math.abs(a.totalValue);
          if (sortBy === 'recent') {
              if (!a.lastActivity) return 1;
              if (!b.lastActivity) return -1;
              return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
          }
          return a.name.localeCompare(b.name);
      });
  }, [entities, searchTerm, sortBy, showHidden]);

  // Category and description are an always file rule. Everything else stays on the merchant (D-105).
  const handleSaveRule = (key: string, { category, defaultDescription, ...rule }: MerchantRule) => {
      const name = entities.find(entity => entity.logoKey === key)?.name ?? key;
      setPreferences(prev => ({
          ...prev,
          merchantRules: { ...prev.merchantRules, [key]: rule },
          transactionRules: setFiling(prev.transactionRules ?? [], key, name, { category, description: defaultDescription }),
      }));
  };

  const handleRefreshLogos = async () => {
      const targetEntities = entities.filter(e => !e.rule?.logo);
      if (targetEntities.length === 0) {
          toast.success("Branding telemetry fully resolved. All merchants have active custom logos or matching domains.");
          return;
      }
      
      setIsRefreshing(true);
      setRefreshProgress({ current: 0, total: targetEntities.length, currentName: targetEntities[0].name });
      
      const updatedRules = { ...preferences.merchantRules };
      
      for (let i = 0; i < targetEntities.length; i++) {
          const entity = targetEntities[i];
          setRefreshProgress({ current: i + 1, total: targetEntities.length, currentName: entity.name });
          
          await new Promise(resolve => setTimeout(resolve, 150));
          
          const guessedDomain = guessDomainName(entity.name);
          if (guessedDomain) {
              const prevRule = updatedRules[entity.logoKey] || {};
              updatedRules[entity.logoKey] = {
                  ...prevRule,
                  logo: guessedDomain,
                  website: `https://${guessedDomain}`
              };
          }
      }
      
      setPreferences(prev => ({
          ...prev,
          merchantRules: updatedRules
      }));
      setIsRefreshing(false);
      toast.success(`Logo auto-enrichment complete! Successfully resolved ${targetEntities.length} missing merchant records.`);
  };

  const handleToggleHidden = (entity: EntityItem, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const newHidden = !entity.rule?.isHidden;
      
      const newRule: MerchantRule = {
          ...(entity.rule || {}),
          isHidden: newHidden
      };
      
      handleSaveRule(entity.logoKey, newRule);
  };

  const getPreviewUrl = (merchantName: string, rule?: MerchantRule) => {
      const key = normalizeMerchantKey(merchantName);
      const overrides = rule?.logo ? { [key!]: rule.logo } : {};
      const refreshTimestamp = key ? logoRefreshTimestamps[key] : undefined;
      return getMerchantLogoUrl(merchantName, brandfetchClientId, overrides, { fallback: 'lettermark', type: 'icon', width: 128, height: 128, refreshTimestamp });
  };

  const handleRefreshSingleLogo = (entityName: string, logoKey: string, logoValue?: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (!isBrandfetchLogoRefreshable(entityName, logoValue)) {
          return;
      }
      const now = Date.now();
      setLogoRefreshTimestamps(prev => ({ ...prev, [logoKey]: now }));
      setLogoLoadErrors(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(url => {
              if (url.includes(encodeURIComponent(entityName)) || url.includes(logoKey)) {
                  delete next[url];
              }
          });
          return next;
      });
      toast.success(`Refreshed latest logo from Brandfetch for "${entityName}"!`);
  };

  const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

  const stats = useMemo(() => {
      const totalVolume = entities.reduce((sum, e) => sum + Math.abs(e.totalValue), 0);
      return {
          totalMerchants: entities.filter(e => e.type === 'Merchant').length,
          totalInstitutions: entities.filter(e => e.type === 'Institution').length,
          totalVolume,
          missingCount: missingMerchantCount
      };
  }, [entities, missingMerchantCount]);

  const selected = filteredEntities.find(entity => entity.id === selectedId) ?? (isPhone ? undefined : filteredEntities[0]);

  const logoFor = (entity: EntityItem) => {
    const url = getPreviewUrl(entity.name, entity.rule);
    return url && !logoLoadErrors[url] ? url : null;
  };

  const entityLogo = (entity: EntityItem, size: number) => {
    const url = logoFor(entity);
    return (
      <span style={{ width: size, height: size }} className="type-label flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-inset text-muted">
        {url ? <img src={url} alt="" onError={() => handleLogoError(url)} className="size-full object-cover" /> : entity.name.charAt(0).toUpperCase()}
      </span>
    );
  };

  const entityTransactions = useMemo(() => {
    if (!selected) return [];
    return transactions
      .filter(tx => normalizeMerchantKey(tx.merchant) === selected.logoKey)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selected, transactions]);

  const branches = useMemo(() => branchesOf(selected?.rule), [selected?.rule]);
  const mapPlaces = useMemo(() => branches.filter(hasCoordinates).map(branch => ({ latitude: branch.latitude!, longitude: branch.longitude! })), [branches]);
  const keywords = selected ? keywordRulesFor(preferences.transactionRules, selected.name).map(keywordOf).filter(Boolean) : [];
  const hasAbout = !!(selected?.rule?.website || selected?.rule?.defaultDescription || selected?.rule?.notes || keywords.length > 0);

  const list = (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" aria-label="Search merchants and institutions" placeholder="Search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={cn(controlStyles, 'h-10 pl-10 pr-3 text-[.9375rem] max-md:h-12 max-md:text-base')} />
        </div>
        <Popover
          title="View options"
          placement="bottom end"
          trigger={<IconButton icon="sliders-horizontal" label="View options" tooltipPlacement="bottom" />}
        >
          <div className="flex w-56 flex-col gap-3 max-md:w-full">
            <Select label="Sort by" options={MERCHANT_SORTS} value={sortBy} onChange={id => setSortBy(id as typeof sortBy)} />
            <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch>
          </div>
        </Popover>
      </div>
      {filteredEntities.length === 0 ? (
        <EmptyState
          icon="search-01"
          title={searchTerm ? 'No matches' : 'No merchants yet'}
          description={searchTerm ? 'Try a different name.' : 'Merchants appear here once you have transactions.'}
          actionLabel={searchTerm ? 'Clear search' : undefined}
          onAction={searchTerm ? () => setSearchTerm('') : undefined}
        />
      ) : (
        <ul className="max-h-[calc(100dvh-280px)] divide-y divide-line overflow-y-auto rounded-[var(--radius-xl)] surface-card max-md:max-h-none">
          {filteredEntities.map(entity => (
            <li key={entity.id}>
              <button
                type="button"
                aria-current={entity.id === selected?.id ? 'true' : undefined}
                onClick={() => setSelectedId(entity.id)}
                className={cn('flex min-h-16 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-inset', entity.id === selected?.id && !isPhone && 'bg-primary-soft hover:bg-primary-soft')}
              >
                {entityLogo(entity, 40)}
                <span className="min-w-0 flex-1">
                  <span className="type-body-strong block truncate text-ink">{entity.name}</span>
                  <span className="type-caption block truncate text-muted">{entity.type === 'Institution' ? 'Institution' : `${entity.count} ${entity.count === 1 ? 'transaction' : 'transactions'}`}{entity.rule?.isHidden ? ', hidden' : ''}</span>
                </span>
                <span className="type-figure-row shrink-0 text-ink"><Amount value={entity.totalValue} currency={getMainCurrency()} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const profile = selected && (
    <section aria-label={selected.name} className="min-w-0 space-y-4">
      <div className="space-y-4 rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5">
        <header className="flex flex-wrap items-center gap-3">
          {isPhone && <IconButton icon="arrow-left-01" label="Back to the list" className="mr-auto" onPress={() => setSelectedId(null)} />}
          <div className="flex min-w-0 flex-1 items-center gap-3 max-md:order-last max-md:basis-full">
            {entityLogo(selected, 48)}
            <div className="min-w-0 flex-1">
              <h2 className="type-section-title truncate text-ink">{selected.name}</h2>
              <p className="type-caption text-muted">{selected.rule?.isOnline ? `Online ${selected.type.toLowerCase()}` : selected.type}{selected.rule?.category ? `, usually ${selected.rule.category}` : ''}</p>
            </div>
          </div>
          <Menu
            title={selected.name}
            trigger={<IconButton icon="more-horizontal" label={`Actions for ${selected.name}`} tooltipPlacement="left" />}
            items={[
              { id: 'logo', label: 'Refresh logo', icon: 'refresh', onAction: () => handleRefreshSingleLogo(selected.name, selected.logoKey, selected.rule?.logo) },
              { id: 'hide', label: selected.rule?.isHidden ? 'Show in lists' : 'Hide from lists', icon: selected.rule?.isHidden ? 'view' : 'view-off', onAction: () => handleToggleHidden(selected) },
            ]}
          />
          <Button variant="secondary" icon="pencil-edit-02" onPress={() => { setEditingEntity(selected); setIsDetailModalOpen(true); }}>Edit</Button>
        </header>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
          <div><dt className="type-caption text-muted">{selected.type === 'Institution' ? 'Balance' : 'Total'}</dt><dd className="type-figure-row text-ink"><Amount value={selected.totalValue} currency={getMainCurrency()} /></dd></div>
          <div><dt className="type-caption text-muted">{selected.type === 'Institution' ? 'Accounts' : 'Transactions'}</dt><dd className="type-figure-row text-ink">{selected.count}</dd></div>
          <div><dt className="type-caption text-muted">Average</dt><dd className="type-figure-row text-ink"><Amount value={selected.totalValue / Math.max(1, selected.count)} currency={getMainCurrency()} /></dd></div>
          <div><dt className="type-caption text-muted">Last activity</dt><dd className="type-figure-row text-ink">{selected.lastActivity ? parseLocalDate(selected.lastActivity).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd></div>
        </dl>
      </div>
      {spendTrendsMap[selected.id]?.some(value => value > 0) && (
        <section className="rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5">
          <h3 className="type-card-title mb-3 text-ink">Last six months</h3>
          <Sparkline data={spendTrendsMap[selected.id].map(value => ({ value }))} isPositive width={520} height={72} className="h-[72px] w-full" preserveAspect={false} />
        </section>
      )}
      {hasAbout && (
        <section className="rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5">
          <h3 className="type-card-title mb-1 text-ink">About</h3>
          <dl className="divide-y divide-line">
            {selected.rule?.website && (
              <div className="py-2">
                <dt className="type-caption text-muted">Website</dt>
                <dd className="type-body min-w-0 truncate text-ink"><TextLink href={selected.rule.website} target="_blank" rel="noreferrer">{selected.rule.website.replace(/^https?:\/\/(www\.)?/, '')}</TextLink></dd>
              </div>
            )}
            {selected.rule?.defaultDescription && <div className="py-2"><dt className="type-caption text-muted">Description</dt><dd className="type-body break-words text-ink">{selected.rule.defaultDescription}</dd></div>}
            {keywords.length > 0 && (
              <div className="py-2">
                <dt className="type-caption text-muted">Matching keywords</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">{keywords.map(keyword => <Badge key={keyword}>{keyword}</Badge>)}</dd>
              </div>
            )}
            {selected.rule?.notes && <div className="py-2"><dt className="type-caption text-muted">Notes</dt><dd className="type-body whitespace-pre-wrap break-words text-ink">{selected.rule.notes}</dd></div>}
          </dl>
        </section>
      )}
      {branches.length > 0 && (
        <section className="space-y-3 rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5">
          <h3 className="type-card-title text-ink">{branches.length === 1 ? 'Branch' : `${branches.length} branches`}</h3>
          {mapPlaces.length > 0 && <PlaceMap places={mapPlaces} label={selected.name} logoUrl={logoFor(selected)} className="h-44 md:h-56" />}
          <ul className="divide-y divide-line">
            {branches.map(branch => (
              <li key={branch.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="type-body-strong truncate text-ink">{branchName(branch)}</span>
                    {branch.isPrimary && branches.length > 1 && <Badge tone="positive">Primary</Badge>}
                  </p>
                  <p className="type-caption truncate text-muted">{branch.address || branch.city}</p>
                </div>
                {hasCoordinates(branch) && <TextLink href={googleMapsUrl(branch.latitude!, branch.longitude!)} target="_blank" rel="noreferrer" aria-label={`Open ${branchName(branch)} in Google Maps`} className="type-caption shrink-0">Google Maps</TextLink>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {entityTransactions.length > 0 && (
        <section className="rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5">
          <h3 className="type-card-title mb-1 text-ink">Latest</h3>
          <ul className="divide-y divide-line">
            {entityTransactions.slice(0, 8).map(tx => (
              <li key={tx.id}><Row title={tx.description || tx.merchant} context={`${tx.category || 'Uncategorised'}, ${parseLocalDate(tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`} trailing={<Amount value={tx.amount} currency={tx.currency} tone="flow" />} /></li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );

  return (
    <div className="space-y-4">
      {isDetailModalOpen && editingEntity && (
        <MerchantDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          merchantName={editingEntity.originalName}
          logoKey={editingEntity.logoKey}
          initialRule={editingEntity.rule}
          onSave={handleSaveRule}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transactions={transactions}
          brandfetchClientId={brandfetchClientId}
        />
      )}
      {!(isPhone && selected) && (
        <PageHeader
          title="Merchants"
          stats={[
            { label: 'Merchants', icon: 'store-01', value: stats.totalMerchants, ...(stats.missingCount ? { badge: `${stats.missingCount} no logo`, badgeTone: 'butter' as const } : {}) },
            { label: 'Institutions', icon: 'bank', value: stats.totalInstitutions },
            { label: 'Total volume', icon: 'coins-01', value: stats.totalVolume, format: 'money' },
          ]}
          actions={
            <>
              <Button variant="secondary" icon="flash" onPress={() => setCurrentPage('Rules')}>Rules</Button>
              <Button variant="secondary" icon="magic-wand-01" isBusy={isRefreshing} onPress={handleRefreshLogos}>Find logos</Button>
            </>
          }
        />
      )}

      {!brandfetchClientId && !(isPhone && selected) && <Banner>Add a free Brandfetch key in Preferences to look up logos automatically.</Banner>}
      {smartSuggestions.length > 0 && !(isPhone && selected) && (
        <Banner actionLabel="Review in Rules" onAction={() => setCurrentPage('Rules')}>
          {smartSuggestions.length} suggested {smartSuggestions.length === 1 ? 'rule' : 'rules'} from repeated descriptions.
        </Banner>
      )}
      {isRefreshing && <SyncStatus state="working">Finding logos, {refreshProgress.current} of {refreshProgress.total}: {refreshProgress.currentName}</SyncStatus>}

      {isPhone
        ? (selected ? profile : list)
        : <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">{list}{profile}</div>}
    </div>
  );
};

export default Merchants;

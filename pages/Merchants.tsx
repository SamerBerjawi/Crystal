
import React, { useEffect, useMemo, useState } from 'react';
import { Page, MerchantRule, Category, RegexCategorizationRule } from '../types';
import { useAccountsContext, usePreferencesContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey, isBrandfetchLogoRefreshable } from '../utils/brandfetch';
import { fuzzySearch, convertToEur, formatCurrency, parseLocalDate } from '../utils';
import { generateSmartRuleSuggestions, SmartRuleSuggestion, convertSuggestionToTransactionRule } from '../utils/ruleSuggestions';
import MerchantDetailModal from '../components/MerchantDetailModal';
import MerchantOverviewModal from '../components/MerchantOverviewModal';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { toast } from 'sonner';
import RegexCategorizationModal from '../components/RegexCategorizationModal';
import Icon from '../components/ui/Icon';
import PageHeader from '../components/PageHeader';
import { Button, IconButton } from '../components/ui/Actions';
import { Row, Sparkline } from '../components/ui/Display';
import { Switch, controlStyles } from '../components/ui/Fields';
import { Menu } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { Popover } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import { Banner, EmptyState, SyncStatus } from '../components/ui/States';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';
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
  const [overviewEntity, setOverviewEntity] = useState<EntityItem | null>(null);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  
  // Advanced regex state & background task progress state
  const [isRegexModalOpen, setIsRegexModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentName: '' });

  const regexRules = useMemo(() => preferences.regexCategorizationRules || [], [preferences.regexCategorizationRules]);

  const handleSaveRegexRules = (updatedRules: RegexCategorizationRule[]) => {
      setPreferences(prev => ({
          ...prev,
          regexCategorizationRules: updatedRules
      }));
  };

  const handleApplyHistoricalRules = () => {
      const activeRules = regexRules.filter(r => r.isActive);
      if (activeRules.length === 0) {
          toast.error("No active regex rules are currently deployed.");
          return;
      }
      
      const updatedTransactions: any[] = [];
      transactions.forEach(tx => {
          const textToMatch = [tx.merchant || '', tx.description || '', tx.notes || ''].join(' ').trim();
          for (const rule of activeRules) {
              try {
                  const regex = new RegExp(rule.pattern, 'i');
                  if (regex.test(textToMatch) && tx.category !== rule.category) {
                      updatedTransactions.push({
                          ...tx,
                          category: rule.category
                      });
                      break; // stop at first matching pattern
                  }
              } catch (e) {
                  // Skip invalid regex
              }
          }
      });
      
      if (updatedTransactions.length === 0) {
          toast.success("No transactions need re-routing; all values conform to active patterns.");
          return;
      }
      
      saveTransaction(updatedTransactions);
      toast.success(`Analysis Complete! Reclassified ${updatedTransactions.length} historical records successfully.`);
  };

  const smartSuggestions = useMemo(() => {
    return generateSmartRuleSuggestions(transactions, preferences.transactionRules || [], preferences.merchantRules || {});
  }, [transactions, preferences.transactionRules, preferences.merchantRules]);

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

    return migratedRules;
  }, [merchantRules, hiddenMerchants]);

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
      
      const val = convertToEur(tx.amount, tx.currency);
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

        const val = convertToEur(acc.balance, acc.currency);
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

  const handleSaveRule = (key: string, rule: MerchantRule) => {
      setPreferences(prev => ({
          ...prev,
          merchantRules: {
              ...prev.merchantRules,
              [key]: rule
          }
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
          trigger={<IconButton icon="tune" label="View options" tooltipPlacement="bottom" />}
        >
          <div className="flex w-56 flex-col gap-3 max-md:w-full">
            <Select label="Sort by" options={MERCHANT_SORTS} value={sortBy} onChange={id => setSortBy(id as typeof sortBy)} />
            <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch>
          </div>
        </Popover>
      </div>
      {filteredEntities.length === 0 ? (
        <EmptyState
          icon="search"
          title={searchTerm ? 'No matches' : 'No merchants yet'}
          description={searchTerm ? 'Try a different name.' : 'Merchants appear here once you have transactions.'}
          actionLabel={searchTerm ? 'Clear search' : undefined}
          onAction={searchTerm ? () => setSearchTerm('') : undefined}
        />
      ) : (
        <ul className="max-h-[calc(100dvh-280px)] divide-y divide-line overflow-y-auto rounded-[var(--radius-xl)] border border-line bg-surface max-md:max-h-none">
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
                <span className="type-figure-row shrink-0 text-ink"><Amount value={entity.totalValue} currency="EUR" /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const profile = selected && (
    <section aria-label={selected.name} className="min-w-0 space-y-4">
      <div className="space-y-4 rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
        <header className="flex items-center gap-3">
          {isPhone && <IconButton icon="ArrowLeft" label="Back to the list" onPress={() => setSelectedId(null)} />}
          {entityLogo(selected, 48)}
          <div className="min-w-0 flex-1">
            <h2 className="type-section-title truncate text-ink">{selected.name}</h2>
            <p className="type-caption text-muted">{selected.type}{selected.rule?.category ? `, usually ${selected.rule.category}` : ''}</p>
          </div>
          <Menu
            title={selected.name}
            trigger={<IconButton icon="more_horiz" label={`Actions for ${selected.name}`} tooltipPlacement="left" />}
            items={[
              { id: 'overview', label: 'Map and details', icon: 'visibility', onAction: () => { setOverviewEntity(selected); setIsOverviewModalOpen(true); } },
              { id: 'logo', label: 'Refresh logo', icon: 'sync', onAction: () => handleRefreshSingleLogo(selected.name, selected.logoKey, selected.rule?.logo) },
              { id: 'hide', label: selected.rule?.isHidden ? 'Show in lists' : 'Hide from lists', icon: selected.rule?.isHidden ? 'visibility' : 'visibility_off', onAction: () => handleToggleHidden(selected) },
            ]}
          />
          <Button variant="secondary" icon="edit" onPress={() => { setEditingEntity(selected); setIsDetailModalOpen(true); }}>Edit</Button>
        </header>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
          <div><dt className="type-caption text-muted">{selected.type === 'Institution' ? 'Balance' : 'Total'}</dt><dd className="type-figure-row text-ink"><Amount value={selected.totalValue} currency="EUR" /></dd></div>
          <div><dt className="type-caption text-muted">{selected.type === 'Institution' ? 'Accounts' : 'Transactions'}</dt><dd className="type-figure-row text-ink">{selected.count}</dd></div>
          <div><dt className="type-caption text-muted">Average</dt><dd className="type-figure-row text-ink"><Amount value={selected.totalValue / Math.max(1, selected.count)} currency="EUR" /></dd></div>
          <div><dt className="type-caption text-muted">Last activity</dt><dd className="type-figure-row text-ink">{selected.lastActivity ? parseLocalDate(selected.lastActivity).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd></div>
        </dl>
      </div>
      {spendTrendsMap[selected.id]?.some(value => value > 0) && (
        <section className="rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
          <h3 className="type-card-title mb-3 text-ink">Last six months</h3>
          <Sparkline data={spendTrendsMap[selected.id].map(value => ({ value }))} isPositive width={520} height={72} className="h-[72px] w-full" preserveAspect={false} />
        </section>
      )}
      {(selected.rule?.locations?.length ?? 0) > 0 && (
        <section className="rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
          <h3 className="type-card-title mb-2 text-ink">Branches</h3>
          <ul className="divide-y divide-line">
            {selected.rule!.locations!.map(location => (
              <li key={location.id} className="py-2">
                <p className="type-body-strong text-ink">{location.label || location.placeName || 'Branch'}{location.isPrimary ? ', primary' : ''}</p>
                <p className="type-caption text-muted">{location.address}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {entityTransactions.length > 0 && (
        <section className="rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
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
      {isOverviewModalOpen && overviewEntity && (
        <MerchantOverviewModal
          isOpen={isOverviewModalOpen}
          onClose={() => setIsOverviewModalOpen(false)}
          merchantName={overviewEntity.originalName}
          logoKey={overviewEntity.logoKey}
          rule={overviewEntity.rule}
          entityType={overviewEntity.type}
          totalValue={overviewEntity.totalValue}
          count={overviewEntity.count}
          lastActivity={overviewEntity.lastActivity}
          transactions={transactions}
          onEdit={() => { setIsOverviewModalOpen(false); setEditingEntity(overviewEntity); setIsDetailModalOpen(true); }}
        />
      )}
      {isRegexModalOpen && (
        <RegexCategorizationModal
          isOpen={isRegexModalOpen}
          onClose={() => setIsRegexModalOpen(false)}
          rules={regexRules}
          onSaveRules={handleSaveRegexRules}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transactions={transactions}
          onApplyHistoricalRules={handleApplyHistoricalRules}
        />
      )}

      {!(isPhone && selected) && (
        <PageHeader
          title="Merchants"
          subtitle={`${stats.totalMerchants} merchants and ${stats.totalInstitutions} institutions${stats.missingCount ? `, ${stats.missingCount} without a logo or rule` : ''}.`}
          actions={
            <>
              <Button variant="secondary" icon="bolt" onPress={() => setIsRegexModalOpen(true)}>Auto-categorise{regexRules.length ? `, ${regexRules.length}` : ''}</Button>
              <Button variant="secondary" icon="magic_wand" isBusy={isRefreshing} onPress={handleRefreshLogos}>Find logos</Button>
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

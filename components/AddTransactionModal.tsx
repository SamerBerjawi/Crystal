import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Account, Category, Transaction, Tag, User, MerchantLocation, AccountType } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE, ALL_ACCOUNT_TYPES, ACCOUNT_TYPE_STYLES, ACCOUNT_TYPE_ACCENT_STYLES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import AddressAutocomplete from './AddressAutocomplete';
import { AddressData } from '../hooks/useAddressSearch';
import { toLocalISOString, formatCurrency, fuzzySearch } from '../utils';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { applyTransactionRulesToFields } from '../utils/rules';
import { parseLocationString } from '../utils/locationDetector';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { toast } from 'sonner';
import Icon from './ui/Icon';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete: string[]) => void;
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  transactions?: Transaction[];
  transactionToEdit?: Transaction | null;
  initialType?: 'expense' | 'income' | 'transfer';
  initialFromAccountId?: string;
  initialToAccountId?: string;
  initialCategory?: string;
  tags: Tag[];
  userProfile?: User;
  initialDetails?: {
    date?: string;
    amount?: string;
    principal?: string;
    interest?: string;
    description?: string;
    merchant?: string;
    tagIds?: string[];
    locationString?: string;
    locationData?: { city?: string; country?: string; lat?: number; lon?: number; address?: string; placeName?: string; street?: string; postalCode?: string; state?: string; locationLabel?: string };
    notes?: string;
  };
}

type ActiveTabType = 'details' | 'location' | 'extras';

const CategoryOptions: React.FC<{ categories: Category[], showTransferOption?: boolean }> = ({ categories, showTransferOption }) => (
  <>
    <option className="bg-white dark:bg-gray-900 text-black dark:text-white" value="">Select Category</option>
    {showTransferOption && (
      <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-semibold" value="Transfer">
        Transfer (Internal)
      </option>
    )}
    {categories.map(parentCat => (
      <optgroup className="bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-semibold" key={parentCat.id} label={parentCat.name}>
        <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-normal" value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
          <option className="bg-white dark:bg-gray-900 text-black dark:text-white font-normal" key={subCat.id} value={subCat.name}>
            &nbsp;&nbsp;{subCat.name}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

// Helper component to render Institution Logo or fallback Account Type Icon
const AccountLogoOrIcon: React.FC<{
  account: Account;
  brandfetchClientId: string;
  merchantLogoOverrides?: Record<string, string>;
  size?: 'sm' | 'md' | 'lg';
}> = ({ account, brandfetchClientId, merchantLogoOverrides, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  const institutionQuery = account.financialInstitution || account.name;
  const logoUrl = useMemo(() => {
    if (!institutionQuery) return null;
    return getMerchantLogoUrl(institutionQuery, brandfetchClientId, merchantLogoOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: 64,
      height: 64,
    });
  }, [institutionQuery, brandfetchClientId, merchantLogoOverrides]);

  const typeConfig = ACCOUNT_TYPE_STYLES[account.type] || { icon: 'wallet', color: 'text-primary-500' };
  const accentConfig = ACCOUNT_TYPE_ACCENT_STYLES[account.type] || { bar: 'bg-primary-500', pill: 'bg-primary-500/10 text-primary-500' };

  const dimensions = size === 'sm' ? 'w-8 h-8 rounded-xl' : size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-xl';
  const iconSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

  if (logoUrl && !imgError) {
    return (
      <div className={`${dimensions} overflow-hidden bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0 shadow-2xs`}>
        <img
          src={logoUrl}
          alt={account.financialInstitution || account.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${dimensions} flex items-center justify-center shrink-0 shadow-2xs ${accentConfig.pill}`}>
      <Icon name={typeConfig.icon} className={iconSize} />
    </div>
  );
};

// Rich interactive Account Card Component with Popover Picker
interface AccountPickerProps {
  label: string;
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
  accounts: Account[];
  excludeAccountId?: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  brandfetchClientId: string;
  merchantLogoOverrides?: Record<string, string>;
}

const AccountPicker: React.FC<AccountPickerProps> = ({
  label,
  selectedAccountId,
  onSelect,
  accounts,
  excludeAccountId,
  isOpen,
  onToggle,
  onClose,
  brandfetchClientId,
  merchantLogoOverrides,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const availableAccounts = useMemo(() => {
    return accounts.filter(a => a.id !== excludeAccountId && (a.status !== 'closed' || a.id === selectedAccountId));
  }, [accounts, excludeAccountId, selectedAccountId]);

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return availableAccounts;
    const q = searchQuery.toLowerCase().trim();
    return availableAccounts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      (a.financialInstitution && a.financialInstitution.toLowerCase().includes(q))
    );
  }, [availableAccounts, searchQuery]);

  const groupedAccounts = useMemo(() => {
    const groups: Partial<Record<AccountType, Account[]>> = {};
    filteredAccounts.forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type]!.push(acc);
    });
    return groups;
  }, [filteredAccounts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative w-full" ref={popoverRef}>
      <span className="block text-2xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
      </span>

      {/* Selected Account Trigger Card */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer group ${
          isOpen
            ? 'bg-primary-500/10 border-primary-500 ring-2 ring-primary-500/30'
            : 'bg-white dark:bg-[#181a20] border-gray-200 dark:border-white/10 hover:border-primary-500/40 hover:bg-gray-50 dark:hover:bg-[#1f222a] shadow-2xs'
        }`}
      >
        {selectedAccount ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <AccountLogoOrIcon
              account={selectedAccount}
              brandfetchClientId={brandfetchClientId}
              merchantLogoOverrides={merchantLogoOverrides}
              size="md"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {selectedAccount.name}
                </span>
                {selectedAccount.isPrimary && (
                  <span className="text-2xs font-semibold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    ★ Primary
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="truncate">{selectedAccount.financialInstitution || selectedAccount.type}</span>
                <span>•</span>
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 py-1">
            <Icon name="wallet" className="text-base text-gray-400" />
            <span>Select an Account...</span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 text-gray-400 group-hover:text-primary-500 transition-colors">
          <Icon name={isOpen ? 'expand_less' : 'expand_more'} className="text-base" />
        </div>
      </button>

      {/* Account Picker Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#181a20] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-[70] p-3 space-y-2.5 max-h-72 flex flex-col animate-fade-in-up">
          {/* Search Input */}
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search accounts by name or type..."
              className="w-full h-10 pl-9 pr-3 text-xs font-semibold bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl border border-black/5 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {/* Grouped Account List */}
          <div className="overflow-y-auto space-y-3 custom-scrollbar flex-1 pr-1">
            {Object.keys(groupedAccounts).length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                No accounts match &quot;{searchQuery}&quot;
              </div>
            ) : (
              ALL_ACCOUNT_TYPES.map(type => {
                const list = groupedAccounts[type];
                if (!list || list.length === 0) return null;
                const icon = ACCOUNT_TYPE_STYLES[type]?.icon || 'wallet';

                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <Icon name={icon} className="text-xs text-primary-500" />
                      <span>{type}</span>
                    </div>

                    <div className="space-y-1">
                      {list.map(acc => {
                        const isSelected = acc.id === selectedAccountId;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              onSelect(acc.id);
                              onClose();
                            }}
                            className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold border border-primary-500/30'
                                : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AccountLogoOrIcon
                                account={acc}
                                brandfetchClientId={brandfetchClientId}
                                merchantLogoOverrides={merchantLogoOverrides}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                                  {acc.name}
                                </p>
                                <p className="text-2xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                  {acc.financialInstitution || acc.type}
                                  {acc.last4 ? ` •••• ${acc.last4}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className={`text-xs font-mono font-bold leading-tight ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                                {formatCurrency(acc.balance, acc.currency)}
                              </p>
                              {isSelected ? (
                                <span className="text-2xs text-primary-500 font-bold">Selected</span>
                              ) : (
                                <span className="text-2xs text-gray-400 dark:text-gray-500">{acc.type}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  onClose,
  onSave,
  accounts,
  incomeCategories,
  expenseCategories,
  transactions,
  transactionToEdit,
  initialType,
  initialFromAccountId,
  initialToAccountId,
  initialCategory,
  tags = [],
  userProfile,
  initialDetails,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('details');

  // Account Popover Open States
  const [isFromAccountPickerOpen, setIsFromAccountPickerOpen] = useState(false);
  const [isToAccountPickerOpen, setIsToAccountPickerOpen] = useState(false);

  const isEditing = !!transactionToEdit;
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {});
  const transactionRules = usePreferencesSelector(p => p.transactionRules || []);
  const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId || '');
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

  const userDefaultCity = userProfile?.defaultCity?.trim() || '';

  const defaultAccountId = useMemo(() => {
    const primary = accounts.find(a => a.isPrimary);
    return primary ? primary.id : (accounts.length > 0 ? accounts[0].id : '');
  }, [accounts]);

  // Drawer entrance animation & Escape listener
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const animationFrame = requestAnimationFrame(() => setIsVisible(true));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationFrame);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCloseDrawer = () => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  };
  
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    isEditing ? (transactionToEdit.transferId ? 'transfer' : transactionToEdit.type) : (initialType || 'expense')
  );
  const [date, setDate] = useState(initialDetails?.date || toLocalISOString(new Date()));
  const [fromAccountId, setFromAccountId] = useState(initialFromAccountId || defaultAccountId);
  const [toAccountId, setToAccountId] = useState(initialToAccountId || defaultAccountId);
  const [description, setDescription] = useState(initialDetails?.description || '');
  const [isDescriptionUserModified, setIsDescriptionUserModified] = useState(Boolean(initialDetails?.description));
  const [merchant, setMerchant] = useState(initialDetails?.merchant || '');
  const [amount, setAmount] = useState(initialDetails?.amount || '');
  const [category, setCategory] = useState(initialCategory || '');
  const [isCategoryUserModified, setIsCategoryUserModified] = useState(Boolean(transactionToEdit?.category || initialCategory));
  const [notes, setNotes] = useState(initialDetails?.notes || '');
  const [tagIds, setTagIds] = useState<string[]>(initialDetails?.tagIds || []);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);
  
  // Exact Location State
  const [isLocationUserModified, setIsLocationUserModified] = useState(
    Boolean(transactionToEdit?.address || initialDetails?.locationData?.address || initialDetails?.locationString)
  );
  const [address, setAddress] = useState<string>(() => {
    if (transactionToEdit?.address) return transactionToEdit.address;
    if (initialDetails?.locationData?.address) return initialDetails.locationData.address;
    if (initialDetails?.locationString) return initialDetails.locationString;
    if (!isEditing && userDefaultCity) return userDefaultCity;
    return '';
  });
  const [placeName, setPlaceName] = useState<string>(() => transactionToEdit?.placeName || initialDetails?.locationData?.placeName || '');
  const [street, setStreet] = useState<string>(() => transactionToEdit?.street || initialDetails?.locationData?.street || '');
  const [city, setCity] = useState<string>(() => {
    if (transactionToEdit?.city) return transactionToEdit.city;
    if (initialDetails?.locationData?.city) return initialDetails.locationData.city;
    if (!isEditing && userDefaultCity) {
      const parsed = parseLocationString(userDefaultCity);
      return parsed.city;
    }
    return '';
  });
  const [postalCode, setPostalCode] = useState<string>(() => transactionToEdit?.postalCode || initialDetails?.locationData?.postalCode || '');
  const [stateRegion, setStateRegion] = useState<string>(() => transactionToEdit?.state || initialDetails?.locationData?.state || '');
  const [country, setCountry] = useState<string>(() => {
    if (transactionToEdit?.country) return transactionToEdit.country;
    if (initialDetails?.locationData?.country) return initialDetails.locationData.country;
    if (!isEditing && userDefaultCity) {
      const parsed = parseLocationString(userDefaultCity);
      return parsed.country || '';
    }
    return '';
  });
  const [latitude, setLatitude] = useState<number | undefined>(() => {
    if (transactionToEdit?.latitude !== undefined) return transactionToEdit.latitude;
    if (initialDetails?.locationData?.lat !== undefined) return initialDetails.locationData.lat;
    return undefined;
  });
  const [longitude, setLongitude] = useState<number | undefined>(() => {
    if (transactionToEdit?.longitude !== undefined) return transactionToEdit.longitude;
    if (initialDetails?.locationData?.lon !== undefined) return initialDetails.locationData.lon;
    return undefined;
  });
  const [locationLabel, setLocationLabel] = useState<string>(() => transactionToEdit?.locationLabel || initialDetails?.locationData?.locationLabel || '');
  const [showManualLocation, setShowManualLocation] = useState(false);

  // Active Merchant Rule & Branches
  const activeMerchantRule = useMemo(() => {
    if (!merchant || !merchantRules) return null;
    const normalizedKey = normalizeMerchantKey(merchant);
    return merchantRules[normalizedKey] || merchantRules[merchant.trim().toLowerCase()] || null;
  }, [merchant, merchantRules]);

  const merchantBranches = useMemo(() => {
    if (!activeMerchantRule) return [] as MerchantLocation[];
    if (activeMerchantRule.locations && activeMerchantRule.locations.length > 0) {
      return activeMerchantRule.locations;
    }
    if (activeMerchantRule.address) {
      return [{
        id: 'loc-primary',
        label: activeMerchantRule.placeName || 'Main Branch',
        address: activeMerchantRule.address,
        placeName: activeMerchantRule.placeName,
        street: activeMerchantRule.street,
        city: activeMerchantRule.city,
        postalCode: activeMerchantRule.postalCode,
        state: activeMerchantRule.state,
        country: activeMerchantRule.country,
        latitude: activeMerchantRule.latitude,
        longitude: activeMerchantRule.longitude,
        isPrimary: true
      }] as MerchantLocation[];
    }
    return [] as MerchantLocation[];
  }, [activeMerchantRule]);

  const handleSelectMerchantBranch = (branch: MerchantLocation) => {
    setAddress(branch.address);
    setPlaceName(branch.placeName || '');
    setStreet(branch.street || '');
    setCity(branch.city || '');
    setPostalCode(branch.postalCode || '');
    setStateRegion(branch.state || '');
    setCountry(branch.country || '');
    setLatitude(branch.latitude);
    setLongitude(branch.longitude);
    setLocationLabel(branch.label || '');
    setIsLocationUserModified(true);
    toast.success(`Location assigned: ${branch.label || branch.address}`);
  };

  const handleAddressChange = (newVal: string, addressData?: AddressData) => {
    setAddress(newVal);
    setIsLocationUserModified(true);
    if (addressData) {
      setPlaceName(addressData.placeName || '');
      setStreet(addressData.street || '');
      setCity(addressData.city || '');
      setPostalCode(addressData.postalCode || '');
      setStateRegion(addressData.state || '');
      setCountry(addressData.country || '');
      setLatitude(addressData.lat);
      setLongitude(addressData.lon);
      setLocationLabel(addressData.placeName || '');
      toast.success(`Location resolved: ${addressData.title}`);
    } else if (!newVal) {
      setPlaceName('');
      setStreet('');
      setCity('');
      setPostalCode('');
      setStateRegion('');
      setCountry('');
      setLatitude(undefined);
      setLongitude(undefined);
      setLocationLabel('');
    } else {
      const parsed = parseLocationString(newVal);
      setCity(parsed.city);
      setCountry(parsed.country || '');
    }
  };

  const handleClearLocation = () => {
    setAddress('');
    setPlaceName('');
    setStreet('');
    setCity('');
    setPostalCode('');
    setStateRegion('');
    setCountry('');
    setLatitude(undefined);
    setLongitude(undefined);
    setLocationLabel('');
    setIsLocationUserModified(true);
    toast.info('Location removed.');
  };

  // Loan payment split state
  const [principalPayment, setPrincipalPayment] = useState(initialDetails?.principal || '');
  const [interestPayment, setInterestPayment] = useState(initialDetails?.interest || '');
  const [useAutoLoanSplit, setUseAutoLoanSplit] = useState(!(initialDetails?.principal || initialDetails?.interest));
  
  // Spare Change State
  const [enableRoundUp, setEnableRoundUp] = useState(false);
  const [existingRoundUpTransaction, setExistingRoundUpTransaction] = useState<Transaction | null>(null);
  const [roundUpBehavior, setRoundUpBehavior] = useState<'skip' | 'unit'>('skip');
  const [roundUpMultiplier, setRoundUpMultiplier] = useState('1');
  const [showSpareChangeSettings, setShowSpareChangeSettings] = useState(false);
  
  // Custom Merchant Autocomplete State
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const merchantContainerRef = useRef<HTMLDivElement>(null);
  
  const merchantSuggestions = useMemo(() => {
    if (!transactions) return [] as { name: string; count: number; category?: string }[];

    const counts = new Map<string, { count: number; category?: string }>();
    transactions.forEach(tx => {
      if (!tx.merchant) return;
      const name = tx.merchant.trim();
      if (!name) return;
      const existing = counts.get(name);
      if (existing) {
        existing.count += 1;
        if (!existing.category && tx.category) existing.category = tx.category;
      } else {
        counts.set(name, { count: 1, category: tx.category || undefined });
      }
    });

    return Array.from(counts.entries())
      .map(([name, data]) => {
        const rule = merchantRules[normalizeMerchantKey(name)];
        return {
          name,
          count: data.count,
          category: rule?.category || data.category,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [transactions, merchantRules]);

  const filteredSuggestions = useMemo(() => {
    if (!showMerchantSuggestions) return [];
    const normalized = merchant.toLowerCase().trim();
    
    if (!normalized) {
      return merchantSuggestions.slice(0, 6);
    }
    
    const exactMatches = merchantSuggestions.filter(item => item.name.toLowerCase() === normalized);
    const prefixMatches = merchantSuggestions.filter(item => 
        item.name.toLowerCase().startsWith(normalized) && 
        !exactMatches.some(e => e.name === item.name)
    );
    const otherMatches = merchantSuggestions.filter(item => 
        (item.name.toLowerCase().includes(normalized) || fuzzySearch(normalized, item.name)) &&
        !exactMatches.some(e => e.name === item.name) &&
        !prefixMatches.some(p => p.name === item.name)
    );
    
    return [...exactMatches, ...prefixMatches, ...otherMatches].slice(0, 8);
  }, [merchant, merchantSuggestions, showMerchantSuggestions]);

  const handleMerchantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMerchantSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      const selected = filteredSuggestions[activeSuggestionIndex];
      if (selected) {
        setMerchant(selected.name);
        setIsDescriptionUserModified(false);
        setIsCategoryUserModified(false);
        setIsLocationUserModified(false);
        applyRules(selected.name, description, amount, { 
            forceAutofillDesc: true, 
            forceAutofillCategory: true, 
            forceAutofillLocation: true 
        });
        setShowMerchantSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowMerchantSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const activeAccount = useMemo(() => {
    const accId = type === 'income' ? toAccountId : fromAccountId;
    return accounts.find(a => a.id === accId);
  }, [accounts, type, fromAccountId, toAccountId]);

  const currencySymbol = activeAccount ? (activeAccount.currency === 'USD' ? '$' : activeAccount.currency === 'EUR' ? '€' : activeAccount.currency === 'GBP' ? '£' : '') : '€';

  const currentMerchantLogoUrl = useMemo(() => {
    if (!merchant.trim()) return '';
    return getMerchantLogoUrl(merchant, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
  }, [merchant, brandfetchClientId, merchantLogoOverrides]);

  const loanAccount = useMemo(() => {
    if (type === 'transfer') {
      return accounts.find(a => a.id === fromAccountId && (a.type === 'Loan' || a.type === 'Lending'))
        || accounts.find(a => a.id === toAccountId && (a.type === 'Loan' || a.type === 'Lending'));
    }
    const targetAccountId = type === 'income' ? toAccountId : fromAccountId;
    if (!targetAccountId) return undefined;
    const targetAccount = accounts.find(a => a.id === targetAccountId);
    if (!targetAccount || (targetAccount.type !== 'Loan' && targetAccount.type !== 'Lending')) {
      return undefined;
    }
    return targetAccount;
  }, [type, fromAccountId, toAccountId, accounts]);

  const isLoanPayment = Boolean(loanAccount);

  const linkedSpareChangeAccount = useMemo(() => {
    if ((type !== 'expense' && type !== 'transfer') || !fromAccountId) return null;
    return accounts.find(a =>
        a.type === 'Investment' &&
        a.subType === 'Spare Change' &&
        a.linkedAccountId === fromAccountId
    );
  }, [accounts, fromAccountId, type]);

  const roundUpAmount = useMemo(() => {
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) return 0;
      
      const remainder = val % 1;
      const cleanRemainder = parseFloat(remainder.toFixed(2));
      
      if (cleanRemainder === 0) {
          return roundUpBehavior === 'unit' ? 1.00 : 0;
      }

      return 1.00 - cleanRemainder;
  }, [amount, roundUpBehavior]);

  const roundUpMultiplierValue = useMemo(() => {
      const multiplier = parseFloat(roundUpMultiplier);
      if (isNaN(multiplier)) return 1;
      return Math.max(0, multiplier);
  }, [roundUpMultiplier]);

  const adjustedRoundUpAmount = useMemo(() => {
      return parseFloat((roundUpAmount * roundUpMultiplierValue).toFixed(2));
  }, [roundUpAmount, roundUpMultiplierValue]);

  useEffect(() => {
    const isPaymentToLoan = (type === 'income' || type === 'transfer') && loanAccount;

    if (isPaymentToLoan && useAutoLoanSplit && loanAccount?.interestRate && parseFloat(amount) > 0) {
        const totalPayment = parseFloat(amount);
        const outstandingPrincipal = Math.abs(loanAccount.balance); 
        const monthlyInterestRate = (loanAccount.interestRate / 100) / 12;
        
        const calculatedInterest = parseFloat((outstandingPrincipal * monthlyInterestRate).toFixed(2));
        const interest = Math.min(totalPayment, calculatedInterest);
        const principal = totalPayment - interest;

        setPrincipalPayment(principal.toFixed(2));
        setInterestPayment(interest.toFixed(2));
    } else if (!isPaymentToLoan) {
        setPrincipalPayment('');
        setInterestPayment('');
    }
  }, [amount, type, loanAccount, useAutoLoanSplit]);
  
  const handlePrincipalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseAutoLoanSplit(false);
    const newPrincipalValue = e.target.value;
    const totalPayment = parseFloat(amount) || 0;
    let newPrincipal = parseFloat(newPrincipalValue) || 0;

    if (newPrincipal > totalPayment) newPrincipal = totalPayment;
    if (newPrincipal < 0) newPrincipal = 0;

    setPrincipalPayment(String(newPrincipal));
    
    const newInterest = totalPayment - newPrincipal;
    setInterestPayment(newInterest.toFixed(2));
  };

  const handleInterestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseAutoLoanSplit(false);
    const newInterestValue = e.target.value;
    const totalPayment = parseFloat(amount) || 0;
    let newInterest = parseFloat(newInterestValue) || 0;

    if (newInterest > totalPayment) newInterest = totalPayment;
    if (newInterest < 0) newInterest = 0;

    setInterestPayment(String(newInterest));

    const newPrincipal = totalPayment - newInterest;
    setPrincipalPayment(newPrincipal.toFixed(2));
  };

  const applyRules = (
      merchantName: string, 
      descText: string, 
      amountText: string, 
      options?: { forceAutofillDesc?: boolean; forceAutofillCategory?: boolean; forceAutofillLocation?: boolean }
  ) => {
      const key = normalizeMerchantKey(merchantName || descText);
      if (key) {
          const mRule = merchantRules[key];
          if (mRule) {
              const shouldAutofillCategory = options?.forceAutofillCategory || !isCategoryUserModified || !category;
              if (mRule.category && shouldAutofillCategory) {
                  setCategory(mRule.category);
              }
              const shouldAutofillDesc = options?.forceAutofillDesc || !isDescriptionUserModified || !descText || !descText.trim() || descText.toLowerCase() === merchantName.toLowerCase();
              if (mRule.defaultDescription && shouldAutofillDesc) {
                  setDescription(mRule.defaultDescription);
                  setIsDescriptionUserModified(false);
              }
              const shouldAutofillLocation = options?.forceAutofillLocation || !isLocationUserModified || !address || !address.trim();
              if (shouldAutofillLocation) {
                  if (mRule.locations && mRule.locations.length > 0) {
                      const primaryBranch = mRule.locations.find(l => l.isPrimary) || mRule.locations[0];
                      if (primaryBranch) {
                          setAddress(primaryBranch.address);
                          setPlaceName(primaryBranch.placeName || '');
                          setStreet(primaryBranch.street || '');
                          setCity(primaryBranch.city || '');
                          setPostalCode(primaryBranch.postalCode || '');
                          setStateRegion(primaryBranch.state || '');
                          setCountry(primaryBranch.country || '');
                          setLatitude(primaryBranch.latitude);
                          setLongitude(primaryBranch.longitude);
                          setLocationLabel(primaryBranch.label || '');
                      }
                  } else if (mRule.address) {
                      setAddress(mRule.address);
                      setPlaceName(mRule.placeName || '');
                      setStreet(mRule.street || '');
                      setCity(mRule.city || '');
                      setPostalCode(mRule.postalCode || '');
                      setStateRegion(mRule.state || '');
                      setCountry(mRule.country || '');
                      setLatitude(mRule.latitude);
                      setLongitude(mRule.longitude);
                      setLocationLabel(mRule.placeName || '');
                  }
              }
              if (merchantName && merchantName !== merchant) {
                  setMerchant(merchantName);
              }
              if (mRule.category || mRule.defaultDescription || mRule.address || mRule.locations?.length) return;
          }
      }

      const rawTx = {
          description: descText || '',
          merchant: merchantName || '',
          category: category || '',
          amount: parseFloat(amountText) || 0,
          type: type || 'expense'
      };

      const result = applyTransactionRulesToFields(rawTx, merchantRules, transactionRules);

      if (result.category && (options?.forceAutofillCategory || !isCategoryUserModified || !category)) {
          setCategory(result.category);
      }
      if (result.merchant && result.merchant !== merchantName) {
          setMerchant(result.merchant);
      }
      if (result.description && (options?.forceAutofillDesc || !isDescriptionUserModified || !descText || !descText.trim())) {
          setDescription(result.description);
          setIsDescriptionUserModified(false);
      }
  };

  const handleDescriptionBlur = () => {
    let currentMerchant = merchant;
    if (!merchant && description) {
        currentMerchant = description;
        setMerchant(currentMerchant);
    }
    applyRules(currentMerchant, description, amount, {
        forceAutofillCategory: !isCategoryUserModified,
        forceAutofillLocation: !isLocationUserModified
    });
  };

  const handleMerchantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setMerchant(val);
      if (val.length >= 2) {
          applyRules(val, description, amount, { 
              forceAutofillDesc: !isDescriptionUserModified,
              forceAutofillCategory: !isCategoryUserModified,
              forceAutofillLocation: !isLocationUserModified
          });
      }
  };

  // Swap Accounts in Transfer mode
  const handleSwapAccounts = () => {
    const temp = fromAccountId;
    setFromAccountId(toAccountId);
    setToAccountId(temp);
    toast.success('Accounts swapped');
  };

  useEffect(() => {
    if (isEditing && transactionToEdit) {
        let principal = '';
        let interest = '';
        let amountToSet = String(Math.abs(transactionToEdit.amount));
        setTagIds(transactionToEdit.tagIds || []);
        
        if (transactionToEdit.address || transactionToEdit.city || transactionToEdit.country) {
            setAddress(transactionToEdit.address || [transactionToEdit.city, transactionToEdit.country].filter(Boolean).join(', '));
            setPlaceName(transactionToEdit.placeName || '');
            setStreet(transactionToEdit.street || '');
            setCity(transactionToEdit.city || '');
            setPostalCode(transactionToEdit.postalCode || '');
            setStateRegion(transactionToEdit.state || '');
            setCountry(transactionToEdit.country || '');
            setLatitude(transactionToEdit.latitude);
            setLongitude(transactionToEdit.longitude);
            setLocationLabel(transactionToEdit.locationLabel || '');
        }

        if (transactionToEdit.transferId && transactions) {
            setType('transfer');
            const counterpart = transactions.find(t => t.transferId === transactionToEdit.transferId && t.id !== transactionToEdit.id);
            if (counterpart) {
                const expensePart = transactionToEdit.type === 'expense' ? transactionToEdit : counterpart;
                const incomePart = transactionToEdit.type === 'income' ? transactionToEdit : counterpart;
                setFromAccountId(expensePart.accountId);
                setToAccountId(incomePart.accountId);
                principal = String(incomePart.principalAmount || '');
                interest = String(incomePart.interestAmount || '');
                amountToSet = String(Math.abs(incomePart.amount));
            }
            const baseDescription = transactionToEdit.description.replace(/Transfer to .*|Transfer from .*/, 'Account Transfer');
            setDescription(baseDescription);
            setMerchant(transactionToEdit.merchant || 'Internal Transfer');
            setCategory(transactionToEdit.category || 'Transfer');
        } else {
            setType(transactionToEdit.type);
            if (transactionToEdit.type === 'income') {
                setToAccountId(transactionToEdit.accountId);
                setFromAccountId(defaultAccountId);
            } else {
                setFromAccountId(transactionToEdit.accountId);
                setToAccountId(defaultAccountId);
            }
            setDescription(transactionToEdit.description);
            setCategory(transactionToEdit.category);
            setMerchant(transactionToEdit.merchant || '');
            setNotes(transactionToEdit.notes || '');
            principal = String(transactionToEdit.principalAmount || '');
            interest = String(transactionToEdit.interestAmount || '');
        }
        
        setDate(transactionToEdit.date);
        setAmount(amountToSet);
        setPrincipalPayment(principal);
        setInterestPayment(interest);
        setUseAutoLoanSplit(!(principal || interest));

        // Detect Round Up
        if (transactions) {
            const targetId = (transactionToEdit as any).originalId || transactionToEdit.id;

            let roundUpTx: Transaction | undefined = undefined;

            if (targetId) {
                roundUpTx = transactions.find(t => 
                    t.transferId === `spare-${targetId}` ||
                    (t.transferId?.startsWith('spare-') && t.transferId.includes(targetId))
                );
            }

            if (!roundUpTx) {
                const boundSpareTransferIds = new Set(
                    transactions
                        .filter(t => t.transferId?.startsWith('spare-'))
                        .map(t => t.transferId!)
                        .filter(tId => transactions.some(other => (other.id || other.transferId) && tId.includes(other.id || other.transferId!)))
                );

                const currentAccountId = transactionToEdit.type === 'income' ? transactionToEdit.accountId : (transactionToEdit.transferId ? (transactionToEdit.type === 'expense' ? transactionToEdit.accountId : (transactions.find(t => t.transferId === transactionToEdit.transferId && t.type === 'expense')?.accountId)) : transactionToEdit.accountId);

                roundUpTx = transactions.find(t => 
                    t.accountId === currentAccountId &&
                    t.date === transactionToEdit.date &&
                    t.merchant === 'Round Up' &&
                    t.transferId?.startsWith('spare-') &&
                    !boundSpareTransferIds.has(t.transferId!) &&
                    t.description.includes(transactionToEdit.description || '')
                );
            }

            if (roundUpTx) {
                setEnableRoundUp(true);
                setExistingRoundUpTransaction(roundUpTx);
            } else {
                setEnableRoundUp(Boolean(linkedSpareChangeAccount));
                setExistingRoundUpTransaction(null);
            }
        }

        if (transactionToEdit.description) {
            setIsDescriptionUserModified(true);
        }
    }
  }, [transactionToEdit, isEditing, transactions, defaultAccountId]);

  useEffect(() => {
    if (linkedSpareChangeAccount) {
      setEnableRoundUp(true);
    }
  }, [linkedSpareChangeAccount]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setIsTagSelectorOpen(false);
      }
      if (merchantContainerRef.current && !merchantContainerRef.current.contains(event.target as Node)) {
        setShowMerchantSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const activeCategories = useMemo(() => {
    return type === 'income' ? incomeCategories : expenseCategories;
  }, [type, incomeCategories, expenseCategories]);
  
  useEffect(() => {
    if (!isEditing) {
        if (type === 'transfer') {
            setCategory(initialCategory || 'Transfer');
        } else {
            setCategory(initialCategory || '');
        }
    }
  }, [type, isEditing, initialCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let toSave: (Omit<Transaction, 'id'> & { id?: string })[] = [];
    let toDelete: string[] = [];

    const totalAmount = isLoanPayment 
      ? (parseFloat(principalPayment) || 0) + (parseFloat(interestPayment) || 0) 
      : (parseFloat(amount) || 0);
      
    if (!totalAmount) {
      toast.error('Please enter a valid amount');
      return;
    }

    const wasTransfer = isEditing && !!transactionToEdit.transferId;
    const isNowTransfer = type === 'transfer';

    if (isEditing) {
        if (wasTransfer && !isNowTransfer) {
            const counterpart = transactions?.find(t => t.transferId === transactionToEdit.transferId && t.id !== transactionToEdit.id);
            toDelete.push(transactionToEdit.id);
            if (counterpart) toDelete.push(counterpart.id);
        } else if (!wasTransfer && isNowTransfer) {
            toDelete.push(transactionToEdit.id);
        }
    }

    const hasLocation = Boolean(address?.trim() || city?.trim() || country?.trim());
    const locationProps = {
        address: hasLocation ? (address?.trim() || undefined) : undefined,
        placeName: hasLocation ? (placeName?.trim() || undefined) : undefined,
        street: hasLocation ? (street?.trim() || undefined) : undefined,
        city: hasLocation ? (city?.trim() || undefined) : undefined,
        postalCode: hasLocation ? (postalCode?.trim() || undefined) : undefined,
        state: hasLocation ? (stateRegion?.trim() || undefined) : undefined,
        country: hasLocation ? (country?.trim() || undefined) : undefined,
        latitude: hasLocation && latitude !== undefined && !isNaN(latitude) ? latitude : undefined,
        longitude: hasLocation && longitude !== undefined && !isNaN(longitude) ? longitude : undefined,
        locationLabel: hasLocation ? (locationLabel?.trim() || undefined) : undefined,
    };

    if (isNowTransfer) {
        if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
            toast.error("Please select two different accounts for the transfer.");
            return;
        }
        const fromAcc = accounts.find(acc => acc.id === fromAccountId);
        const toAcc = accounts.find(acc => acc.id === toAccountId);
        if (!fromAcc || !toAcc) return;

        const transferId = (isEditing && wasTransfer) ? transactionToEdit.transferId : `xfer-${uuidv4()}`;
        
        const expenseTx: Omit<Transaction, 'id'> & { id?: string } = {
            accountId: fromAccountId,
            date,
            description: description || `Transfer to ${toAcc.name}`,
            merchant: merchant || 'Internal Transfer',
            amount: -Math.abs(totalAmount),
            category: category || 'Transfer',
            type: 'expense',
            currency: fromAcc.currency,
            transferId,
            tagIds,
            notes,
            ...locationProps
        };

        const incomeTx: Omit<Transaction, 'id'> & { id?: string } = {
            accountId: toAccountId,
            date,
            description: description || `Transfer from ${fromAcc.name}`,
            merchant: merchant || 'Internal Transfer',
            amount: Math.abs(totalAmount),
            category: category || 'Transfer',
            type: 'income',
            currency: toAcc.currency,
            transferId,
            tagIds,
            notes,
            ...locationProps
        };
        
        if (isLoanPayment && loanAccount) {
            const principalValue = parseFloat(principalPayment) || 0;
            const interestValue = parseFloat(interestPayment) || 0;
            if (expenseTx.accountId === loanAccount.id) {
                expenseTx.principalAmount = principalValue;
                expenseTx.interestAmount = interestValue;
            } else if (incomeTx.accountId === loanAccount.id) {
                incomeTx.principalAmount = principalValue;
                incomeTx.interestAmount = interestValue;
            }
        }

        if (isEditing && wasTransfer) {
            const originalExpense = transactions!.find(t => t.transferId === transferId && t.type === 'expense');
            const originalIncome = transactions!.find(t => t.transferId === transferId && t.type === 'income');
            expenseTx.id = originalExpense?.id;
            incomeTx.id = originalIncome?.id;
        } else {
            if (!expenseTx.id) expenseTx.id = uuidv4();
            if (!incomeTx.id) incomeTx.id = uuidv4();
        }

        toSave.push(expenseTx, incomeTx);
    } else {
        const accountId = type === 'income' ? toAccountId : fromAccountId;
        if (!accountId || !category) {
            toast.error("Please select both an account and a category.");
            return;
        }
        const selectedAccount = accounts.find(acc => acc.id === accountId);
        if (!selectedAccount) return;

        const transactionData: Omit<Transaction, 'id'> & { id?: string } = {
            accountId,
            date,
            description,
            merchant,
            amount: type === 'expense' ? -Math.abs(totalAmount) : Math.abs(totalAmount),
            category,
            type,
            currency: selectedAccount.currency,
            tagIds,
            notes,
            ...locationProps
        };
        
        if (isLoanPayment && loanAccount && accountId === loanAccount.id) {
            transactionData.principalAmount = parseFloat(principalPayment) || 0;
            transactionData.interestAmount = parseFloat(interestPayment) || 0;
        }

        if (isEditing && !wasTransfer) {
            transactionData.id = transactionToEdit.id;
        } else if (!transactionData.id) {
            transactionData.id = uuidv4();
        }

        toSave.push(transactionData);
    }

    const canHaveRoundUp = (type === 'expense' || type === 'transfer') && linkedSpareChangeAccount;
    const shouldSaveRoundUp = canHaveRoundUp && enableRoundUp && adjustedRoundUpAmount > 0;
    const shouldDeleteRoundUp = existingRoundUpTransaction && !shouldSaveRoundUp;

    if (shouldDeleteRoundUp && existingRoundUpTransaction) {
        toDelete.push(existingRoundUpTransaction.id);
        const pair = transactions?.find(t => t.transferId === existingRoundUpTransaction.transferId && t.id !== existingRoundUpTransaction.id);
        if (pair) toDelete.push(pair.id);
    } else if (shouldSaveRoundUp && linkedSpareChangeAccount) {
         const targetTxId = toSave[0]?.id;
         const spareTransferId = existingRoundUpTransaction?.transferId || `spare-${targetTxId || uuidv4()}`;
         const expenseId = existingRoundUpTransaction?.id;
         
         let incomeId = undefined;
         if (existingRoundUpTransaction && transactions) {
             const pair = transactions.find(t => t.transferId === spareTransferId && t.id !== existingRoundUpTransaction.id);
             incomeId = pair?.id;
         }
         
         const selectedAccount = accounts.find(acc => acc.id === fromAccountId);

         if (selectedAccount) {
              const spareExpenseTx: Omit<Transaction, 'id'> & { id?: string } = {
                id: expenseId,
                accountId: fromAccountId,
                date,
                description: `Spare change for ${description || 'Transaction'}`,
                merchant: 'Round Up',
                amount: -Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'expense',
                currency: selectedAccount.currency,
                transferId: spareTransferId,
            };

            const spareIncomeTx: Omit<Transaction, 'id'> & { id?: string } = {
                id: incomeId,
                accountId: linkedSpareChangeAccount.id,
                date,
                description: `Spare change from ${description || 'Transaction'}`,
                merchant: 'Round Up',
                amount: Math.abs(adjustedRoundUpAmount),
                category: 'Transfer',
                type: 'income',
                currency: linkedSpareChangeAccount.currency,
                transferId: spareTransferId,
            };
            
            toSave.push(spareExpenseTx, spareIncomeTx);
         }
    }
    
    onSave(toSave, toDelete);
    handleCloseDrawer();
  };

  const labelStyle = "block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wide mb-1.5";

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop Blur Overlay */}
      <div 
        className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleCloseDrawer}
      />

      {/* Right-Side Full Height Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div 
          className={`w-screen max-w-full sm:max-w-xl md:max-w-2xl h-screen bg-white dark:bg-[#12141a] text-gray-900 dark:text-white shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Header Section */}
          <div className="shrink-0 border-b border-black/5 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
            {/* Top Action Ribbon */}
            <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2.5 py-1 rounded-full border border-primary-500/20">
                  <Icon name={isEditing ? 'edit' : 'add'} className="text-xs" />
                  {isEditing ? 'Edit Transaction' : 'New Transaction'}
                </span>
                
                {isLoanPayment && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                    <Icon name="account_balance" className="text-xs" />
                    Loan Repayment
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer"
                  title="Close panel (Esc)"
                >
                  <Icon name="close" className="text-lg" />
                  <span className="hidden sm:inline text-xs font-medium text-gray-400 font-mono">ESC</span>
                </button>
              </div>
            </div>

            {/* Hero Section: Type Switcher & Dynamic Amount & Spare Change */}
            <div className="px-5 sm:px-6 py-3 space-y-3">
              {/* Type Switcher */}
              <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    type === 'expense' 
                      ? 'bg-white dark:bg-dark-card text-rose-600 dark:text-rose-400 shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="arrow_downward" className="text-xs" />
                  <span>Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    type === 'income' 
                      ? 'bg-white dark:bg-dark-card text-emerald-600 dark:text-emerald-400 shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="arrow_upward" className="text-xs" />
                  <span>Income</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('transfer')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    type === 'transfer' 
                      ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="sync_alt" className="text-xs" />
                  <span>Transfer</span>
                </button>
              </div>

              {/* Amount Display & Input Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    type === 'expense' 
                      ? 'bg-rose-500/10 text-rose-500' 
                      : type === 'income' 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    <span className="text-xl font-bold font-mono">{currencySymbol}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Transaction Amount
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-70 truncate">
                      {type === 'expense' ? 'Funds leaving your account' : type === 'income' ? 'Funds deposited' : 'Internal liquidity rebalance'}
                    </p>
                  </div>
                </div>

                <div className="relative group shrink-0 flex items-center justify-end">
                  <input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    onBlur={() => applyRules(merchant, description, amount)}
                    className="bg-transparent border-none text-right text-2xl sm:text-3xl font-black text-gray-900 dark:text-white placeholder-black/15 dark:placeholder-white/15 focus:ring-0 py-0 tracking-tight tabular-nums w-36 sm:w-44 focus:outline-hidden"
                    placeholder="0.00"
                    autoFocus
                    required
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* SPARE CHANGE MANAGEMENT (Directly Under Transaction Amount) */}
              {linkedSpareChangeAccount && (type === 'expense' || type === 'transfer') && (
                <div className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                  enableRoundUp 
                    ? 'bg-cyan-500/[0.07] dark:bg-cyan-500/[0.10] border-cyan-500/30' 
                    : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-70 hover:opacity-100'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                        enableRoundUp ? 'bg-cyan-500 text-white shadow-xs' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                      }`}>
                        <Icon name="savings" className="text-sm pointer-events-none" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-bold truncate ${enableRoundUp ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-900 dark:text-white'}`}>
                            Spare Change Round-Up
                          </h4>
                          {enableRoundUp && adjustedRoundUpAmount > 0 && (
                            <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                              +{formatCurrency(adjustedRoundUpAmount, activeAccount?.currency || 'EUR')}
                            </span>
                          )}
                        </div>
                        <p className="text-2xs text-gray-500 dark:text-gray-400 opacity-80 truncate mt-0.5">
                          Target: {linkedSpareChangeAccount.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {enableRoundUp && (
                        <button
                          type="button"
                          onClick={() => setShowSpareChangeSettings(prev => !prev)}
                          className="p-1.5 rounded-lg text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                          title="Configure round-up strategy"
                        >
                          <Icon name="tune" className="text-xs" />
                        </button>
                      )}

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableRoundUp}
                          onChange={e => setEnableRoundUp(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Expandable Spare Change Settings */}
                  {enableRoundUp && showSpareChangeSettings && (
                    <div className="mt-3 pt-3 border-t border-cyan-500/15 space-y-2.5 animate-fade-in">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-2xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                            Strategy
                          </label>
                          <div className="flex bg-white dark:bg-black/20 p-0.5 rounded-xl border border-cyan-500/20">
                            <button
                              type="button"
                              onClick={() => setRoundUpBehavior('skip')}
                              className={`flex-1 py-1 text-2xs font-bold rounded-lg transition-all cursor-pointer ${
                                roundUpBehavior === 'skip' ? 'bg-cyan-500 text-white shadow-xs' : 'text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/5'
                              }`}
                            >
                              Skip Whole
                            </button>
                            <button
                              type="button"
                              onClick={() => setRoundUpBehavior('unit')}
                              className={`flex-1 py-1 text-2xs font-bold rounded-lg transition-all cursor-pointer ${
                                roundUpBehavior === 'unit' ? 'bg-cyan-500 text-white shadow-xs' : 'text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/5'
                              }`}
                            >
                              Unit Push
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-2xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                            Multiplier
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={roundUpMultiplier}
                            onChange={e => setRoundUpMultiplier(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-8 font-bold text-cyan-700 dark:text-cyan-300 text-xs border-cyan-500/20 focus:ring-cyan-500`}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="px-5 sm:px-6 flex gap-1 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'details'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="assignment" className="text-sm" />
                <span>Primary Details</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('location')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'location'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="marker_pin" className="text-sm" />
                <span>Location & Branches</span>
                {address && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                )}
                {merchantBranches.length > 0 && !address && (
                  <span className="text-2xs font-bold px-1.5 py-0.2 rounded-full bg-primary-500/10 text-primary-500">
                    {merchantBranches.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('extras')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'extras'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="tune" className="text-sm" />
                <span>Tags & Notes</span>
                {tagIds.length > 0 && (
                  <span className="text-2xs font-bold px-1.5 py-0.2 rounded-full bg-primary-500/10 text-primary-500">
                    {tagIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
            <form id="transaction-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* TAB 1: PRIMARY DETAILS */}
              {activeTab === 'details' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* REDESIGNED ACCOUNT SELECTION SECTION */}
                  <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name="wallet" className="text-sm text-primary-500" />
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {type === 'transfer' ? 'Account Transfer Route' : (type === 'income' ? 'Holding Account' : 'Source Account')}
                        </span>
                      </div>
                      <span className="text-2xs text-primary-500 font-semibold uppercase tracking-wider">
                        {type === 'transfer' ? 'Dual Liquidity Bridge' : 'Active Balance'}
                      </span>
                    </div>

                    {type === 'transfer' ? (
                      /* Transfer Mode: Dual Connected Account Pickers with Swap Action */
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center relative">
                          <AccountPicker
                            label="From (Source)"
                            selectedAccountId={fromAccountId}
                            onSelect={setFromAccountId}
                            accounts={accounts}
                            excludeAccountId={toAccountId}
                            isOpen={isFromAccountPickerOpen}
                            onToggle={() => {
                              setIsFromAccountPickerOpen(prev => !prev);
                              setIsToAccountPickerOpen(false);
                            }}
                            onClose={() => setIsFromAccountPickerOpen(false)}
                            brandfetchClientId={brandfetchClientId}
                            merchantLogoOverrides={merchantLogoOverrides}
                          />

                          {/* Swap Button for Desktop / Mobile */}
                          <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-1 z-10">
                            <button
                              type="button"
                              onClick={handleSwapAccounts}
                              className="w-8 h-8 rounded-full bg-white dark:bg-[#181a20] border border-gray-200 dark:border-white/10 shadow-md flex items-center justify-center text-primary-500 hover:bg-primary-500 hover:text-white transition-all cursor-pointer active:scale-95"
                              title="Swap source and destination accounts"
                            >
                              <Icon name="sync_alt" className="text-xs" />
                            </button>
                          </div>

                          <AccountPicker
                            label="To (Destination)"
                            selectedAccountId={toAccountId}
                            onSelect={setToAccountId}
                            accounts={accounts}
                            excludeAccountId={fromAccountId}
                            isOpen={isToAccountPickerOpen}
                            onToggle={() => {
                              setIsToAccountPickerOpen(prev => !prev);
                              setIsFromAccountPickerOpen(false);
                            }}
                            onClose={() => setIsToAccountPickerOpen(false)}
                            brandfetchClientId={brandfetchClientId}
                            merchantLogoOverrides={merchantLogoOverrides}
                          />
                        </div>

                        {/* Mobile Swap Button */}
                        <div className="flex sm:hidden justify-center">
                          <button
                            type="button"
                            onClick={handleSwapAccounts}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 px-3 py-1 rounded-xl transition-all cursor-pointer"
                          >
                            <Icon name="sync_alt" className="text-xs" />
                            <span>Swap Accounts Direction</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Single Account Mode (Expense / Income) */
                      <AccountPicker
                        label={type === 'income' ? 'Holding Account' : 'From Account'}
                        selectedAccountId={type === 'income' ? toAccountId : fromAccountId}
                        onSelect={id => type === 'income' ? setToAccountId(id) : setFromAccountId(id)}
                        accounts={accounts}
                        isOpen={isFromAccountPickerOpen}
                        onToggle={() => setIsFromAccountPickerOpen(prev => !prev)}
                        onClose={() => setIsFromAccountPickerOpen(false)}
                        brandfetchClientId={brandfetchClientId}
                        merchantLogoOverrides={merchantLogoOverrides}
                      />
                    )}
                  </div>

                  {/* Date & Merchant Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Date Picker */}
                    <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1.5">
                      <label className={labelStyle}>Execution Date</label>
                      <div className="relative group">
                        <Icon name="calendar_today" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                        <input
                          id="tx-date"
                          type="date"
                          value={date}
                          onChange={e => setDate(e.target.value)}
                          className={`${INPUT_BASE_STYLE} pl-9 !h-10 text-xs font-semibold`}
                          required
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    {/* Merchant / Counterparty */}
                    <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1.5" ref={merchantContainerRef}>
                      <div className="flex items-center justify-between">
                        <label className={labelStyle}>Counterparty / Merchant</label>
                        {merchant && (
                          <span className="text-2xs text-primary-500 font-semibold uppercase">Live Lookup</span>
                        )}
                      </div>

                      <div className="relative">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center bg-black/5 dark:bg-white/10 shrink-0 pointer-events-none">
                          {currentMerchantLogoUrl ? (
                            <img
                              src={currentMerchantLogoUrl}
                              alt={merchant}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <Icon name="store" className="text-gray-400 text-xs pointer-events-none" />
                          )}
                        </div>

                        <input
                          id="tx-merchant"
                          type="text"
                          value={merchant}
                          onChange={handleMerchantChange}
                          onFocus={() => {
                            setShowMerchantSuggestions(true);
                            setActiveSuggestionIndex(-1);
                          }}
                          onKeyDown={handleMerchantKeyDown}
                          className={`${INPUT_BASE_STYLE} pl-10 !h-10 text-xs font-semibold`}
                          placeholder={type === 'transfer' ? 'Internal Transfer' : 'Store, entity, or person...'}
                          autoComplete="off"
                          spellCheck={false}
                        />

                        {/* Dropdown Suggestions */}
                        {showMerchantSuggestions && filteredSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#181a20] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-[60] max-h-56 overflow-y-auto py-1.5 custom-scrollbar">
                            <div className="px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex justify-between items-center border-b border-black/5 dark:border-white/5 mb-1">
                              <span>{!merchant.trim() ? 'Popular Merchants' : 'Matching Merchants'}</span>
                              <span>{filteredSuggestions.length} found</span>
                            </div>
                            {filteredSuggestions.map((item, index) => {
                              const logoUrl = getMerchantLogoUrl(item.name, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 48, height: 48 });
                              const isSelected = index === activeSuggestionIndex;
                              return (
                                <button
                                  key={item.name}
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => {
                                    setMerchant(item.name);
                                    setIsDescriptionUserModified(false);
                                    setIsCategoryUserModified(false);
                                    setIsLocationUserModified(false);
                                    applyRules(item.name, description, amount, { 
                                      forceAutofillDesc: true,
                                      forceAutofillCategory: true,
                                      forceAutofillLocation: true
                                    });
                                    setShowMerchantSuggestions(false);
                                    setActiveSuggestionIndex(-1);
                                  }}
                                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-all duration-150 cursor-pointer ${
                                    isSelected 
                                      ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold border border-primary-500/30' 
                                      : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {logoUrl ? (
                                      <img
                                        src={logoUrl}
                                        alt={item.name}
                                        className="w-5 h-5 rounded-md object-cover bg-gray-100 dark:bg-gray-800 shrink-0"
                                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                      />
                                    ) : (
                                      <Icon name="store" className="text-gray-400 text-sm shrink-0 pointer-events-none" />
                                    )}
                                    <span className="font-bold tracking-tight truncate">{item.name}</span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    {item.category && (
                                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400">
                                        {item.category}
                                      </span>
                                    )}
                                    <span className="text-2xs text-gray-400 font-mono">
                                      {item.count} {item.count === 1 ? 'txn' : 'txns'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Merchant Branch Quick Chips Banner if multiple locations exist */}
                  {merchantBranches.length > 1 && (
                    <div className="p-3 bg-primary-500/[0.04] dark:bg-primary-500/[0.06] rounded-2xl border border-primary-500/20 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Icon name="marker_pin" className="text-xs text-primary-500" />
                          <span>Branches for {merchant}:</span>
                        </p>
                        {address && (
                          <button
                            type="button"
                            onClick={handleClearLocation}
                            className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {merchantBranches.map(branch => {
                          const isSelected = address === branch.address || (locationLabel && locationLabel === branch.label);
                          return (
                            <button
                              key={branch.id}
                              type="button"
                              onClick={() => handleSelectMerchantBranch(branch)}
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-primary-500 text-white shadow-xs'
                                  : 'bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 text-gray-900 dark:text-white hover:border-primary-500/50 hover:text-primary-500'
                              }`}
                              title={branch.address}
                            >
                              <span>📍 {branch.label || branch.city || branch.placeName}</span>
                              {branch.isPrimary && (
                                <span className={`text-2xs px-1 py-0.2 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-primary-500/10 text-primary-500'}`}>
                                  Primary
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category Selection */}
                  <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={labelStyle}>Category Classification</label>
                      {category && (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400">
                          {category}
                        </span>
                      )}
                    </div>

                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        id="tx-category"
                        value={category}
                        onChange={e => {
                          setCategory(e.target.value);
                          setIsCategoryUserModified(true);
                        }}
                        className={`${SELECT_STYLE} !h-10 text-xs font-semibold`}
                        required={type !== 'transfer'}
                      >
                        <CategoryOptions categories={activeCategories} showTransferOption={type === 'transfer'} />
                      </select>
                      <div className={SELECT_ARROW_STYLE}>
                        <Icon name="expand_more" className="text-sm pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Description / Memo */}
                  <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                    <label className={labelStyle}>Internal Memo / Description</label>
                    <div className="relative group">
                      <Icon name="description" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                      <input
                        id="tx-description"
                        type="text"
                        value={description}
                        onChange={e => {
                          setDescription(e.target.value);
                          setIsDescriptionUserModified(true);
                        }}
                        onBlur={handleDescriptionBlur}
                        className={`${INPUT_BASE_STYLE} pl-9 !h-10 text-xs font-medium`}
                        placeholder={type === 'transfer' ? 'Internal transfer purpose' : 'What was this transaction for?'}
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {/* Loan Repayment Split Card (if loan payment) */}
                  {isLoanPayment && (
                    <div className="p-4 rounded-3xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Icon name="account_balance" className="text-blue-500 text-sm" />
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            Loan Amortization Split
                          </span>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={useAutoLoanSplit}
                            onChange={e => setUseAutoLoanSplit(e.target.checked)}
                            className={CHECKBOX_STYLE}
                          />
                          <span className="text-xs font-semibold text-blue-500 group-hover:underline">
                            Auto-Calculate
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-blue-500">Principal</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/60 font-bold text-xs pointer-events-none">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={principalPayment}
                              onChange={handlePrincipalChange}
                              className="w-full h-9 bg-white dark:bg-black/20 rounded-xl pl-8 pr-3 text-xs font-bold text-blue-600 dark:text-blue-300 tabular-nums border border-blue-500/20 focus:ring-2 focus:ring-blue-500"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-blue-500">Interest</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/60 font-bold text-xs pointer-events-none">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={interestPayment}
                              onChange={handleInterestChange}
                              className="w-full h-9 bg-white dark:bg-black/20 rounded-xl pl-8 pr-3 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums border border-blue-500/20 focus:ring-2 focus:ring-blue-500"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LOCATION & BRANCHES */}
              {activeTab === 'location' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Digital Online Business Info */}
                  {activeMerchantRule?.isOnline && (
                    <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                      <Icon name="info" className="text-blue-500 text-base shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1 text-gray-900 dark:text-white">
                        <p className="font-bold">🌐 Registered Online / Digital Merchant</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          {merchant} is marked as an online service. Physical map coordinates are optional.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Known Merchant Branches */}
                  {merchantBranches.length > 0 && (
                    <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className={labelStyle}>Known Merchant Branches</label>
                        <span className="text-2xs text-primary-500 font-semibold uppercase">{merchantBranches.length} registered</span>
                      </div>

                      <div className="space-y-2">
                        {merchantBranches.map(branch => {
                          const isSelected = address === branch.address || (locationLabel && locationLabel === branch.label);
                          return (
                            <div
                              key={branch.id}
                              onClick={() => handleSelectMerchantBranch(branch)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-primary-500/10 border-primary-500 text-primary-700 dark:text-primary-300'
                                  : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-primary-500/30'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/10 text-primary-500'
                                }`}>
                                  <Icon name="marker_pin" className="text-sm" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold truncate">{branch.label || branch.placeName || 'Branch'}</p>
                                    {branch.isPrimary && (
                                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded-full bg-primary-500/10 text-primary-500">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{branch.address}</p>
                                </div>
                              </div>

                              {isSelected ? (
                                <Icon name="check" className="text-primary-500 text-base shrink-0" />
                              ) : (
                                <span className="text-2xs font-bold text-primary-500 hover:underline shrink-0">Select</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Address Search */}
                  <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className={labelStyle}>Physical Address Search</label>
                      {address && (
                        <button
                          type="button"
                          onClick={() => setShowManualLocation(prev => !prev)}
                          className="text-xs font-semibold text-primary-500 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Icon name="tune" className="text-xs" />
                          <span>{showManualLocation ? 'Hide Coordinates' : 'Fine-Tune'}</span>
                        </button>
                      )}
                    </div>

                    <AddressAutocomplete
                      value={address}
                      onChange={handleAddressChange}
                      placeholder="Search address, store, or city..."
                    />

                    {/* Resolved Location Card */}
                    {address && (
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2.5 shadow-2xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0 mt-0.5">
                              <Icon name="marker_pin" className="text-sm" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-gray-900 dark:text-white leading-snug">
                                  {locationLabel || placeName || street || address}
                                </p>
                                {country && (
                                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                                    {country}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                                {address}
                              </p>
                              {(latitude !== undefined && longitude !== undefined) && (
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-2xs font-mono font-semibold bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-primary-600 dark:text-primary-400">
                                    📍 {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                                  </span>
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-semibold text-primary-500 hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>Google Maps</span>
                                    <Icon name="open_in_new" className="text-xs" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleClearLocation}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors shrink-0 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Fine-tune Coordinates */}
                        {showManualLocation && (
                          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 grid grid-cols-2 gap-2.5 animate-fade-in">
                            <div>
                              <label className="block text-2xs font-bold text-gray-500 dark:text-gray-400 mb-1">Branch / Label</label>
                              <input
                                type="text"
                                value={locationLabel}
                                onChange={e => {
                                  setLocationLabel(e.target.value);
                                  setIsLocationUserModified(true);
                                }}
                                className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                placeholder="e.g. Downtown Branch"
                              />
                            </div>
                            <div>
                              <label className="block text-2xs font-bold text-gray-500 dark:text-gray-400 mb-1">City</label>
                              <input
                                type="text"
                                value={city}
                                onChange={e => {
                                  setCity(e.target.value);
                                  setIsLocationUserModified(true);
                                }}
                                className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                placeholder="e.g. Brussels"
                              />
                            </div>
                            <div>
                              <label className="block text-2xs font-bold text-gray-500 dark:text-gray-400 mb-1">Latitude</label>
                              <input
                                type="number"
                                step="any"
                                value={latitude ?? ''}
                                onChange={e => {
                                  setLatitude(e.target.value ? parseFloat(e.target.value) : undefined);
                                  setIsLocationUserModified(true);
                                }}
                                className={`${INPUT_BASE_STYLE} !py-1 !text-xs font-mono`}
                                placeholder="50.8503"
                              />
                            </div>
                            <div>
                              <label className="block text-2xs font-bold text-gray-500 dark:text-gray-400 mb-1">Longitude</label>
                              <input
                                type="number"
                                step="any"
                                value={longitude ?? ''}
                                onChange={e => {
                                  setLongitude(e.target.value ? parseFloat(e.target.value) : undefined);
                                  setIsLocationUserModified(true);
                                }}
                                className={`${INPUT_BASE_STYLE} !py-1 !text-xs font-mono`}
                                placeholder="4.3517"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: TAGS & EXTRAS */}
              {activeTab === 'extras' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Categorical Tags */}
                  <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3" ref={tagSelectorRef}>
                    <div className="flex items-center justify-between">
                      <label className={labelStyle}>Categorical Tags</label>
                      <span className="text-2xs text-primary-500 font-semibold uppercase">{tagIds.length} selected</span>
                    </div>

                    <div 
                      onClick={() => setIsTagSelectorOpen(prev => !prev)}
                      className={`${INPUT_BASE_STYLE} min-h-[44px] py-2 px-3 flex flex-wrap gap-1.5 items-center cursor-pointer`}
                    >
                      {tagIds.length === 0 ? (
                        <span className="text-gray-400 text-xs font-medium">Select tags...</span>
                      ) : (
                        tagIds.map(tid => {
                          const tag = (tags || []).find(t => t.id === tid);
                          if (!tag) return null;
                          return (
                            <span 
                              key={tid}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20"
                            >
                              <span>{tag.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTagIds(prev => prev.filter(id => id !== tid));
                                }}
                                className="hover:text-red-500 cursor-pointer"
                              >
                                <Icon name="close" className="text-xs" />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>

                    {isTagSelectorOpen && (
                      <div className="p-2 bg-white dark:bg-[#181a20] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {(!tags || tags.length === 0) ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">No tags available in workspace</p>
                        ) : (
                          tags.map(tag => {
                            const isSelected = tagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  setTagIds(prev => isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                                  isSelected 
                                    ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 font-bold' 
                                    : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-900 dark:text-white'
                                }`}
                              >
                                <span>{tag.name}</span>
                                {isSelected && <Icon name="check" className="text-xs text-primary-500" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extended Remarks & Notes */}
                  <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                    <label className={labelStyle}>Extended Notes & Remarks</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className={`${INPUT_BASE_STYLE} min-h-[96px] p-3 text-xs font-medium resize-none border-dashed bg-white dark:bg-white/[0.02] text-gray-900 dark:text-white`}
                      placeholder="Add any contextual remarks, receipt references, or details..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* 3. Sticky Drawer Footer */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12141a]/95 backdrop-blur-md flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setMerchant('');
                setDescription('');
                setAmount('');
                setCategory('');
                setNotes('');
                setTagIds([]);
                handleClearLocation();
                toast.info('Fields cleared');
              }}
              className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              Clear Fields
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className={`${BTN_SECONDARY_STYLE} !py-2 !px-4 !text-xs cursor-pointer`}
              >
                Dismiss
              </button>

              <button
                type="submit"
                form="transaction-form"
                className={`${BTN_PRIMARY_STYLE} !py-2 !px-6 !text-xs flex items-center gap-1.5 shadow-md shadow-primary-500/20 cursor-pointer`}
              >
                <Icon name="check" className="text-xs" />
                <span>{isEditing ? 'Save Changes' : 'Confirm Transaction'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default AddTransactionModal;

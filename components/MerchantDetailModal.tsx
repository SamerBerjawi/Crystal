import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Category, MerchantRule, Transaction } from '../types';
import { useTransactionsContext } from '../contexts/DomainProviders';
import { categoryPickerOptions } from '../utils/categoryTree';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { branchesOf, merchantTransactionCount, primaryBranch, transactionsAtBranch, withBranches } from '../utils/merchantModel';
import MerchantBranches from './MerchantBranches';
import MerchantKeywordRules from './MerchantKeywordRules';
import MerchantLogoFields from './MerchantLogoFields';
import { Button } from './ui/Actions';
import { Switch, Textarea, TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { Combobox } from './ui/Pickers';
import SegmentedControl from './ui/SegmentedControl';

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'branches', label: 'Branches' },
  { id: 'logo', label: 'Logo' },
];

interface MerchantDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantName: string;
  logoKey: string;
  initialRule?: MerchantRule;
  onSave: (key: string, rule: MerchantRule) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  transactions: Transaction[];
  brandfetchClientId?: string;
}

const draftFrom = (rule: MerchantRule | undefined, logoKey: string) => ({
  category: rule?.category || '',
  defaultDescription: rule?.defaultDescription || '',
  notes: rule?.notes || '',
  website: rule?.website || (!rule && logoKey.includes('.') ? `https://${logoKey}` : ''),
  logo: rule?.logo || '',
  isHidden: rule?.isHidden || false,
  isOnline: rule?.isOnline || false,
  branches: branchesOf(rule),
});

/** Edits one merchant in a 640 side panel. The profile on Merchants shows the result. */
const MerchantDetailModal: React.FC<MerchantDetailModalProps> = ({ isOpen, onClose, merchantName, logoKey, initialRule, onSave, incomeCategories, expenseCategories, transactions, brandfetchClientId }) => {
  const { saveTransaction } = useTransactionsContext();
  const [saved, setSaved] = useState(() => draftFrom(initialRule, logoKey));
  const [draft, setDraft] = useState(saved);
  const [tab, setTab] = useState('details');
  const [refreshedAt, setRefreshedAt] = useState<number>();
  // A merchant's first branch goes onto its transactions. After that, a transaction may be at a different branch, so it's a choice.
  const [stampTransactions, setStampTransactions] = useState(saved.branches.length === 0);

  useEffect(() => {
    const next = draftFrom(initialRule, logoKey);
    setSaved(next);
    setDraft(next);
    setStampTransactions(next.branches.length === 0);
    // Only a different merchant restarts the draft: a keyword saved here also changes the rule's filing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoKey]);

  const update = (change: Partial<typeof draft>) => setDraft(prev => ({ ...prev, ...change }));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const categoryOptions = useMemo(() => categoryPickerOptions(expenseCategories, incomeCategories), [expenseCategories, incomeCategories]);

  const previewUrl = getMerchantLogoUrl(merchantName, brandfetchClientId, { [logoKey]: draft.logo || logoKey }, { fallback: 'lettermark', type: 'icon', width: 120, height: 120, refreshTimestamp: refreshedAt });
  const transactionCount = merchantTransactionCount(transactions, logoKey, merchantName);

  const save = () => {
    const { branches, category, defaultDescription, notes, website, logo, isHidden, isOnline } = draft;
    onSave(logoKey, withBranches({
      category: category || undefined,
      defaultDescription: defaultDescription || undefined,
      notes: notes || undefined,
      website: website || undefined,
      logo: logo || undefined,
      isHidden,
      isOnline,
    }, branches));

    const primary = primaryBranch(branches);
    const stamped = stampTransactions && primary ? transactionsAtBranch(transactions, logoKey, merchantName, primary) : [];
    if (stamped.length > 0) saveTransaction(stamped);
    toast.success(stamped.length > 0 ? `Saved ${merchantName} and its location on ${stamped.length} ${stamped.length === 1 ? 'transaction' : 'transactions'}` : `Saved ${merchantName}`);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      width={640}
      title={`Edit ${merchantName}`}
      isDirty={isDirty}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={save}>Save</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <SegmentedControl items={TABS} activeId={tab} onChange={setTab} />

        {tab === 'details' && (
          <>
            <div className="space-y-4">
              <Combobox label="Category" help="New transactions from this merchant are filed here." options={categoryOptions} value={draft.category || null} onChange={id => update({ category: id ?? '' })} placeholder="Search categories" />
              <TextInput label="Description" help="Used in place of the bank's text." value={draft.defaultDescription} onChange={defaultDescription => update({ defaultDescription })} />
              <Textarea label="Notes" placeholder="Contract number, support contact, how to cancel" value={draft.notes} onChange={notes => update({ notes })} />
              <Switch isSelected={draft.isHidden} onChange={isHidden => update({ isHidden })}>Hide from merchant lists</Switch>
            </div>
            <MerchantKeywordRules merchantName={merchantName} category={draft.category} description={draft.defaultDescription} transactions={transactions} />
          </>
        )}

        {tab === 'branches' && (
          <>
            <Switch isSelected={draft.isOnline} onChange={isOnline => update({ isOnline })}>Online business</Switch>
            <MerchantBranches branches={draft.branches} onChange={branches => update({ branches })} />
            {draft.branches.length > 0 && transactionCount > 0 && (
              <Switch isSelected={stampTransactions} onChange={setStampTransactions}>
                Put the primary branch on {transactionCount === 1 ? 'its transaction' : `all ${transactionCount} transactions`}
              </Switch>
            )}
          </>
        )}

        {tab === 'logo' && (
          <MerchantLogoFields
            merchantName={merchantName}
            logo={draft.logo}
            previewUrl={previewUrl}
            website={draft.website}
            onLogoChange={logo => update({ logo })}
            onWebsiteChange={website => update({ website })}
            onRefresh={() => setRefreshedAt(Date.now())}
          />
        )}
      </div>
    </SidePanel>
  );
};

export default MerchantDetailModal;

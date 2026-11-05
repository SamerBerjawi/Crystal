import React from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Account } from '../types';
import { useAccountFilterOptions } from '../hooks/useAccountFilterOptions';
import { FilterList } from './FilterList';
import Icon from './ui/Icon';
import { Popover } from './ui/Overlays';
import { chipRow } from './ui/Pickers';

interface MultiAccountFilterProps {
  accounts: Account[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
}

/** Which accounts Overview counts. The same list and quick filters as the Ledger's account filter. */
const MultiAccountFilter: React.FC<MultiAccountFilterProps> = ({ accounts, selectedAccountIds, setSelectedAccountIds }) => {
  const { options, quick } = useAccountFilterOptions(accounts);

  const label = selectedAccountIds.length === accounts.length ? 'All accounts'
    : selectedAccountIds.length === 0 ? 'No accounts'
    : selectedAccountIds.length === 1 ? (accounts.find(a => a.id === selectedAccountIds[0])?.name ?? '1 account')
    : `${selectedAccountIds.length} accounts`;

  return (
    <Popover
      title="Accounts"
      trigger={
        <AriaButton aria-label={`Accounts: ${label}`} className={chipRow}>
          <Icon name="wallet-02" size={16} className="text-muted" />
          <span className="max-w-[160px] truncate">{label}</span>
          <Icon name="arrow-down-01" size={16} className="text-muted" />
        </AriaButton>
      }
    >
      <FilterList
        title="Accounts"
        label="Accounts"
        searchPlaceholder="Search accounts"
        quick={quick}
        options={options}
        selected={selectedAccountIds}
        onChange={setSelectedAccountIds}
        maxHeightClass="max-h-72"
      />
    </Popover>
  );
};

export default MultiAccountFilter;

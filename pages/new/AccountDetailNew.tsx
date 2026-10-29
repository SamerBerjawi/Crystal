import React, { useMemo, useState } from 'react';
import { AccountFormSheet } from '../../components/new/accounts/AccountFormSheet';
import { AccountDetailHero } from '../../components/new/accounts/detailHero';
import {
  AccountDetailsTab,
  AccountDetailTabBar,
  AccountTransactionSheet,
  useAccountDetailTab,
} from '../../components/new/accounts/detailTabs';
import {
  AccountActivitySection,
  RecordAccountTxSheet,
} from '../../components/new/accounts/detailShared';
import {
  BalanceAdjustmentSheet,
  CloseAssetSheet,
  EnableBankingSyncSheet,
  ValuationSheet,
} from '../../components/new/accounts/sheets';
import { CreditCardArchetype } from '../../components/new/accounts/views/CreditCardArchetype';
import { LoanArchetype } from '../../components/new/accounts/views/LoanArchetype';
import { OperatingAccountArchetype } from '../../components/new/accounts/views/OperatingAccountArchetype';
import { PhysicalAssetArchetype } from '../../components/new/accounts/views/PhysicalAssetArchetype';
import { YieldPotArchetype } from '../../components/new/accounts/views/YieldPotArchetype';
import { usePageAction, useShellNew } from '../../components/new/shellContext';
import { PageToolbar, ToolbarSpacer, ToolButton } from '../../components/new/PageToolbar';
import { Button, Card, EmptyState } from '../../components/new/ui';
import { useAccountDetailData } from '../../hooks/useAccountDetailData';
import type { Account } from '../../types';

/*
 * AccountDetailNew (`/accounts-new/:id`):
 * Single-account inspection workspace that routes across 5 specialized financial archetypes:
 * 1. Operating & Cash (`Checking`, `Other Assets`, `Other Liabilities`)
 * 2. Yield & Accumulation (`Savings`, `Pension Fund`, `Spare Change`)
 * 3. Revolving Credit Card (`Credit Card`)
 * 4. Amortized Debt & Lending (`Loan`, `Lending`)
 * 5. Physical Asset & Lease (`Property`, `Vehicle`)
 */

export const AccountDetailNew: React.FC<{
  accountId: string;
}> = ({ accountId }) => {
  const { navigate } = useShellNew();
  const data = useAccountDetailData(accountId);
  const { account, archetype } = data;
  const { tabs, tab, setTab } = useAccountDetailTab(account, archetype);

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [adjustSheetOpen, setAdjustSheetOpen] = useState(false);
  const [valuationSheetOpen, setValuationSheetOpen] = useState(false);
  const [closeAssetSheetOpen, setCloseAssetSheetOpen] = useState(false);
  const [bankSyncSheetOpen, setBankSyncSheetOpen] = useState(false);
  const [openTxId, setOpenTxId] = useState<string | null>(null);
  const [recordTxMode, setRecordTxMode] = useState<
    'expense' | 'income' | 'interest' | 'card_payment' | null
  >(null);

  const isScheduledLoan =
    !!account &&
    (account.type === 'Loan' || account.type === 'Lending') &&
    !!(account.principalAmount && account.duration && account.loanStartDate && account.interestRate !== undefined);
  const isLeasedVehicle = account?.type === 'Vehicle' && account.ownership === 'Leased';

  // The header's one violet action follows the kind of account (D3, N4).
  const pageAction = useMemo(() => {
    if (!account) return null;
    if (archetype === 'credit_card') {
      return { label: 'Pay statement', icon: 'card' as const, onClick: () => setRecordTxMode('card_payment') };
    }
    if (archetype === 'loan') {
      return isScheduledLoan
        ? { label: 'Record payment', icon: 'add' as const, onClick: () => setTab('plan') }
        : { label: 'Record payment', icon: 'add' as const, onClick: () => setRecordTxMode(account.type === 'Lending' ? 'expense' : 'income') };
    }
    if (archetype === 'physical_asset') {
      return isLeasedVehicle
        ? { label: 'Log mileage', icon: 'car' as const, onClick: () => setTab('valuations') }
        : { label: 'Add valuation', icon: 'add' as const, onClick: () => setValuationSheetOpen(true) };
    }
    if (account.type === 'Savings') {
      return { label: 'Log interest', icon: 'add' as const, onClick: () => setRecordTxMode('interest') };
    }
    if (account.subType === 'Pension Fund') {
      return { label: 'Add contribution', icon: 'add' as const, onClick: () => setRecordTxMode('income') };
    }
    return { label: 'Add transaction', icon: 'add' as const, onClick: () => setRecordTxMode('expense') };
  }, [account, archetype, isScheduledLoan, isLeasedVehicle, setTab]);
  usePageAction(pageAction);

  const handleNavigateToAccount = (target: Account) => {
    if (target.type === 'Investment' && target.symbol) {
      navigate(`/investments-new/${encodeURIComponent(target.symbol)}`);
      return;
    }
    navigate(`/accounts-new/${encodeURIComponent(target.id)}`);
  };

  if (!account) {
    return (
      <div className="space-y-6 pb-10">
        <Card className="p-8">
          <EmptyState
            icon="wallet"
            title="Account not found"
            body="This account may have been deleted or moved."
            action={
              <Button
                variant="primary"
                size="md"
                icon="arrowLeft"
                onClick={() => navigate('/accounts-new')}
              >
                Back to accounts
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Unified Split Hero Card (Identity + 90d History / Forward Forecast + 4 KPIs) */}
      <AccountDetailHero
        data={data}
        onSwitchAccount={handleNavigateToAccount}
        onEdit={() => setEditSheetOpen(true)}
        onOpenCloseAsset={() => setCloseAssetSheetOpen(true)}
      />

      {/* 2. Workspace tabs, directly above what they switch (N21) */}
      <div className="space-y-3">
        <AccountDetailTabBar tabs={tabs} value={tab} onChange={setTab} />
        <PageToolbar>
          <ToolbarSpacer />
          {data.enableBankingLink && (
            <ToolButton variant="success" icon="refresh" label="Sync" onClick={() => setBankSyncSheetOpen(true)} />
          )}
          {!isScheduledLoan && <ToolButton icon="refresh" label="Reconcile" onClick={() => setAdjustSheetOpen(true)} />}
          <ToolButton icon="edit" label="Edit" onClick={() => setEditSheetOpen(true)} />
        </PageToolbar>
      </div>

      {tab === 'overview' && archetype === 'operating' && (
        <OperatingAccountArchetype data={data} onNavigateToAccount={handleNavigateToAccount} />
      )}

      {tab === 'overview' && archetype === 'yield_pot' && (
        <YieldPotArchetype
          data={data}
          onLogInterest={() => setRecordTxMode('interest')}
          onEditAccount={() => setEditSheetOpen(true)}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {tab === 'overview' && archetype === 'credit_card' && (
        <CreditCardArchetype
          data={data}
          onPayStatement={() => setRecordTxMode('card_payment')}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {(tab === 'overview' || tab === 'plan') && archetype === 'loan' && (
        <LoanArchetype data={data} onNavigateToAccount={handleNavigateToAccount} section={tab === 'plan' ? 'plan' : 'overview'} />
      )}

      {(tab === 'overview' || tab === 'valuations') && archetype === 'physical_asset' && (
        <PhysicalAssetArchetype
          data={data}
          onOpenValuation={() => setValuationSheetOpen(true)}
          onEditAccount={() => setEditSheetOpen(true)}
          onNavigateToAccount={handleNavigateToAccount}
          section={tab === 'valuations' ? 'valuations' : 'overview'}
        />
      )}

      {/* 3. Ledger */}
      {tab === 'activity' && (
        <AccountActivitySection
          account={account}
          normalizedTransactions={data.normalizedTransactions}
          allCategories={data.allCategories}
          showBalanceAdjustments={data.showBalanceAdjustments}
          onToggleBalanceAdjustments={data.setShowBalanceAdjustments}
          onOpenRecordTx={() => setRecordTxMode('expense')}
          brandfetchClientId={data.brandfetchClientId}
          merchantLogoOverrides={data.merchantLogoOverrides}
          accounts={data.accounts}
          onOpenTransaction={setOpenTxId}
          onNavigateToFullTransactions={
            data.navigateToTransactions
              ? () => {
                  data.navigateToTransactions?.({ accountName: account.name });
                  navigate('/transactions-new');
                }
              : undefined
          }
        />
      )}

      {tab === 'details' && (
        <AccountDetailsTab
          data={data}
          onEdit={() => setEditSheetOpen(true)}
          onNavigateToAccount={handleNavigateToAccount}
          onOpenCloseAsset={() => setCloseAssetSheetOpen(true)}
          onDeleted={() => navigate('/accounts-new')}
        />
      )}

      {/* 4. Sheets & Drawers */}
      <AccountTransactionSheet txId={openTxId} onClose={() => setOpenTxId(null)} />

      <AccountFormSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        editingAccount={account}
        accounts={data.accounts}
        defaultCurrency={data.displayCurrency}
        onSave={(draft) => {
          const res = data.updateAccount(draft);
          return {
            created: false,
            id: account.id,
            undo: res?.undo,
          };
        }}
        onDelete={data.deleteAccount}
      />

      <BalanceAdjustmentSheet
        open={adjustSheetOpen}
        onOpenChange={setAdjustSheetOpen}
        account={account}
        onAdjust={(_, newBalance, date, notes) => {
          const res = data.adjustBalance(newBalance, date, notes);
          return res ?? { delta: 0 };
        }}
        getBalanceOnDate={data.getBalanceOnDate}
      />

      <ValuationSheet
        open={valuationSheetOpen}
        onOpenChange={setValuationSheetOpen}
        account={account}
        onRecordValuation={data.recordValuation}
        onDeleteValuation={data.deleteValuation}
      />

      <CloseAssetSheet
        open={closeAssetSheetOpen}
        onOpenChange={setCloseAssetSheetOpen}
        account={account}
        accounts={data.accounts}
        onCloseAsset={(accountIdToClose, details) =>
          data.closeAsset?.(accountIdToClose, details)
        }
      />

      <EnableBankingSyncSheet
        open={bankSyncSheetOpen}
        onOpenChange={setBankSyncSheetOpen}
        account={account}
        linkInfo={data.enableBankingLink}
        onTriggerSync={data.triggerBankSync}
      />

      <RecordAccountTxSheet
        open={recordTxMode !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRecordTxMode(null);
        }}
        account={account}
        accounts={data.accounts}
        allCategories={data.allCategories}
        defaultKind={recordTxMode || 'expense'}
        onRecordTx={data.recordAccountTransaction}
        onRecordInterest={data.recordInterestPayment}
        onRecordCardPayment={data.recordCardStatementPayment}
      />
    </div>
  );
};

export default AccountDetailNew;

import React, { useMemo, useState } from 'react';
import { AccountFormSheet } from '../../components/new/accounts/AccountFormSheet';
import { AccountDetailHero } from '../../components/new/accounts/detailHero';
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

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [adjustSheetOpen, setAdjustSheetOpen] = useState(false);
  const [valuationSheetOpen, setValuationSheetOpen] = useState(false);
  const [closeAssetSheetOpen, setCloseAssetSheetOpen] = useState(false);
  const [bankSyncSheetOpen, setBankSyncSheetOpen] = useState(false);
  const [recordTxMode, setRecordTxMode] = useState<
    'expense' | 'income' | 'interest' | 'card_payment' | null
  >(null);

  const pageAction = useMemo(
    () =>
      account
        ? {
            label: 'Record activity',
            icon: 'add' as const,
            onClick: () => setRecordTxMode('expense'),
          }
        : null,
    [account]
  );
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
                variant="cta"
                size="md"
                icon="arrowLeft"
                onClick={() => navigate('/accounts-new')}
              >
                Back to Accounts
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
        onBack={() => navigate('/accounts-new')}
        onEdit={() => setEditSheetOpen(true)}
        onAdjustBalance={() => setAdjustSheetOpen(true)}
        onRecordTx={() => setRecordTxMode('expense')}
        onOpenValuation={() => setValuationSheetOpen(true)}
        onOpenBankSync={
          data.enableBankingLink ? () => setBankSyncSheetOpen(true) : undefined
        }
        onOpenCloseAsset={() => setCloseAssetSheetOpen(true)}
      />

      {/* 2. Specialized Archetype Workspace */}
      {archetype === 'operating' && (
        <OperatingAccountArchetype
          data={data}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {archetype === 'yield_pot' && (
        <YieldPotArchetype
          data={data}
          onLogInterest={() => setRecordTxMode('interest')}
          onEditAccount={() => setEditSheetOpen(true)}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {archetype === 'credit_card' && (
        <CreditCardArchetype
          data={data}
          onPayStatement={() => setRecordTxMode('card_payment')}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {archetype === 'loan' && (
        <LoanArchetype
          data={data}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {archetype === 'physical_asset' && (
        <PhysicalAssetArchetype
          data={data}
          onOpenValuation={() => setValuationSheetOpen(true)}
          onEditAccount={() => setEditSheetOpen(true)}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {/* 3. Shared Account Ledger Activity Section */}
      <AccountActivitySection
        account={account}
        normalizedTransactions={data.normalizedTransactions}
        allCategories={data.allCategories}
        showBalanceAdjustments={data.showBalanceAdjustments}
        onToggleBalanceAdjustments={data.setShowBalanceAdjustments}
        onOpenRecordTx={() => setRecordTxMode('expense')}
        onNavigateToFullTransactions={
          data.navigateToTransactions
            ? () => {
                data.navigateToTransactions?.({ accountName: account.name });
                navigate('/transactions-new');
              }
            : undefined
        }
      />

      {/* 4. Sheets & Drawers */}
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

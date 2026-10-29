import { useCallback, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  Account,
  AssetClosureDetails,
  Currency,
  EnableBankingSyncOptions,
  MileageLog,
  ScheduledPayment,
  Transaction,
} from '../types';
import {
  useAccountsContext,
  usePreferencesContext,
  useTransactionsContext,
} from '../contexts/DomainProviders';
import {
  useCategoryContext,
  useGoalsContext,
  useScheduleContext,
} from '../contexts/FinancialDataContext';
import {
  convertCurrency,
  generateBalanceForecast,
  generateSyntheticCreditCardPayments,
  generateSyntheticLoanPayments,
  generateSyntheticPropertyTransactions,
  normalizeCurrency,
  resolveRates,
  safeRound,
  toLocalISOString,
} from '../utils';
import {
  computeAccount90dSparkline,
  computeAccountDisplayBalance,
  computeBalanceAdjustmentDelta,
} from '../utils/accountsModel';
import {
  computeCashAccountMetrics,
  computeCreditCardAccountMetrics,
  computeLoanAccountMetrics,
  computeOperatingAccountMetrics,
  computePensionAccountMetrics,
  computePropertyAccountMetrics,
  computePropertyHoldingCashflow,
  computeSavingsAccountMetrics,
  computeSpareChangeAccountMetrics,
  computeVehicleAccountMetrics,
  computeVehicleTcoMetrics,
  enrichMileageLogsWithDeltas,
  validateMileageReading,
  findLinkedAssetForLoan,
  findLinkedLoanForAsset,
  applyLoanOverride,
  normalizeAccountTransactions,
  resolveAccountArchetype,
  type AccountArchetypeId,
} from '../utils/accountDetailModel';

/*
 * Data and mutations for `/accounts-new/:id` (UI_UX_DESIGN_REFERENCE.md D6, D13).
 * Connects the active account to all 5 archetype models and provides Undo-wrapped mutations.
 */

export type DetailHorizon = '30D' | '90D' | '180D' | '1Y' | 'ALL';

export const useAccountDetailData = (accountId: string) => {
  const {
    accounts,
    saveAccount: rawSaveAccount,
    deleteAccount: rawDeleteAccount,
    toggleAccountStatus: rawToggleStatus,
    closeAsset: rawCloseAsset,
    revertClosure: rawRevertClosure,
    enableBankingLinkMap,
    triggerEnableBankingSync,
    navigateToTransactions,
  } = useAccountsContext();
  const { transactions, saveTransaction, deleteTransactions } = useTransactionsContext();
  const { preferences } = usePreferencesContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { financialGoals } = useGoalsContext();
  const {
    recurringTransactions,
    recurringTransactionOverrides,
    loanPaymentOverrides,
    billsAndPayments,
    saveLoanPaymentOverrides,
  } = useScheduleContext();

  const [showBalanceAdjustments, setShowBalanceAdjustments] = useState(true);
  const [forecastDays, setForecastDays] = useState<30 | 90 | 180 | 365>(90);

  const displayCurrency = normalizeCurrency(preferences.displayCurrency || preferences.currency || 'EUR');
  const conversionRates = useMemo(() => resolveRates(preferences.conversionRates), [preferences.conversionRates]);
  const allCategories = useMemo(
    () => [...incomeCategories, ...expenseCategories],
    [incomeCategories, expenseCategories]
  );

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId]
  );

  const archetype: AccountArchetypeId = useMemo(
    () => (account ? resolveAccountArchetype(account) : 'operating'),
    [account]
  );

  const accountTransactions = useMemo(
    () => transactions.filter((t) => t.accountId === accountId),
    [transactions, accountId]
  );

  const detailOptions = useMemo(
    () => ({
      showBalanceAdjustments,
      conversionRates,
      rates: conversionRates as Record<string, number> | undefined,
    }),
    [showBalanceAdjustments, conversionRates]
  );

  const normalizedTransactions = useMemo(() => {
    if (!account) return [];
    return normalizeAccountTransactions(accountTransactions, account.currency, detailOptions).sort(
      (a, b) => b.dateStr.localeCompare(a.dateStr)
    );
  }, [account, accountTransactions, detailOptions]);

  const displayBalance = useMemo(() => {
    if (!account) return 0;
    return computeAccountDisplayBalance(account, accountTransactions, loanPaymentOverrides, {
      conversionRates,
    });
  }, [account, accountTransactions, loanPaymentOverrides, conversionRates]);

  // The display balance is already today's balance (future-dated items excluded).
  const realTodayBalance = displayBalance;

  // In the account's own currency, so the chart's labels and forecast line up with it.
  const sparkline90d = useMemo(() => {
    if (!account) return { sparklineData: [], trend: 0, trendPct: null, isPositiveTrend: true };
    return computeAccount90dSparkline(account, accountTransactions, displayBalance, {
      conversionRates,
      loanPaymentOverrides,
    });
  }, [account, accountTransactions, displayBalance, conversionRates, loanPaymentOverrides]);

  const convertToDisplay = useCallback(
    (amount: number, fromCurrency?: Currency) =>
      convertCurrency(
        amount,
        fromCurrency || account?.currency || 'EUR',
        displayCurrency,
        conversionRates
      ),
    [account?.currency, displayCurrency, conversionRates]
  );

  // Forward Balance Forecast (for Trajectory Chart)
  const forecastSeries = useMemo(() => {
    if (!account) return { points: [], lowestPoint: { date: '', value: 0 }, endValue: 0 };
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + forecastDays);
    const syntheticLoans = generateSyntheticLoanPayments(accounts, transactions, loanPaymentOverrides);
    const syntheticCC = generateSyntheticCreditCardPayments(accounts, transactions);
    const syntheticProp = generateSyntheticPropertyTransactions(accounts);
    const allRecurring = [
      ...recurringTransactions,
      ...syntheticLoans,
      ...syntheticCC,
      ...syntheticProp,
    ];
    const accountForForecast = { ...account, balance: realTodayBalance };
    const { chartData, lowestPoint } = generateBalanceForecast(
      [accountForForecast],
      allRecurring,
      financialGoals,
      billsAndPayments,
      endDate,
      recurringTransactionOverrides
    );
    const points = chartData.map((pt) => ({
      date: pt.date,
      value: safeRound(
        convertCurrency(pt.value, 'EUR', account.currency, conversionRates),
        2
      ),
    }));
    const lowestNative = {
      date: lowestPoint.date,
      value: safeRound(
        convertCurrency(lowestPoint.value, 'EUR', account.currency, conversionRates),
        2
      ),
    };
    return {
      points,
      lowestPoint: lowestNative,
      endValue: points[points.length - 1]?.value ?? realTodayBalance,
    };
  }, [
    account,
    forecastDays,
    accounts,
    transactions,
    loanPaymentOverrides,
    recurringTransactions,
    financialGoals,
    billsAndPayments,
    recurringTransactionOverrides,
    realTodayBalance,
    conversionRates,
  ]);

  // Archetype 1: Operating & Cash Metrics
  const operatingMetrics = useMemo(() => {
    if (!account) return null;
    if (archetype !== 'operating') return null;
    return computeOperatingAccountMetrics(account, accounts, transactions, {
      ...detailOptions,
      recurringTransactions,
      recurringTransactionOverrides,
      billsAndPayments,
      financialGoals,
      loanPaymentOverrides,
      allCategories,
    });
  }, [
    account,
    archetype,
    accounts,
    transactions,
    detailOptions,
    recurringTransactions,
    recurringTransactionOverrides,
    billsAndPayments,
    financialGoals,
    loanPaymentOverrides,
    allCategories,
  ]);

  const cashMetrics = useMemo(() => {
    if (!account) return null;
    if (archetype !== 'operating') return null;
    return computeCashAccountMetrics(account, accountTransactions, detailOptions);
  }, [account, archetype, accountTransactions, detailOptions]);

  // Archetype 2: Yield & Accumulation Metrics (`Savings`, `Pension Fund`, `Spare Change`)
  const savingsMetrics = useMemo(() => {
    if (!account || account.type !== 'Savings') return null;
    return computeSavingsAccountMetrics(account, accountTransactions, allCategories, detailOptions);
  }, [account, accountTransactions, allCategories, detailOptions]);

  const pensionMetrics = useMemo(() => {
    if (!account || !(account.type === 'Investment' && account.subType === 'Pension Fund')) return null;
    return computePensionAccountMetrics(account, accountTransactions, detailOptions);
  }, [account, accountTransactions, detailOptions]);

  const spareChangeMetrics = useMemo(() => {
    if (!account || !(account.type === 'Investment' && account.subType === 'Spare Change')) return null;
    return computeSpareChangeAccountMetrics(
      account,
      accounts,
      accountTransactions,
      detailOptions
    );
  }, [account, accounts, accountTransactions, detailOptions]);

  // Archetype 3: Revolving Credit Card Metrics
  const creditCardMetrics = useMemo(() => {
    if (!account || account.type !== 'Credit Card') return null;
    return computeCreditCardAccountMetrics(account, accountTransactions, detailOptions);
  }, [account, accountTransactions, detailOptions]);

  // Archetype 4: Loan & Lending Metrics
  const loanMetrics = useMemo(() => {
    if (!account || (account.type !== 'Loan' && account.type !== 'Lending')) return null;
    const overrides = loanPaymentOverrides[account.id] || {};
    return computeLoanAccountMetrics(account, accounts, accountTransactions, overrides, detailOptions);
  }, [account, accounts, accountTransactions, loanPaymentOverrides, detailOptions]);

  // Archetype 5: Physical Asset Metrics (`Property`, `Vehicle`)
  const propertyMetrics = useMemo(() => {
    if (!account || account.type !== 'Property') return null;
    return computePropertyAccountMetrics(
      account,
      accounts,
      transactions,
      loanPaymentOverrides,
      detailOptions
    );
  }, [account, accounts, transactions, loanPaymentOverrides, detailOptions]);

  const propertyCashflow = useMemo(() => {
    if (!account || account.type !== 'Property') return null;
    return computePropertyHoldingCashflow(account);
  }, [account]);

  const vehicleMetrics = useMemo(() => {
    if (!account || account.type !== 'Vehicle') return null;
    return computeVehicleAccountMetrics(
      account,
      accounts,
      transactions,
      loanPaymentOverrides,
      detailOptions
    );
  }, [account, accounts, transactions, loanPaymentOverrides, detailOptions]);

  const vehicleTco = useMemo(() => {
    if (!account || account.type !== 'Vehicle') return null;
    return computeVehicleTcoMetrics(account, transactions, { ...detailOptions, allAccounts: accounts });
  }, [account, accounts, transactions, detailOptions]);

  const enrichedMileageLogs = useMemo(() => {
    if (!account || account.type !== 'Vehicle') return [];
    return enrichMileageLogsWithDeltas(account.mileageLogs || []);
  }, [account]);

  const linkedLoan = useMemo(
    () => (account ? findLinkedLoanForAsset(account, accounts) : undefined),
    [account, accounts]
  );

  const linkedAsset = useMemo(
    () => (account ? findLinkedAssetForLoan(account, accounts) : undefined),
    [account, accounts]
  );

  const enableBankingLink = useMemo(
    () => (account && enableBankingLinkMap ? enableBankingLinkMap.get(account.id) : undefined),
    [account, enableBankingLinkMap]
  );

  // Mutations with Undo support
  const updateAccount = useCallback(
    (patch: Partial<Account>): { undo: () => void } | null => {
      if (!account) return null;
      const snapshot = { ...account };
      rawSaveAccount({ ...account, ...patch, id: account.id });
      return {
        undo: () => rawSaveAccount(snapshot),
      };
    },
    [account, rawSaveAccount]
  );

  /** Balance of `account` on `dateStr`, for the reconcile sheet; null for amortised loans. */
  const getBalanceOnDate = useCallback(
    (account: Account, dateStr: string): number | null => {
      const delta = computeBalanceAdjustmentDelta(account, accountTransactions, 0, dateStr, conversionRates as Record<string, number> | undefined);
      return delta === null ? null : -delta;
    },
    [accountTransactions, conversionRates]
  );

  const adjustBalance = useCallback(
    (
      targetBalance: number,
      dateStr?: string,
      note?: string
    ): { delta: number; undo?: () => void; unsupported?: boolean } => {
      if (!account) return { delta: 0 };
      const delta = computeBalanceAdjustmentDelta(
        account,
        accountTransactions,
        targetBalance,
        dateStr,
        conversionRates as Record<string, number> | undefined
      );
      if (delta === null) return { delta: 0, unsupported: true };
      if (Math.abs(delta) < 0.000001) return { delta: 0 };
      const txId = `txn-adj-${uuidv4()}`;
      saveTransaction(
        [
          {
            id: txId,
            accountId: account.id,
            date: dateStr || toLocalISOString(new Date()),
            description: note?.trim() || 'Manual Balance Reconciliation',
            merchant: 'Balance Adjustment',
            amount: delta,
            category: 'Balance Adjustment',
            type: delta >= 0 ? 'income' : 'expense',
            currency: account.currency,
            isBalanceAdjustment: true,
          },
        ],
        [],
        { skipRules: true }
      );
      return {
        delta,
        undo: () => deleteTransactions([txId]),
      };
    },
    [account, accountTransactions, conversionRates, saveTransaction, deleteTransactions]
  );

  const recordInterestPayment = useCallback(
    (amount: number, dateStr?: string, description?: string): { undo: () => void } | null => {
      if (!account || amount <= 0) return null;
      const txId = `txn-int-${uuidv4()}`;
      saveTransaction(
        [
          {
            id: txId,
            accountId: account.id,
            date: dateStr || toLocalISOString(new Date()),
            description: description?.trim() || 'Interest Payout',
            merchant: account.financialInstitution || account.name,
            amount: Math.abs(amount),
            category: 'Interest',
            type: 'income',
            currency: account.currency,
          },
        ],
        [],
        { skipRules: true }
      );
      return {
        undo: () => deleteTransactions([txId]),
      };
    },
    [account, saveTransaction, deleteTransactions]
  );

  const recordCardStatementPayment = useCallback(
    (
      amount: number,
      fromAccountId?: string,
      dateStr?: string
    ): { undo: () => void } | null => {
      if (!account || amount <= 0) return null;
      // A missing source account would leave the card leg with a transfer id and no partner.
      const sourceAcc = fromAccountId ? accounts.find((a) => a.id === fromAccountId) : undefined;
      if (fromAccountId && !sourceAcc) return null;
      const effectiveDate = dateStr || toLocalISOString(new Date());
      const transferId = `cc-pay-${uuidv4()}`;
      const creditTxId = `txn-${uuidv4()}`;
      const txsToCreate: (Omit<Transaction, 'id'> & { id?: string })[] = [
        {
          id: creditTxId,
          accountId: account.id,
          date: effectiveDate,
          description: `Statement Payment — ${account.name}`,
          merchant: account.financialInstitution || account.name,
          amount: Math.abs(amount),
          category: 'Transfer',
          type: 'income',
          currency: account.currency,
          transferId: fromAccountId ? transferId : undefined,
        },
      ];
      const createdIds = [creditTxId];
      if (fromAccountId) {
        if (sourceAcc) {
          const debitTxId = `txn-${uuidv4()}`;
          createdIds.push(debitTxId);
          const sourceAmt = convertCurrency(
            Math.abs(amount),
            account.currency,
            sourceAcc.currency,
            conversionRates
          );
          txsToCreate.push({
            id: debitTxId,
            accountId: sourceAcc.id,
            date: effectiveDate,
            description: `Credit Card Payment to ${account.name}`,
            merchant: account.name,
            amount: -safeRound(sourceAmt, 2),
            category: 'Transfer',
            type: 'expense',
            currency: sourceAcc.currency,
            transferId,
          });
        }
      }
      saveTransaction(txsToCreate, [], { skipRules: true });
      return {
        undo: () => deleteTransactions(createdIds),
      };
    },
    [account, accounts, conversionRates, saveTransaction, deleteTransactions]
  );

  const recordValuation = useCallback(
    (price: number, dateStr?: string): { undo: () => void } | null => {
      if (!account) return null;
      const snapshot = {
        ...account,
        priceHistory: account.priceHistory ? [...account.priceHistory] : undefined,
      };
      const targetDate = dateStr || toLocalISOString(new Date());
      const nextHistory = account.priceHistory ? [...account.priceHistory] : [];
      const existingIdx = nextHistory.findIndex((p) => p.date === targetDate);
      if (existingIdx >= 0) {
        nextHistory[existingIdx] = { date: targetDate, price };
      } else {
        nextHistory.push({ date: targetDate, price });
      }
      nextHistory.sort((a, b) => a.date.localeCompare(b.date));
      const latest = nextHistory[nextHistory.length - 1];
      rawSaveAccount({
        ...account,
        priceHistory: nextHistory,
        balance: latest ? latest.price : price,
      });
      return {
        undo: () => rawSaveAccount(snapshot),
      };
    },
    [account, rawSaveAccount]
  );

  const deleteValuation = useCallback(
    (dateStr: string): { undo: () => void } | null => {
      if (!account || !account.priceHistory) return null;
      const snapshot = {
        ...account,
        priceHistory: [...account.priceHistory],
      };
      const nextHistory = account.priceHistory
        .filter((p) => p.date !== dateStr)
        .sort((a, b) => a.date.localeCompare(b.date));
      const latest = nextHistory[nextHistory.length - 1];
      rawSaveAccount({
        ...account,
        priceHistory: nextHistory,
        balance: latest ? latest.price : account.purchasePrice || account.balance,
      });
      return {
        undo: () => rawSaveAccount(snapshot),
      };
    },
    [account, rawSaveAccount]
  );

  const addMileageLogs = useCallback(
    (
      entries: Array<{ date: string; reading: number }>
    ): {
      undo?: () => void;
      added: number;
      conflicts: Array<{ date: string; reading: number; error: string }>;
    } | null => {
      if (!account || entries.length === 0) return null;
      const snapshot = {
        ...account,
        mileageLogs: account.mileageLogs ? [...account.mileageLogs] : undefined,
      };
      const mapByDate = new Map<string, MileageLog>();
      for (const item of account.mileageLogs || []) {
        mapByDate.set(item.date, item);
      }
      // Each entry is checked against everything merged so far. A different reading on a date
      // that already has one is a conflict, not a silent overwrite.
      const conflicts: Array<{ date: string; reading: number; error: string }> = [];
      let added = 0;
      for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
        const reading = Math.round(entry.reading);
        const existing = mapByDate.get(entry.date);
        if (existing) {
          if (existing.reading !== reading) {
            conflicts.push({
              date: entry.date,
              reading,
              error: `${entry.date} already has ${existing.reading.toLocaleString()} km`,
            });
          }
          continue;
        }
        const check = validateMileageReading(Array.from(mapByDate.values()), entry.date, reading);
        if (!check.valid) {
          conflicts.push({ date: entry.date, reading, error: check.error || 'Out of order' });
          continue;
        }
        mapByDate.set(entry.date, { id: `ml-${uuidv4()}`, date: entry.date, reading });
        added++;
      }
      if (added === 0) return { added, conflicts };
      const merged = Array.from(mapByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
      rawSaveAccount({
        ...account,
        mileageLogs: merged,
      });
      return {
        added,
        conflicts,
        undo: () => rawSaveAccount(snapshot),
      };
    },
    [account, rawSaveAccount]
  );

  const deleteMileageLog = useCallback(
    (logId: string): { undo: () => void } | null => {
      if (!account || !account.mileageLogs) return null;
      const snapshot = {
        ...account,
        mileageLogs: [...account.mileageLogs],
      };
      const filtered = account.mileageLogs.filter((l) => l.id !== logId);
      rawSaveAccount({
        ...account,
        mileageLogs: filtered,
      });
      return {
        undo: () => rawSaveAccount(snapshot),
      };
    },
    [account, rawSaveAccount]
  );

  const saveLoanInstallmentOverride = useCallback(
    (
      paymentNumber: number,
      override: Partial<ScheduledPayment> | null
    ): { undo: () => void } | null => {
      if (!account) return null;
      const currentOverrides = loanPaymentOverrides[account.id] || {};
      const previousOverrides = { ...currentOverrides };
      const nextOverrides = { ...currentOverrides };
      if (override === null) {
        delete nextOverrides[paymentNumber];
      } else {
        nextOverrides[paymentNumber] = {
          ...nextOverrides[paymentNumber],
          ...override,
        };
      }
      saveLoanPaymentOverrides(account.id, nextOverrides);
      return {
        undo: () => saveLoanPaymentOverrides(account.id, previousOverrides),
      };
    },
    [account, loanPaymentOverrides, saveLoanPaymentOverrides]
  );

  /** One change to one installment (see `applyLoanOverride`), with an undo. */
  const updateLoanInstallment = useCallback(
    (paymentNumber: number, patch: Partial<ScheduledPayment> | 'clear'): { undo: () => void } | null => {
      if (!account) return null;
      const previous = loanPaymentOverrides[account.id] || {};
      saveLoanPaymentOverrides(account.id, applyLoanOverride(previous, paymentNumber, patch));
      return { undo: () => saveLoanPaymentOverrides(account.id, previous) };
    },
    [account, loanPaymentOverrides, saveLoanPaymentOverrides]
  );

  /** Drops every change to the payment plan, with an undo. */
  const resetLoanInstallments = useCallback((): { undo: () => void } | null => {
    if (!account) return null;
    const previous = loanPaymentOverrides[account.id] || {};
    saveLoanPaymentOverrides(account.id, {});
    return { undo: () => saveLoanPaymentOverrides(account.id, previous) };
  }, [account, loanPaymentOverrides, saveLoanPaymentOverrides]);

  const recordAccountTransaction = useCallback(
    (draft: {
      date: string;
      description: string;
      merchant?: string;
      amount: number;
      category: string;
      type: 'income' | 'expense';
      principalAmount?: number;
      interestAmount?: number;
    }): { undo: () => void } | null => {
      if (!account) return null;
      const txId = `txn-${uuidv4()}`;
      const signedAmount =
        draft.type === 'income' ? Math.abs(draft.amount) : -Math.abs(draft.amount);
      saveTransaction(
        [
          {
            id: txId,
            accountId: account.id,
            date: draft.date,
            description: draft.description,
            merchant: draft.merchant || draft.description,
            amount: signedAmount,
            category: draft.category,
            type: draft.type,
            currency: account.currency,
            principalAmount: draft.principalAmount,
            interestAmount: draft.interestAmount,
          },
        ],
        [],
        { skipRules: true }
      );
      return {
        undo: () => deleteTransactions([txId]),
      };
    },
    [account, saveTransaction, deleteTransactions]
  );

  const triggerBankSync = useCallback(
    async (syncOptions?: EnableBankingSyncOptions) => {
      if (!enableBankingLink || !triggerEnableBankingSync) return;
      await triggerEnableBankingSync(
        enableBankingLink.connection.id,
        enableBankingLink.connection,
        {
          ...syncOptions,
          targetAccountIds: [enableBankingLink.account.id],
        }
      );
    },
    [enableBankingLink, triggerEnableBankingSync]
  );

  return {
    account,
    accounts,
    archetype,
    displayCurrency,
    conversionRates,
    convertToDisplay,
    showBalanceAdjustments,
    setShowBalanceAdjustments,
    forecastDays,
    setForecastDays,
    accountTransactions,
    normalizedTransactions,
    displayBalance,
    realTodayBalance,
    sparkline90d,
    forecastSeries,
    operatingMetrics,
    cashMetrics,
    savingsMetrics,
    pensionMetrics,
    spareChangeMetrics,
    creditCardMetrics,
    loanMetrics,
    propertyMetrics,
    propertyCashflow,
    vehicleMetrics,
    vehicleTco,
    enrichedMileageLogs,
    linkedLoan,
    linkedAsset,
    enableBankingLink,
    financialGoals,
    loanPaymentOverrides: account ? loanPaymentOverrides[account.id] || {} : {},
    brandfetchClientId: (preferences.brandfetchClientId || '').trim(),
    merchantLogoOverrides: preferences.merchantLogoOverrides || {},
    allCategories,
    updateAccount,
    adjustBalance,
    getBalanceOnDate,
    recordInterestPayment,
    recordCardStatementPayment,
    recordValuation,
    deleteValuation,
    addMileageLogs,
    deleteMileageLog,
    saveLoanInstallmentOverride,
    updateLoanInstallment,
    resetLoanInstallments,
    recordAccountTransaction,
    triggerBankSync,
    deleteAccount: rawDeleteAccount,
    toggleAccountStatus: rawToggleStatus,
    closeAsset: rawCloseAsset,
    revertClosure: rawRevertClosure,
    navigateToTransactions,
  };
};

export type AccountDetailData = ReturnType<typeof useAccountDetailData>;

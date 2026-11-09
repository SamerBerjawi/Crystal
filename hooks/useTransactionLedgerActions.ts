import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type { Category, DisplayTransaction, RecurringTransaction, Tag, Transaction } from '../types';
import { arrayToCSV, downloadCSV, safeRound, toLocalISOString } from '../utils';
import type { MenuAction } from '../components/ui/Menu';

interface UseTransactionLedgerActionsParams {
  transactions: Transaction[];
  displayTransactions: DisplayTransaction[];
  filteredTransactions: DisplayTransaction[];
  allCategories: Category[];
  tags: Tag[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  transactionById: Map<string, Transaction>;
  transactionsByTransferId: Map<string, Transaction[]>;
  childrenByParentId: Map<string, Transaction[]>;
  saveTransaction: (
    transactionsToSave: (Omit<Transaction, 'id'> & { id?: string })[],
    idsToDelete?: string[],
    options?: { skipRules?: boolean },
  ) => void;
  deleteTransactions: (ids: string[]) => void;
  resolveTransferDisplay: (tx: DisplayTransaction) => { amount: number; currency: DisplayTransaction['currency'] };
  setExpandedParentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setIsSplitModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionToSplit: React.Dispatch<React.SetStateAction<Transaction | null>>;
  setIsCombineModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionsToCombine: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setIsCategorizeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBulkEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDeleteConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingTransaction: React.Dispatch<React.SetStateAction<Transaction | null>>;
  setDuplicateData: React.Dispatch<React.SetStateAction<any>>;
  setTransactionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOverviewTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setIsOverviewModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionToMakeRecurring: React.Dispatch<React.SetStateAction<(Omit<RecurringTransaction, 'id'> & { id?: string }) | null>>;
  setIsRecurringModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function findCategoryByName(name: string, categories: Category[]): Category | undefined {
  for (const cat of categories) {
    if (cat.name === name) return cat;
    if (cat.subCategories && cat.subCategories.length > 0) {
      const found = findCategoryByName(name, cat.subCategories);
      if (found) return found;
    }
  }
  return undefined;
}

export function useTransactionLedgerActions({
  transactions,
  displayTransactions,
  filteredTransactions,
  allCategories,
  tags,
  selectedIds,
  setSelectedIds,
  transactionById,
  transactionsByTransferId,
  childrenByParentId,
  saveTransaction,
  deleteTransactions,
  resolveTransferDisplay,
  setExpandedParentIds,
  setIsSplitModalOpen,
  setTransactionToSplit,
  setIsCombineModalOpen,
  setTransactionsToCombine,
  setIsCategorizeModalOpen,
  setBulkEditModalOpen,
  setIsDeleteConfirmOpen,
  setEditingTransaction,
  setDuplicateData,
  setTransactionModalOpen,
  setOverviewTransactions,
  setIsOverviewModalOpen,
  setTransactionToMakeRecurring,
  setIsRecurringModalOpen,
}: UseTransactionLedgerActionsParams) {
  const selectedTransactions = useMemo(() => {
    const resolved: Transaction[] = [];
    const seen = new Set<string>();
    selectedIds.forEach(id => {
      const tx = id.startsWith('transfer-')
        ? (transactionsByTransferId.get(id.replace('transfer-', '')) ?? []).find(t => t.type === 'expense')
        : transactionById.get(id);
      if (tx && !seen.has(tx.id)) {
        seen.add(tx.id);
        resolved.push(tx);
      }
    });
    return resolved;
  }, [selectedIds, transactionById, transactionsByTransferId]);

  const canCombine = useMemo(() => {
    if (selectedTransactions.length < 2) return false;
    const accountIds = new Set(selectedTransactions.map(t => t.accountId));
    if (accountIds.size !== 1) return false;
    return !selectedTransactions.some(t => t.transferId || t.isSplitParent || t.isCombinedParent || t.parentTransactionId);
  }, [selectedTransactions]);

  const canSplit = useMemo(() => {
    if (selectedTransactions.length !== 1) return false;
    const tx = selectedTransactions[0];
    return !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.parentTransactionId;
  }, [selectedTransactions]);

  const canUnsplit = useMemo(() => {
    if (selectedTransactions.length !== 1) return false;
    const tx = selectedTransactions[0];
    if (tx.isSplitParent) return true;
    if (tx.parentTransactionId) {
      const parent = transactionById.get(tx.parentTransactionId);
      return Boolean(parent?.isSplitParent);
    }
    return false;
  }, [selectedTransactions, transactionById]);

  const canUncombine = useMemo(() => {
    if (selectedTransactions.length !== 1) return false;
    const tx = selectedTransactions[0];
    if (tx.isCombinedParent) return true;
    if (tx.parentTransactionId) {
      const parent = transactionById.get(tx.parentTransactionId);
      return Boolean(parent?.isCombinedParent);
    }
    return false;
  }, [selectedTransactions, transactionById]);

  const handleOpenCategorizeModal = useCallback(() => {
    setIsCategorizeModalOpen(true);
  }, [setIsCategorizeModalOpen]);

  const handleOpenCombineModal = useCallback(() => {
    if (!canCombine) return;
    setTransactionsToCombine(selectedTransactions);
    setIsCombineModalOpen(true);
  }, [canCombine, selectedTransactions, setTransactionsToCombine, setIsCombineModalOpen]);

  const handleOpenSplitModal = useCallback(() => {
    if (selectedIds.size !== 1) return;
    const selectedId = Array.from(selectedIds)[0];
    const displayTx = displayTransactions.find(tx => tx.id === selectedId);
    if (!displayTx || displayTx.isTransfer) return;

    const original = transactionById.get(displayTx.id);
    if (original) {
      setTransactionToSplit(original);
      setIsSplitModalOpen(true);
    }
  }, [selectedIds, displayTransactions, transactionById, setTransactionToSplit, setIsSplitModalOpen]);

  const handleSaveSplits = useCallback((updatedParent: Transaction, subTransactions: Transaction[]) => {
    saveTransaction([updatedParent, ...subTransactions], []);
    setExpandedParentIds(prev => new Set(prev).add(updatedParent.id));
    setIsSplitModalOpen(false);
    setTransactionToSplit(null);
    setSelectedIds(new Set());
  }, [saveTransaction, setExpandedParentIds, setIsSplitModalOpen, setTransactionToSplit, setSelectedIds]);

  const handleSaveCombine = useCallback((combinedParent: Transaction, updatedSubTransactions: Transaction[]) => {
    saveTransaction([combinedParent, ...updatedSubTransactions], []);
    setExpandedParentIds(prev => new Set(prev).add(combinedParent.id));
    setIsCombineModalOpen(false);
    setTransactionsToCombine([]);
    setSelectedIds(new Set());
  }, [saveTransaction, setExpandedParentIds, setIsCombineModalOpen, setTransactionsToCombine, setSelectedIds]);

  const handleUnsplit = useCallback((targetTx?: DisplayTransaction) => {
    let tx = targetTx;
    if (!tx) {
      if (selectedIds.size !== 1) return;
      const selectedId = Array.from(selectedIds)[0];
      tx = displayTransactions.find(t => t.id === selectedId);
    }
    if (!tx) return;

    const parentId = tx.parentTransactionId || tx.id;
    const parentObj = transactionById.get(parentId);
    if (!parentObj || !parentObj.isSplitParent) return;

    const childSubTxs = childrenByParentId.get(parentId) ?? [];
    const childIds = childSubTxs.map(t => t.id);

    const updatedParent: Transaction = {
      ...parentObj,
      isSplitParent: false,
    };

    saveTransaction([updatedParent], childIds);
    setSelectedIds(new Set());
  }, [selectedIds, displayTransactions, transactionById, childrenByParentId, saveTransaction, setSelectedIds]);

  const handleUncombine = useCallback((targetTx?: DisplayTransaction) => {
    let tx = targetTx;
    if (!tx) {
      if (selectedIds.size !== 1) return;
      const selectedId = Array.from(selectedIds)[0];
      tx = displayTransactions.find(t => t.id === selectedId);
    }
    if (!tx) return;

    const parentId = tx.parentTransactionId || tx.id;
    const parentObj = transactionById.get(parentId);
    if (!parentObj || !parentObj.isCombinedParent) return;

    const childSubTxs = childrenByParentId.get(parentId) ?? [];
    const updatedChildren: Transaction[] = childSubTxs.map(c => ({
      ...c,
      parentTransactionId: undefined,
    }));

    saveTransaction(updatedChildren, [parentId]);
    setSelectedIds(new Set());
  }, [selectedIds, displayTransactions, transactionById, childrenByParentId, saveTransaction, setSelectedIds]);

  const handleSaveBulkCategory = useCallback((newCategoryName: string) => {
    const transactionUpdates: (Omit<Transaction, 'id'> & { id: string })[] = [];
    const idsToDelete: string[] = [];

    const categoryDetails = findCategoryByName(newCategoryName, allCategories);
    if (!categoryDetails) {
      console.error('Could not find details for new category:', newCategoryName);
      toast.error(`Category "${newCategoryName}" could not be found.`);
      return;
    }

    const newType = categoryDetails.classification || 'expense';

    for (const selectedId of selectedIds) {
      if (selectedId.startsWith('transfer-')) {
        const transferId = selectedId.replace('transfer-', '');
        const pairList = transactionsByTransferId.get(transferId) ?? [];
        const pairExpense = pairList.find(t => t.type === 'expense');
        const pairIncome = pairList.find(t => t.type === 'income');

        if (newType === 'income' && pairIncome) {
          transactionUpdates.push({
            ...pairIncome,
            category: newCategoryName,
            type: 'income',
            amount: Math.abs(pairIncome.amount),
            transferId: undefined,
          });
          if (pairExpense) idsToDelete.push(pairExpense.id);
        } else if (pairExpense) {
          transactionUpdates.push({
            ...pairExpense,
            category: newCategoryName,
            type: 'expense',
            amount: -Math.abs(pairExpense.amount),
            transferId: undefined,
          });
          if (pairIncome) idsToDelete.push(pairIncome.id);
        }
      } else {
        const originalTx = transactionById.get(selectedId);
        if (originalTx) {
          if (originalTx.transferId) {
            const pairList = transactionsByTransferId.get(originalTx.transferId) ?? [];
            const pairExpense = pairList.find(t => t.type === 'expense');
            const pairIncome = pairList.find(t => t.type === 'income');

            if (newType === 'income' && pairIncome) {
              transactionUpdates.push({
                ...pairIncome,
                category: newCategoryName,
                type: 'income',
                amount: Math.abs(pairIncome.amount),
                transferId: undefined,
              });
              if (pairExpense && !idsToDelete.includes(pairExpense.id)) idsToDelete.push(pairExpense.id);
            } else if (pairExpense) {
              transactionUpdates.push({
                ...pairExpense,
                category: newCategoryName,
                type: 'expense',
                amount: -Math.abs(pairExpense.amount),
                transferId: undefined,
              });
              if (pairIncome && !idsToDelete.includes(pairIncome.id)) idsToDelete.push(pairIncome.id);
            }
          } else {
            const newAmount = newType === 'income' ? Math.abs(originalTx.amount) : -Math.abs(originalTx.amount);
            transactionUpdates.push({
              ...originalTx,
              category: newCategoryName,
              type: newType,
              amount: newAmount,
            });
          }
        }
      }
    }

    if (transactionUpdates.length > 0) {
      saveTransaction(transactionUpdates, idsToDelete, { skipRules: true });
      toast.success(`Updated category for ${transactionUpdates.length} transaction${transactionUpdates.length !== 1 ? 's' : ''}`);
    }

    setIsCategorizeModalOpen(false);
    setSelectedIds(new Set());
  }, [allCategories, selectedIds, transactionsByTransferId, transactionById, saveTransaction, setIsCategorizeModalOpen, setSelectedIds]);

  const handleSaveBulkEdits = useCallback((updatedTransactions: Transaction[], idsToDelete: string[] = []) => {
    saveTransaction(updatedTransactions, idsToDelete, { skipRules: true });
    setBulkEditModalOpen(false);
    setSelectedIds(new Set());
    toast.success(`Updated ${updatedTransactions.length} transaction${updatedTransactions.length !== 1 ? 's' : ''}`);
  }, [saveTransaction, setBulkEditModalOpen, setSelectedIds]);

  const handleOpenDeleteModal = useCallback(() => {
    setIsDeleteConfirmOpen(true);
  }, [setIsDeleteConfirmOpen]);

  const handleConfirmBulkDelete = useCallback(() => {
    const idsSet = new Set<string>();
    selectedIds.forEach((id: string) => {
      if (id.startsWith('transfer-')) {
        const transferId = id.replace('transfer-', '');
        (transactionsByTransferId.get(transferId) ?? []).forEach(p => idsSet.add(p.id));
      } else {
        idsSet.add(id);
        (childrenByParentId.get(id) ?? []).forEach(child => idsSet.add(child.id));
      }
    });

    const idsToDelete = Array.from(idsSet);
    if (idsToDelete.length > 0) {
      deleteTransactions(idsToDelete);
    }

    setIsDeleteConfirmOpen(false);
    setSelectedIds(new Set());
  }, [selectedIds, transactionsByTransferId, childrenByParentId, deleteTransactions, setIsDeleteConfirmOpen, setSelectedIds]);

  const handleOpenAddModal = useCallback(() => {
    setEditingTransaction(null);
    setDuplicateData(null);
    setTransactionModalOpen(true);
  }, [setEditingTransaction, setDuplicateData, setTransactionModalOpen]);

  const handleCloseModal = useCallback(() => {
    setTransactionModalOpen(false);
    setEditingTransaction(null);
    setDuplicateData(null);
  }, [setTransactionModalOpen, setEditingTransaction, setDuplicateData]);

  const handleDuplicate = useCallback((tx: DisplayTransaction) => {
    const lookupId = tx.isTransfer ? (tx.originalId || tx.id) : tx.id;
    const original = transactionById.get(lookupId);
    if (!original) return;

    let initialFromAccountId: string | undefined = original.accountId;
    let initialToAccountId: string | undefined = undefined;
    let initialType: 'expense' | 'income' | 'transfer' = original.type as any;

    if (tx.isTransfer && original.transferId) {
      initialType = 'transfer';
      const incomePart = (transactionsByTransferId.get(original.transferId) ?? []).find(t => t.id !== original.id);
      if (incomePart) {
        initialToAccountId = incomePart.accountId;
      }
    } else if (original.type === 'income') {
      initialToAccountId = original.accountId;
      initialFromAccountId = undefined;
    }

    setDuplicateData({
      initialType,
      initialFromAccountId,
      initialToAccountId,
      initialCategory: original.category,
      initialDetails: {
        date: original.date,
        amount: safeRound(Math.abs(original.amount), 2).toFixed(2),
        description: original.description,
        merchant: original.merchant,
        tagIds: original.tagIds,
        locationString: [original.city, original.country].filter(Boolean).join(', '),
        locationData: {
          city: original.city,
          country: original.country,
          lat: original.latitude,
          lon: original.longitude,
        },
      },
    });
    setEditingTransaction(null);
    setTransactionModalOpen(true);
  }, [transactionById, transactionsByTransferId, setDuplicateData, setEditingTransaction, setTransactionModalOpen]);

  const handleOpenOverview = useCallback((tx: DisplayTransaction | Transaction) => {
    const targetId = ('isTransfer' in tx && tx.isTransfer) ? ((tx as any).originalId || tx.id) : tx.id;
    const originalTx = transactionById.get(targetId) || (tx as Transaction);
    if (originalTx?.transferId) {
      const pair = transactionsByTransferId.get(originalTx.transferId) ?? [];
      setOverviewTransactions(pair.length > 0 ? pair : [originalTx]);
    } else if (originalTx) {
      setOverviewTransactions([originalTx]);
    }
    setIsOverviewModalOpen(true);
  }, [transactionById, transactionsByTransferId, setOverviewTransactions, setIsOverviewModalOpen]);

  const handleMakeRecurring = useCallback((txToConvert?: DisplayTransaction) => {
    let displayTx: DisplayTransaction | undefined = txToConvert;

    if (!displayTx) {
      if (selectedIds.size !== 1) return;
      const selectedId = Array.from(selectedIds)[0];
      displayTx = displayTransactions.find(tx => tx.id === selectedId);
    }

    if (!displayTx) return;

    let transaction: Transaction | undefined;
    let toAccountId: string | undefined;
    let type: 'income' | 'expense' | 'transfer';

    if (displayTx.isTransfer && displayTx.transferId) {
      const pair = transactionsByTransferId.get(displayTx.transferId) ?? [];
      const expensePart = pair.find(t => t.type === 'expense');
      const incomePart = pair.find(t => t.type === 'income');

      if (!expensePart || !incomePart) return;

      transaction = expensePart;
      toAccountId = incomePart.accountId;
      type = 'transfer';
    } else {
      transaction = transactionById.get(displayTx.id);
      if (!transaction) return;
      type = transaction.type;
    }

    const initialRecurringData: Omit<RecurringTransaction, 'id'> & { id?: string } = {
      id: '',
      accountId: transaction.accountId,
      toAccountId,
      description: transaction.description,
      amount: Math.abs(transaction.amount),
      category: transaction.category,
      type,
      currency: transaction.currency,
      frequency: 'monthly',
      startDate: toLocalISOString(new Date()),
      nextDueDate: toLocalISOString(new Date()),
      weekendAdjustment: 'on',
    };

    setTransactionToMakeRecurring(initialRecurringData);
    setIsRecurringModalOpen(true);
  }, [selectedIds, displayTransactions, transactionsByTransferId, transactionById, setTransactionToMakeRecurring, setIsRecurringModalOpen]);

  const handleClearLocation = useCallback((tx: DisplayTransaction) => {
    const lookupId = tx.isTransfer ? (tx.originalId || tx.id) : tx.id;
    const original = transactionById.get(lookupId);
    if (!original) return;

    const clearedFields = {
      address: undefined,
      placeName: undefined,
      street: undefined,
      city: undefined,
      postalCode: undefined,
      state: undefined,
      country: undefined,
      latitude: undefined,
      longitude: undefined,
      locationLabel: undefined,
    };

    if (tx.isTransfer && original.transferId) {
      const pair = transactionsByTransferId.get(original.transferId) ?? [];
      const updates = pair.map(p => ({
        ...p,
        ...clearedFields,
      }));
      saveTransaction(updates, []);
    } else {
      saveTransaction([{
        ...original,
        ...clearedFields,
      }], []);
    }
  }, [transactionById, transactionsByTransferId, saveTransaction]);

  const handleExport = useCallback(() => {
    if (filteredTransactions.length === 0) {
      toast.info('No transactions to export.');
      return;
    }
    const dataForExport = filteredTransactions.map(tx => {
      const { id, originalId, accountId, transferId, recurringSourceId, importId, sureId, ...rest } = tx;
      const resolved = resolveTransferDisplay(tx);
      return {
        date: rest.date,
        description: rest.description,
        merchant: rest.merchant,
        amount: resolved.amount,
        currency: resolved.currency,
        category: rest.category,
        type: rest.isTransfer ? 'transfer' : rest.type,
        account: rest.accountName || (rest.isTransfer ? `${rest.fromAccountName} → ${rest.toAccountName}` : 'N/A'),
        tags: rest.tagIds?.map(tid => tags.find(t => t.id === tid)?.name).join(' | ') || '',
      };
    });
    const csv = arrayToCSV(dataForExport);
    downloadCSV(csv, `crystal-transactions-${toLocalISOString(new Date())}.csv`);
  }, [filteredTransactions, resolveTransferDisplay, tags]);

  const menuFor = useCallback((tx: DisplayTransaction): MenuAction[] => {
    const lookupId = tx.isTransfer ? (tx.originalId || tx.id) : tx.id;
    const original = transactionById.get(lookupId) ?? null;
    const isPart = !!tx.parentTransactionId;
    const parent = isPart && tx.parentTransactionId ? transactionById.get(tx.parentTransactionId) : undefined;
    const items: MenuAction[] = [{ id: 'edit', label: 'Edit transaction', icon: 'pencil-edit-02', onAction: () => { setEditingTransaction(original); setTransactionModalOpen(true); } }];
    if (tx.isSplitParent || (isPart && parent?.isSplitParent)) items.push({ id: 'unsplit', label: 'Unsplit transaction', icon: 'git-merge', onAction: () => handleUnsplit(tx) });
    if (tx.isCombinedParent || (isPart && parent?.isCombinedParent)) items.push({ id: 'uncombine', label: 'Uncombine transaction', icon: 'split', onAction: () => handleUncombine(tx) });
    if (!tx.isSplitParent && !tx.isCombinedParent && !isPart && !tx.isTransfer) items.push({ id: 'split', label: 'Split transaction', icon: 'split', onAction: () => { setTransactionToSplit(original); setIsSplitModalOpen(true); } });
    items.push(
      { id: 'duplicate', label: 'Duplicate', icon: 'copy-01', onAction: () => handleDuplicate(tx) },
      { id: 'recurring', label: 'Make recurring', icon: 'repeat-one-01', isDisabled: tx.isTransfer, onAction: () => handleMakeRecurring(tx) },
    );
    const hasLocation = Boolean(tx.city || tx.country || tx.latitude || tx.longitude || (original && (original.city || original.country || original.latitude || original.longitude || original.address)));
    if (hasLocation) items.push({ id: 'location', label: 'Remove location', icon: 'location-offline-01', onAction: () => handleClearLocation(tx) });
    items.push({ id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => { setSelectedIds(new Set([tx.id])); setIsDeleteConfirmOpen(true); } });
    return items;
  }, [transactionById, handleUnsplit, handleUncombine, handleDuplicate, handleMakeRecurring, handleClearLocation, setEditingTransaction, setTransactionModalOpen, setTransactionToSplit, setIsSplitModalOpen, setSelectedIds, setIsDeleteConfirmOpen]);

  return {
    selectedTransactions,
    canCombine,
    canSplit,
    canUnsplit,
    canUncombine,
    handleOpenCategorizeModal,
    handleOpenCombineModal,
    handleOpenSplitModal,
    handleSaveSplits,
    handleSaveCombine,
    handleUnsplit,
    handleUncombine,
    handleSaveBulkCategory,
    handleSaveBulkEdits,
    handleOpenDeleteModal,
    handleConfirmBulkDelete,
    handleOpenAddModal,
    handleCloseModal,
    handleDuplicate,
    handleOpenOverview,
    handleMakeRecurring,
    handleClearLocation,
    handleExport,
    menuFor,
  };
}

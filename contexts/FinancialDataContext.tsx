import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Category, Tag, FinancialGoal, RecurringTransaction, RecurringTransactionOverride, LoanPaymentOverrides, BillPayment, ScheduledPayment } from '../types';
import {
  AccountsContextValue,
  AccountsProvider,
  PreferencesContextValue,
  PreferencesProvider,
  TransactionsContextValue,
  TransactionsProvider,
  WarrantsContextValue,
  WarrantsProvider,
  BudgetsContextValue,
  BudgetsProvider,
} from './DomainProviders';

interface CategoryContextValue {
  incomeCategories: Category[];
  expenseCategories: Category[];
  setIncomeCategories: (cats: Category[]) => void;
  setExpenseCategories: (cats: Category[]) => void;
}

interface TagsContextValue {
  tags: Tag[];
  saveTag: (tag: Tag) => void;
  deleteTag: (tagId: string) => void;
}

interface GoalsContextValue {
  financialGoals: FinancialGoal[];
  // FIX: Updated the type to allow an optional 'id', aligning it with the data structure used when creating new goals.
  saveFinancialGoal: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
  deleteFinancialGoal: (goalId: string) => void;
}

interface ScheduleContextValue {
  recurringTransactions: RecurringTransaction[];
  recurringTransactionOverrides: RecurringTransactionOverride[];
  loanPaymentOverrides: LoanPaymentOverrides;
  billsAndPayments: BillPayment[];
  // FIX: Updated the type to allow an optional 'id', aligning it with the data structure for new transactions.
  saveRecurringTransaction: (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
  deleteRecurringTransaction: (recurringId: string) => void;
  saveRecurringOverride: (override: RecurringTransactionOverride) => void;
  // FIX: Modified the signature to accept 'recurringTransactionId' and 'originalDate' to correctly identify and delete an override.
  deleteRecurringOverride: (recurringTransactionId: string, originalDate: string) => void;
  saveLoanPaymentOverrides: (accountId: string, overrides: Record<number, Partial<ScheduledPayment>>) => void;
  // FIX: Updated the type to allow an optional 'id' for new bill payments.
  saveBillPayment: (bill: Omit<BillPayment, 'id'> & { id?: string }) => void;
  deleteBillPayment: (billId: string) => void;
  markBillAsPaid: (billId: string, paymentAccountId: string, paymentDate: string) => void;
}

const CategoryContext = createContext<CategoryContextValue | undefined>(undefined);
const TagsContext = createContext<TagsContextValue | undefined>(undefined);
const GoalsContext = createContext<GoalsContextValue | undefined>(undefined);
const ScheduleContext = createContext<ScheduleContextValue | undefined>(undefined);

interface FinancialDataProviderProps {
  children: ReactNode;
  categories: CategoryContextValue;
  tags: TagsContextValue;
  budgets: BudgetsContextValue;
  goals: GoalsContextValue;
  schedule: ScheduleContextValue;
  preferences: PreferencesContextValue;
  accounts: AccountsContextValue;
  transactions: Omit<TransactionsContextValue, 'digest'>;
  warrants: WarrantsContextValue;
}

export const FinancialDataProvider: React.FC<FinancialDataProviderProps> = ({
  children,
  categories,
  tags,
  budgets,
  goals,
  schedule,
  preferences,
  accounts,
  transactions,
  warrants,
}) => {
  const memoCategories = useMemo(() => categories, [categories]);
  const memoTags = useMemo(() => tags, [tags]);
  const memoGoals = useMemo(() => goals, [goals]);
  const memoSchedule = useMemo(() => schedule, [schedule]);

  return (
    <PreferencesProvider value={preferences}>
      <AccountsProvider value={accounts}>
        <TransactionsProvider value={transactions}>
          <WarrantsProvider value={warrants}>
            <BudgetsProvider value={budgets}>
              <CategoryContext.Provider value={memoCategories}>
                <TagsContext.Provider value={memoTags}>
                  <GoalsContext.Provider value={memoGoals}>
                    <ScheduleContext.Provider value={memoSchedule}>
                      {children}
                    </ScheduleContext.Provider>
                  </GoalsContext.Provider>
                </TagsContext.Provider>
              </CategoryContext.Provider>
            </BudgetsProvider>
          </WarrantsProvider>
        </TransactionsProvider>
      </AccountsProvider>
    </PreferencesProvider>
  );
};

export const useCategoryContext = () => {
  const context = useContext(CategoryContext);
  if (!context) throw new Error('useCategoryContext must be used within FinancialDataProvider');
  return context;
};

export const useTagsContext = () => {
  const context = useContext(TagsContext);
  if (!context) throw new Error('useTagsContext must be used within FinancialDataProvider');
  return context;
};

export { useBudgetsContext } from './DomainProviders';

export const useGoalsContext = () => {
  const context = useContext(GoalsContext);
  if (!context) throw new Error('useGoalsContext must be used within FinancialDataProvider');
  return context;
};

export const useScheduleContext = () => {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useScheduleContext must be used within FinancialDataProvider');
  return context;
};

export default FinancialDataProvider;
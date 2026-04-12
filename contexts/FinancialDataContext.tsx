import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Category, Tag, Budget, FinancialGoal, RecurringTransaction, RecurringTransactionOverride, LoanPaymentOverrides, BillPayment, ScheduledPayment, Membership } from '../types';
import { AccountsContextValue, AccountsProvider, PreferencesContextValue, PreferencesProvider, TransactionsContextValue, TransactionsProvider, WarrantsContextValue, WarrantsProvider, InvoicesContextValue, InvoicesProvider } from './DomainProviders';

interface CategoryContextValue {
  incomeCategories: Category[];
  expenseCategories: Category[];
  setIncomeCategories: (cats: Category[]) => void;
  setExpenseCategories: (cats: Category[]) => void;
}

interface TagsContextValue {
  tags: Tag[];
  saveTag: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
  deleteTag: (tagId: string) => void;
}

interface BudgetsContextValue {
  budgets: Budget[];
  saveBudget: (budget: Omit<Budget, 'id'> & { id?: string }) => void;
  deleteBudget: (budgetId: string) => void;
}

interface GoalsContextValue {
  financialGoals: FinancialGoal[];
  saveFinancialGoal: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
  deleteFinancialGoal: (goalId: string) => void;
}

interface ScheduleContextValue {
  recurringTransactions: RecurringTransaction[];
  recurringTransactionOverrides: RecurringTransactionOverride[];
  loanPaymentOverrides: LoanPaymentOverrides;
  billsAndPayments: BillPayment[];
  memberships: Membership[];
  saveRecurringTransaction: (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
  deleteRecurringTransaction: (recurringId: string) => void;
  saveRecurringOverride: (override: RecurringTransactionOverride) => void;
  deleteRecurringOverride: (recurringTransactionId: string, originalDate: string) => void;
  saveLoanPaymentOverrides: (accountId: string, overrides: Record<number, Partial<ScheduledPayment>>) => void;
  saveBillPayment: (bill: Omit<BillPayment, 'id'> & { id?: string }) => void;
  deleteBillPayment: (billId: string) => void;
  markBillAsPaid: (billId: string, paymentAccountId: string, paymentDate: string) => void;
  saveMembership: (membership: Omit<Membership, 'id'> & { id?: string }) => void;
  deleteMembership: (membershipId: string) => void;
}

const CategoryContext = createContext<CategoryContextValue | undefined>(undefined);
const TagsContext = createContext<TagsContextValue | undefined>(undefined);
const BudgetsContext = createContext<BudgetsContextValue | undefined>(undefined);
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
  invoices: InvoicesContextValue;
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
  invoices,
}) => {
  const memoCategories = useMemo(() => categories, [categories]);
  const memoTags = useMemo(() => tags, [tags]);
  const memoBudgets = useMemo(() => budgets, [budgets]);
  const memoGoals = useMemo(() => goals, [goals]);
  const memoSchedule = useMemo(() => schedule, [schedule]);

  return (
    <PreferencesProvider value={preferences}>
      <AccountsProvider value={accounts}>
        <TransactionsProvider value={transactions}>
          <WarrantsProvider value={warrants}>
            <InvoicesProvider value={invoices}>
              <CategoryContext.Provider value={memoCategories}>
                <TagsContext.Provider value={memoTags}>
                  <BudgetsContext.Provider value={memoBudgets}>
                    <GoalsContext.Provider value={memoGoals}>
                      <ScheduleContext.Provider value={memoSchedule}>
                        {children}
                      </ScheduleContext.Provider>
                    </GoalsContext.Provider>
                  </BudgetsContext.Provider>
                </TagsContext.Provider>
              </CategoryContext.Provider>
            </InvoicesProvider>
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

export const useBudgetsContext = () => {
  const context = useContext(BudgetsContext);
  if (!context) throw new Error('useBudgetsContext must be used within FinancialDataProvider');
  return context;
};

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

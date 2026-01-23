
import React, { createContext, useContext } from 'react';
import { Budget, RecurringTransaction, RecurringTransactionOverride, BillPayment, Membership, Category, Tag, LoanPaymentOverrides } from '../types';
import { GoalsContextValue } from './DomainProviders';

interface BudgetsContextValue {
  budgets: Budget[];
  saveBudget: (budget: Omit<Budget, 'id'> & { id?: string }) => void;
  deleteBudget: (budgetId: string) => void;
}

interface ScheduleContextValue {
  recurringTransactions: RecurringTransaction[];
  recurringTransactionOverrides: RecurringTransactionOverride[];
  billsAndPayments: BillPayment[];
  memberships: Membership[];
  loanPaymentOverrides: LoanPaymentOverrides;
  saveRecurringTransaction: (rt: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
  deleteRecurringTransaction: (id: string) => void;
  saveRecurringOverride: (override: RecurringTransactionOverride) => void;
  deleteRecurringOverride: (rtId: string, date: string) => void;
  saveBillPayment: (bill: Omit<BillPayment, 'id'> & { id?: string }) => void;
  deleteBillPayment: (id: string) => void;
  saveMembership: (membership: Omit<Membership, 'id'> & { id?: string }) => void;
  deleteMembership: (id: string) => void;
  saveLoanPaymentOverrides: (accountId: string, overrides: any) => void;
}

interface CategoryContextValue {
    incomeCategories: Category[];
    expenseCategories: Category[];
    setIncomeCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    setExpenseCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

interface TagsContextValue {
    tags: Tag[];
    saveTag: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
    deleteTag: (id: string) => void;
}

export const BudgetsContext = createContext<BudgetsContextValue | undefined>(undefined);
export const GoalsContext = createContext<GoalsContextValue | undefined>(undefined);
export const ScheduleContext = createContext<ScheduleContextValue | undefined>(undefined);
export const CategoryContext = createContext<CategoryContextValue | undefined>(undefined);
export const TagsContext = createContext<TagsContextValue | undefined>(undefined);

export const useBudgetsContext = () => {
    const context = useContext(BudgetsContext);
    if (!context) throw new Error("useBudgetsContext must be used within provider");
    return context;
};

export const useGoalsContext = () => {
    const context = useContext(GoalsContext);
    if (!context) throw new Error("useGoalsContext must be used within provider");
    return context;
};

export const useScheduleContext = () => {
    const context = useContext(ScheduleContext);
    if (!context) throw new Error("useScheduleContext must be used within provider");
    return context;
};

export const useCategoryContext = () => {
    const context = useContext(CategoryContext);
    if (!context) throw new Error("useCategoryContext must be used within provider");
    return context;
};

export const useTagsContext = () => {
    const context = useContext(TagsContext);
    if (!context) throw new Error("useTagsContext must be used within provider");
    return context;
};

import { v4 as uuidv4 } from 'uuid';
import { Account, AppPreferences, Transaction } from '../types';
import { toLocalISOString } from '../utils';

export const isEnableBankingConfigured = (preferences: AppPreferences) => {
  return Boolean(
    preferences.enableBankingCountryCode &&
    preferences.enableBankingApplicationId &&
    preferences.enableBankingClientCertificate
  );
};

export const buildEnableBankingSync = (account: Account) => {
  const today = toLocalISOString(new Date());
  const amount = Math.round((Math.random() * 200 - 100) * 100) / 100; // -100..100
  const transaction: Transaction = {
    id: uuidv4(),
    accountId: account.id,
    date: today,
    description: 'Enable Banking sync',
    merchant: account.financialInstitution || account.name,
    amount,
    category: 'Bank Sync',
    type: amount >= 0 ? 'income' : 'expense',
    currency: account.currency,
  };

  const updatedBalance = account.balance + amount;

  return {
    updatedBalance,
    transactions: [transaction],
  };
};

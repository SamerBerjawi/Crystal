import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTransferInfo } from '../../utils/transferDetails';
import type { Account, Transaction } from '../../types';

test('resolveTransferInfo identifies Credit Card Settlement when transferring to a Credit Card', () => {
  const accounts: Account[] = [
    { id: 'acc-chk', name: 'Checking', type: 'Checking', balance: 2000, currency: 'EUR' },
    { id: 'acc-cc', name: 'Visa Gold', type: 'Credit Card', balance: -500, currency: 'EUR', settlementAccountId: 'acc-chk' },
  ];

  const tx: Partial<Transaction> = {
    id: 'tx-1',
    transferId: 'tr-1',
    accountId: 'acc-chk',
    amount: -500,
    type: 'expense',
    description: 'Samer Berjawi',
    currency: 'EUR',
  };

  const counterpart: Partial<Transaction> = {
    id: 'tx-2',
    transferId: 'tr-1',
    accountId: 'acc-cc',
    amount: 500,
    type: 'income',
    currency: 'EUR',
  };

  const info = resolveTransferInfo(tx, accounts, counterpart);
  assert.ok(info);
  assert.equal(info.kind, 'credit_card_settlement');
  assert.equal(info.label, 'Credit Card Settlement');
  assert.equal(info.icon, 'credit_card');
});

test('resolveTransferInfo identifies Mortgage Payment when linked to a Property loan', () => {
  const accounts: Account[] = [
    { id: 'acc-chk', name: 'Checking', type: 'Checking', balance: 5000, currency: 'EUR' },
    { id: 'acc-loan', name: 'Canal View Home Loan', type: 'Loan', balance: -150000, currency: 'EUR' },
    { id: 'acc-prop', name: 'Canal Apartment', type: 'Property', balance: 300000, currency: 'EUR', linkedLoanId: 'acc-loan' },
  ];

  const tx: Partial<Transaction> = {
    id: 'tx-1',
    transferId: 'tr-loan-1',
    accountId: 'acc-chk',
    amount: -1200,
    type: 'expense',
    description: 'Account Transfer',
    currency: 'EUR',
  };

  const counterpart: Partial<Transaction> = {
    id: 'tx-2',
    transferId: 'tr-loan-1',
    accountId: 'acc-loan',
    amount: 1200,
    type: 'income',
    currency: 'EUR',
  };

  const info = resolveTransferInfo(tx, accounts, counterpart);
  assert.ok(info);
  assert.equal(info.kind, 'mortgage_payment');
  assert.equal(info.label, 'Mortgage Payment');
  assert.equal(info.icon, 'home');
});

test('resolveTransferInfo identifies Loan Payment for vehicle or personal loans', () => {
  const accounts: Account[] = [
    { id: 'acc-chk', name: 'Checking', type: 'Checking', balance: 5000, currency: 'EUR' },
    { id: 'acc-car', name: 'Tesla Auto Loan', type: 'Loan', balance: -20000, currency: 'EUR' },
  ];

  const tx: Partial<Transaction> = {
    id: 'tx-1',
    transferId: 'tr-car-1',
    accountId: 'acc-chk',
    amount: -450,
    type: 'expense',
    description: 'Account Transfer',
    currency: 'EUR',
  };

  const counterpart: Partial<Transaction> = {
    id: 'tx-2',
    transferId: 'tr-car-1',
    accountId: 'acc-car',
    amount: 450,
    type: 'income',
    currency: 'EUR',
  };

  const info = resolveTransferInfo(tx, accounts, counterpart);
  assert.ok(info);
  assert.equal(info.kind, 'loan_payment');
  assert.equal(info.label, 'Loan Payment');
  assert.equal(info.icon, 'request_quote');
});

test('resolveTransferInfo identifies Spare Change Round-up', () => {
  const accounts: Account[] = [
    { id: 'acc-chk', name: 'Checking', type: 'Checking', balance: 5000, currency: 'EUR' },
    { id: 'acc-spare', name: 'Spare Change Pot', type: 'Savings', balance: 120, currency: 'EUR' },
  ];

  const tx: Partial<Transaction> = {
    id: 'tx-1',
    transferId: 'spare-tx-100',
    accountId: 'acc-chk',
    amount: -0.85,
    type: 'expense',
    description: 'Spare change for Supermarket',
    currency: 'EUR',
  };

  const info = resolveTransferInfo(tx, accounts);
  assert.ok(info);
  assert.equal(info.kind, 'spare_change');
  assert.equal(info.label, 'Spare change for Supermarket');
  assert.equal(info.icon, 'piggy');
});

test('resolveTransferInfo returns null for plain transfers between regular checking accounts', () => {
  const accounts: Account[] = [
    { id: 'acc-1', name: 'Joint Checking', type: 'Checking', balance: 5000, currency: 'EUR' },
    { id: 'acc-2', name: 'Personal Checking', type: 'Checking', balance: 1000, currency: 'EUR' },
  ];

  const tx: Partial<Transaction> = {
    id: 'tx-1',
    transferId: 'tr-plain',
    accountId: 'acc-1',
    amount: -200,
    type: 'expense',
    description: 'Transfer to personal',
    currency: 'EUR',
  };

  const counterpart: Partial<Transaction> = {
    id: 'tx-2',
    transferId: 'tr-plain',
    accountId: 'acc-2',
    amount: 200,
    type: 'income',
    currency: 'EUR',
  };

  const info = resolveTransferInfo(tx, accounts, counterpart);
  assert.equal(info, null);
});


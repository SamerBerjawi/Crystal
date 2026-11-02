import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAccountBrandfetchUrl, isCashAccount } from '../../utils/brandfetch';
import type { Account } from '../../types';

test('getAccountBrandfetchUrl returns null when brandfetchClientId is not configured', () => {
  const acc: Partial<Account> = {
    id: '1',
    name: 'Main Checking',
    type: 'Checking',
    financialInstitution: 'Chase',
    currency: 'USD',
    balance: 1000,
  };

  assert.equal(getAccountBrandfetchUrl(acc as Account, undefined), null);
  assert.equal(getAccountBrandfetchUrl(acc as Account, ''), null);
  assert.equal(getAccountBrandfetchUrl(acc as Account, '   '), null);
});

test('getAccountBrandfetchUrl returns null when NO URL or domain is configured by user', () => {
  // Single word institution without domain or URL
  const accPlainInst: Partial<Account> = {
    id: '2',
    name: 'Everyday',
    type: 'Checking',
    financialInstitution: 'Revolut',
    currency: 'EUR',
    balance: 1200,
  };
  assert.equal(getAccountBrandfetchUrl(accPlainInst as Account, 'client_xyz'), null);

  // Credit Card with card network but NO user-configured URL or domain
  const cardAcc: Partial<Account> = {
    id: '4',
    name: 'Sapphire Preferred',
    type: 'Credit Card',
    cardNetwork: 'Visa',
    currency: 'USD',
    balance: -450,
  };
  assert.equal(getAccountBrandfetchUrl(cardAcc as Account, 'client_xyz'), null);
});

test('getAccountBrandfetchUrl resolves domain when user configures website or domain', () => {
  // Domain entered directly in financialInstitution
  const accWithDomain: Partial<Account> = {
    id: '1',
    name: 'My Bank',
    type: 'Checking',
    financialInstitution: 'belfius.be',
    currency: 'EUR',
    balance: 500,
  };
  const url1 = getAccountBrandfetchUrl(accWithDomain as Account, 'client_xyz');
  assert.ok(url1);
  assert.match(url1!, /cdn\.brandfetch\.io\/belfius\.be/);
  assert.match(url1!, /fallback=404/);
  assert.match(url1!, /c=client_xyz/);

  // Explicit user-configured website URL
  const accWithWebsite: Partial<Account> = {
    id: '2',
    name: 'Main Checking',
    type: 'Checking',
    financialInstitution: 'Revolut',
    website: 'https://www.revolut.com/en-BE',
    currency: 'EUR',
    balance: 1200,
  };
  const url2 = getAccountBrandfetchUrl(accWithWebsite as Account, 'client_xyz');
  assert.ok(url2);
  assert.match(url2!, /cdn\.brandfetch\.io\/revolut\.com/);
  assert.match(url2!, /fallback=404/);
  assert.match(url2!, /c=client_xyz/);
});

test('getAccountBrandfetchUrl respects merchantLogoOverrides', () => {
  const acc: Partial<Account> = {
    id: '3',
    name: 'Custom Inst',
    type: 'Checking',
    financialInstitution: 'CustomBank',
    currency: 'EUR',
    balance: 200,
  };
  const overrides = {
    custombank: 'https://images.example.com/logo.png',
  };
  const url = getAccountBrandfetchUrl(acc as Account, 'client_xyz', overrides);
  assert.equal(url, 'https://images.example.com/logo.png');

  // Domain override
  const domainOverrides = {
    custombank: 'custombank.de',
  };
  const urlDomain = getAccountBrandfetchUrl(acc as Account, 'client_xyz', domainOverrides);
  assert.ok(urlDomain);
  assert.match(urlDomain!, /cdn\.brandfetch\.io\/custombank\.de/);
});

test('isCashAccount identifies cash accounts', () => {
  assert.equal(isCashAccount({ type: 'Other Assets', otherSubType: 'Cash' }), true);
  assert.equal(isCashAccount({ name: 'Cash' }), true);
  assert.equal(isCashAccount({ name: 'Cash Wallet' }), true);
  assert.equal(isCashAccount({ name: 'Physical Cash' }), true);
  assert.equal(isCashAccount({ financialInstitution: 'Cash' }), true);
  assert.equal(isCashAccount({ name: 'Main Checking', type: 'Checking' }), false);
});

test('getAccountBrandfetchUrl returns null for Cash accounts even if overrides exist', () => {
  const cashAcc: Partial<Account> = {
    id: 'cash-1',
    name: 'Cash',
    type: 'Other Assets',
    otherSubType: 'Cash',
  };
  const overrides = { cash: 'https://images.example.com/cash.png' };
  assert.equal(getAccountBrandfetchUrl(cashAcc as Account, 'client_xyz', overrides), null);
});

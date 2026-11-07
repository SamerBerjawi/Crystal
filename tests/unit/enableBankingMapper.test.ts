import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSyncDateFrom,
  extractProviderAccountIdentifiers,
  getLegacyEnableBankingTransactionId,
  guessBrandDomain,
  mapEnableBankingTransaction,
  mapMccToCategory,
  matchExistingProviderAccount,
  matchKnownBrand,
  parseEuropeanBankRemittance,
  resolveEnableBankingBalance,
  stripPaymentWallet,
  suggestAccountType,
  sanitizeBankMerchant,
} from '../../utils/enableBankingMapper';
import { EnableBankingAccount } from '../../types';

test('resolveEnableBankingBalance supports ISO 20022 4-letter codes and camelCase types in priority order', () => {
  // ISO 20022 codes: CLBD (closingBooked) should win over OPBD (openingBooked)
  const isoBalances = {
    balances: [
      { balance_type: 'OPBD', balance_amount: { amount: '100.00', currency: 'EUR' } },
      { balance_type: 'CLBD', balance_amount: { amount: '2450.75', currency: 'EUR' } },
    ],
  };
  assert.deepEqual(resolveEnableBankingBalance(isoBalances), { amount: 2450.75, currency: 'EUR', balanceType: 'CLBD' });

  // ITAV (interimAvailable) when CLBD/XPCD are absent
  const interimBalances = [
    { balance_type: 'OPBD', balance_amount: { amount: '50.00', currency: 'GBP' } },
    { balance_type: 'ITAV', balance_amount: { amount: '312.40', currency: 'GBP' } },
  ];
  assert.deepEqual(resolveEnableBankingBalance(interimBalances), { amount: 312.4, currency: 'GBP', balanceType: 'ITAV' });

  // camelCase closingBooked
  const camelBalances = {
    balances: [
      { balanceType: 'closingBooked', balanceAmount: { amount: '999.99', currency: 'EUR' } },
    ],
  };
  assert.deepEqual(resolveEnableBankingBalance(camelBalances), { amount: 999.99, currency: 'EUR', balanceType: 'closingBooked' });
});

test('extractProviderAccountIdentifiers and matchExistingProviderAccount preserve account links across session reauthorizations', () => {
  const existingAccounts: EnableBankingAccount[] = [
    {
      id: 'old-session-uid-111',
      identificationHash: 'hash-abc-123',
      accountNumber: 'BE68539007547034',
      name: 'KBC Plus Account',
      bankName: 'KBC',
      currency: 'EUR',
      balance: 1200,
      linkedAccountId: 'crystal-acc-1',
      syncStartDate: '2026-01-01',
    },
  ];

  // Reauthorized session assigns a brand new uid, but keeps identification_hash and iban
  const newSessionAccount = {
    uid: 'new-session-uid-999',
    identification_hash: 'hash-abc-123',
    account_id: { iban: 'BE68 5390 0754 7034' },
  };
  const ids = extractProviderAccountIdentifiers(newSessionAccount);
  assert.equal(ids.uid, 'new-session-uid-999');
  assert.equal(ids.identificationHash, 'hash-abc-123');
  assert.equal(ids.accountNumber, 'BE68539007547034');

  const matchedByHash = matchExistingProviderAccount(existingAccounts, ids);
  assert.equal(matchedByHash?.linkedAccountId, 'crystal-acc-1');

  // Even if identification_hash is missing, IBAN fallback still matches
  const matchedByIban = matchExistingProviderAccount(existingAccounts, {
    uid: 'new-session-uid-999',
    accountNumber: 'BE68 5390 0754 7034',
  });
  assert.equal(matchedByIban?.linkedAccountId, 'crystal-acc-1');
});

test('computeSyncDateFrom applies a 5-day settlement lookback buffer in incremental mode', () => {
  const dateFrom = computeSyncDateFrom({
    transactionMode: 'incremental',
    accountLastSyncedAt: '2026-06-15T14:30:00',
    accountSyncStartDate: '2026-01-01',
  });
  assert.equal(dateFrom, '2026-06-10');

  // Clamps to accountSyncStartDate if 5-day buffer goes before syncStartDate
  const clamped = computeSyncDateFrom({
    transactionMode: 'incremental',
    accountLastSyncedAt: '2026-06-03T10:00:00',
    accountSyncStartDate: '2026-06-01',
  });
  assert.equal(clamped, '2026-06-01');
});

test('parseEuropeanBankRemittance extracts merchant and city from Dutch, French, and German card payment templates', () => {
  const dutch = parseEuropeanBankRemittance(
    'Betaling met bankkaart (Maestro) bij DELHAIZE FLAGEY te ELSENE op 14/05/2026 18:42 uur'
  );
  assert.equal(dutch.merchant, 'DELHAIZE FLAGEY');
  assert.equal(dutch.city, 'ELSENE');

  const french = parseEuropeanBankRemittance(
    'Paiement par carte chez BOULANGERIE PAUL à BRUXELLES le 14/05/2026'
  );
  assert.equal(french.merchant, 'BOULANGERIE PAUL');
  assert.equal(french.city, 'BRUXELLES');

  const german = parseEuropeanBankRemittance(
    'Kartenzahlung bei REWE MARKT GMBH in BERLIN am 14.05.2026'
  );
  assert.equal(german.merchant, 'REWE MARKT GMBH');
  assert.equal(german.city, 'BERLIN');
});

test('sanitizeBankMerchant unwraps payment facilitators, strips legal suffixes/store numbers, and normalizes brands', () => {
  assert.equal(sanitizeBankMerchant('SumUp *Bakkerij Janssens SRL'), 'Bakkerij Janssens');
  assert.equal(sanitizeBankMerchant('Zettle_*Coffee Corner BV'), 'Coffee Corner');
  assert.equal(sanitizeBankMerchant('Mollie *COOLBLUE NV'), 'Coolblue');
  assert.equal(sanitizeBankMerchant('PAYPAL *SPOTIFY AB'), 'Spotify');
  assert.equal(sanitizeBankMerchant('DELHAIZE LE LION #0412 BRUXELLES'), 'Delhaize');
  assert.equal(sanitizeBankMerchant('COFFEE BAR'), 'Coffee Bar');
  assert.equal(sanitizeBankMerchant('SNCB NMBS BRUXELLES MIDI'), 'SNCB / NMBS');
});

test('mapEnableBankingTransaction prioritizes structured counterparty over remittance text and unwraps PSPs', () => {
  // 1. Structured creditor.name wins over noisy remittance reference
  const sepaTx = mapEnableBankingTransaction(
    {
      transaction_id: 'tx-sepa-1',
      transaction_amount: { amount: '49.99', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      booking_date: '2026-05-10',
      creditor: { name: 'PROXIMUS NV' },
      remittance_information: ['DOMICILIATION FACTURE 8839201948291'],
    },
    {
      linkedAccountId: 'acc-1',
      providerAccountId: 'qa-acc-1',
      currency: 'EUR',
      connectionId: 'eb-1',
    }
  );
  assert.ok(sepaTx);
  assert.equal(sepaTx.merchant, 'Proximus');
  assert.equal(sepaTx.category, 'Internet & TV');
  assert.equal(sepaTx.description, 'DOMICILIATION FACTURE 8839201948291');

  // 2. When creditor.name is a generic PSP ("Mollie"), unwraps ultimate_creditor or remittance merchant
  const mollieTx = mapEnableBankingTransaction(
    {
      transaction_id: 'tx-mollie-1',
      transaction_amount: { amount: '89.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      booking_date: '2026-05-11',
      creditor: { name: 'Stichting Mollie Payments' },
      remittance_information: ['Mollie *BOL.COM BV order 12345'],
    },
    {
      linkedAccountId: 'acc-1',
      providerAccountId: 'qa-acc-1',
      currency: 'EUR',
      connectionId: 'eb-1',
    }
  );
  assert.ok(mollieTx);
  assert.equal(mollieTx.merchant, 'Bol.com');
  assert.equal(mollieTx.category, 'Shopping & Lifestyle');

  // 3. Card acceptor with MCC code categorizes unknown local merchant and extracts city/country
  const localCardTx = mapEnableBankingTransaction(
    {
      transaction_id: 'tx-card-1',
      transaction_amount: { amount: '24.50', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      booking_date: '2026-05-12',
      card_acceptor: {
        name: 'TRATTORIA ROMA SRL',
        merchant_category_code: '5812',
        city: 'BRUXELLES',
        country: 'BE',
      },
      exchange_rate: {
        instructed_amount: { amount: '26.50', currency: 'USD' },
        exchange_rate: '0.9245',
      },
    },
    {
      linkedAccountId: 'acc-1',
      providerAccountId: 'qa-acc-1',
      currency: 'EUR',
      connectionId: 'eb-1',
    }
  );
  assert.ok(localCardTx);
  assert.equal(localCardTx.merchant, 'Trattoria Roma');
  assert.equal(localCardTx.category, 'Dining Out');
  assert.equal(localCardTx.city, 'Bruxelles');
  assert.equal(localCardTx.country, 'BE');
  assert.ok(localCardTx.notes?.includes('26.50 USD'));

  // 4. Counterparty IBAN matching another linked account is detected as internal transfer
  const transferTx = mapEnableBankingTransaction(
    {
      transaction_id: 'tx-trf-1',
      transaction_amount: { amount: '500.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      booking_date: '2026-05-12',
      creditor: { name: 'Alex Morgan' },
      creditor_account: { iban: 'BE99 1234 5678 9012' },
    },
    {
      linkedAccountId: 'acc-1',
      providerAccountId: 'qa-acc-1',
      currency: 'EUR',
      connectionId: 'eb-1',
      userIdentities: ['Alex Morgan'],
      linkedIbanToAccountName: { BE99123456789012: 'Savings Account' },
    }
  );
  assert.ok(transferTx);
  assert.equal(transferTx.category, 'Transfer');
  assert.equal(transferTx.description, 'Transfer to Savings Account');
});

test('mapMccToCategory and matchKnownBrand / guessBrandDomain cover major European merchants and MCCs', () => {
  assert.equal(mapMccToCategory('5411'), 'Supermarket');
  assert.equal(mapMccToCategory('5814'), 'Cafes & Snacks');
  assert.equal(mapMccToCategory('4121'), 'Ride-Hailing');
  assert.equal(mapMccToCategory('6011'), 'Cash Withdrawals & ATM');
  assert.equal(matchKnownBrand('COLRUYT GROUP')?.canonicalName, 'Colruyt');
  assert.equal(guessBrandDomain('Albert Heijn'), 'ah.nl');
  assert.equal(guessBrandDomain('Delhaize'), 'delhaize.be');
});

test('transaction ids prefer the stable entry_reference over transaction_id', () => {
  const opts = { linkedAccountId: 'acc-1', providerAccountId: 'uid-1', currency: 'EUR' as const, connectionId: 'eb-1' };
  const tx = { entry_reference: 'ref-9', transaction_id: 'volatile-1', transaction_amount: { amount: '5.00' }, credit_debit_indicator: 'DBIT', booking_date: '2026-05-10' };
  const mapped = mapEnableBankingTransaction(tx, opts);
  assert.equal(mapped?.sureId, 'ref-9');
  assert.equal(mapped?.id, 'eb-eb-1-uid-1-ref-9');
  // Without entry_reference it still falls back to transaction_id.
  assert.equal(mapEnableBankingTransaction({ ...tx, entry_reference: undefined }, opts)?.sureId, 'volatile-1');
});

test('getLegacyEnableBankingTransactionId returns the old transaction_id based id only when it differs', () => {
  assert.equal(getLegacyEnableBankingTransactionId({ entry_reference: 'r', transaction_id: 't' }, 'c', 'a'), 'eb-c-a-t');
  assert.equal(getLegacyEnableBankingTransactionId({ entry_reference: 'same', transaction_id: 'same' }, 'c', 'a'), undefined);
  assert.equal(getLegacyEnableBankingTransactionId({ transaction_id: 't' }, 'c', 'a'), undefined);
});

test('mapEnableBankingTransaction uses bank_transaction_code, reference_number and the holder note from the API schema', () => {
  const opts = { linkedAccountId: 'acc-1', providerAccountId: 'uid-1', currency: 'EUR' as const, connectionId: 'eb-1' };
  const base = { entry_reference: 'r1', transaction_amount: { amount: '12.00' }, credit_debit_indicator: 'DBIT', booking_date: '2026-05-10' };
  assert.equal(mapEnableBankingTransaction({ ...base, bank_transaction_code: { description: 'Card payment' } }, opts)?.description, 'Card payment');
  assert.equal(mapEnableBankingTransaction({ ...base, reference_number: 'RF18539007547034' }, opts)?.description, 'RF18539007547034');
  assert.equal(mapEnableBankingTransaction({ ...base, note: 'Birthday gift' }, opts)?.notes, 'Birthday gift');
});

test('an account keeps its link when the session renews with a new uid and no identification hash', () => {
  const existing = [{ id: 'old-uid', name: 'Current', bankName: 'B', currency: 'EUR' as const, balance: 0, accountNumber: 'BE68 5390 0754 7034', linkedAccountId: 'acc-1' }];
  const match = matchExistingProviderAccount(existing, { uid: 'new-uid', accountNumber: 'BE68539007547034' });
  assert.equal(match?.linkedAccountId, 'acc-1');
  assert.equal(matchExistingProviderAccount(existing, { uid: 'new-uid', accountNumber: 'BE00000000000000' }), undefined);
});

test('mobile wallet wording is not read as the merchant (Apple Pay is not Apple)', () => {
  assert.equal(stripPaymentWallet('Betaling met Apple Pay bij JUMBO'), 'Betaling bij JUMBO');
  assert.equal(matchKnownBrand('PAYMENT VIA APPLE PAY'), undefined);
  assert.equal(matchKnownBrand('Apple Pay'), undefined);
  assert.equal(matchKnownBrand('APPLE.COM/BILL')?.canonicalName, 'Apple');
  assert.equal(sanitizeBankMerchant('Apple Pay'), undefined);
  assert.equal(sanitizeBankMerchant('GOOGLE PAY'), undefined);
  assert.equal(sanitizeBankMerchant('Apple Pay DELHAIZE BRUXELLES'), 'Delhaize');
  assert.equal(sanitizeBankMerchant('APPLE.COM/BILL'), 'Apple');
});

test('a card payment made with Apple Pay resolves to the shop, not Apple', () => {
  const opts = { linkedAccountId: 'acc-1', providerAccountId: 'uid-1', currency: 'EUR' as const, connectionId: 'eb-1' };
  const base = { entry_reference: 'r1', transaction_amount: { amount: '23.40' }, credit_debit_indicator: 'DBIT', booking_date: '2026-05-10' };
  const viaTemplate = mapEnableBankingTransaction({ ...base, remittance_information: ['Betaling met Apple Pay (Visa debet) bij BAKKERIJ JANSSENS te GENT'] }, opts);
  assert.equal(viaTemplate?.merchant, 'Bakkerij Janssens');
  const viaRemittanceBrand = mapEnableBankingTransaction({ ...base, remittance_information: ['APPLE PAY COLRUYT 4321 BRUSSELS'] }, opts);
  assert.equal(viaRemittanceBrand?.merchant, 'Colruyt');
  const apple = mapEnableBankingTransaction({ ...base, creditor: { name: 'Apple Pay' }, remittance_information: ['APPLE PAY DELHAIZE'] }, opts);
  assert.equal(apple?.merchant, 'Delhaize');
  const genuine = mapEnableBankingTransaction({ ...base, creditor: { name: 'APPLE.COM/BILL' } }, opts);
  assert.equal(genuine?.merchant, 'Apple');
});

test('suggestAccountType reads cash_account_type, then the product name', () => {
  assert.equal(suggestAccountType({ cash_account_type: 'SVGS' }), 'Savings');
  assert.equal(suggestAccountType({ cashAccountType: 'CARD' }), 'Credit Card');
  assert.equal(suggestAccountType({ cash_account_type: 'CACC', product: 'Savings plus' }), 'Checking');
  assert.equal(suggestAccountType({ product: 'KBC Spaarrekening' }), 'Checking');
  assert.equal(suggestAccountType({ product: 'Savings Account' }), 'Savings');
  assert.equal(suggestAccountType({ name: 'Mastercard Gold' }), 'Credit Card');
  assert.equal(suggestAccountType(undefined), 'Checking');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Category, Transaction } from '../../types';
import { generateAmortizationSchedule, generateBalanceForecast } from '../../utils';
import {
  computeCashAccountMetrics,
  computeCompoundingProjection,
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
  parseBatchMileageInput,
  resolveAccountArchetype,
  simulateExtraLoanPayment,
  solveLoanParameter,
  validateMileageReading,
} from '../../utils/accountDetailModel';

const assertClose = (actual: number, expected: number, tolerance = 0.1) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

const categories: Category[] = [
  {
    id: 'cat-inc',
    name: 'Income',
    icon: 'wallet',
    color: '#10b981',
    classification: 'income',
    subCategories: [
      {
        id: 'cat-int',
        name: 'Interest & Yield',
        icon: 'trending_up',
        color: '#10b981',
        classification: 'income',
        subCategories: [],
      },
    ],
  },
];

test('Savings Interest Fix #1 & #2: computes YTD accrued interest and 12-month history anchored to today even when last tx was >30 days ago and no manual interest txs exist', () => {
  const savingsAccount: Account = {
    id: 'sav-1',
    name: 'High Yield Vault',
    type: 'Savings',
    balance: 12000,
    apy: 4.0, // 4% APY -> 480/yr -> 39.28/mo
    currency: 'EUR',
    openingDate: '2024-01-01',
  };
  // Only an old deposit from 2024 (like demoSeed.ts)
  const transactions: Transaction[] = [
    {
      id: 'tx-old',
      accountId: 'sav-1',
      date: '2024-06-01',
      description: 'Initial Deposit',
      amount: 12000,
      category: 'Transfer',
      type: 'income',
      currency: 'EUR',
    },
  ];

  const metrics = computeSavingsAccountMetrics(savingsAccount, transactions, categories, {
    referenceDate: new Date(2026, 5, 15), // June 15, 2026 (5 full months Jan-May + 15/30 of June = 5.5 months)
  });

  assertClose(metrics.projectedAnnualInterest, 480);
  // APY is an effective annual rate: monthly = 12000 × (1.04^(1/12) − 1) ≈ 39.28, not 480 / 12 (L-D4).
  assertClose(metrics.projectedMonthlyInterest, 39.28);
  // YTD accrued interest over 5.5 months of 2026 = 5.5 * 39.28 ≈ 216.05
  assert.equal(metrics.actualInterestYTD, 0);
  assertClose(metrics.accruedInterestYTD, 216.05);
  assertClose(metrics.totalInterestYTD, 216.05);
  // 12-month interest history ends in Jun 2026, not Jun 2024
  assert.equal(metrics.interestHistory.length, 12);
  assertClose(metrics.interestHistory[11].value, 39.28);
});

test('Savings Interest Fix #3, #4, #5 & #6: matches nested interest subcategories, converts foreign currencies to account currency, zeroes pre-openingDate months, and avoids division-by-1 in Growth Index', () => {
  const usdSavings: Account = {
    id: 'sav-usd',
    name: 'USD Savings',
    type: 'Savings',
    balance: 5000,
    apy: 3.6,
    currency: 'USD',
    openingDate: '2026-05-01',
  };
  const transactions: Transaction[] = [
    {
      id: 'tx-dep',
      accountId: 'sav-usd',
      date: '2026-05-02',
      description: 'Opening Deposit',
      amount: 4985,
      category: 'Transfer',
      type: 'income',
      currency: 'USD',
    },
    {
      id: 'tx-int',
      accountId: 'sav-usd',
      date: '2026-05-31',
      description: 'Monthly Savings Payout',
      amount: 15,
      category: 'cat-int', // Nested sub-category ID!
      type: 'income',
      currency: 'USD',
    },
  ];

  const metrics = computeSavingsAccountMetrics(usdSavings, transactions, categories, {
    referenceDate: new Date(2026, 5, 15), // June 15, 2026
  });

  // Months before May 2026 (openingDate) must have 0 projected interest
  assert.equal(metrics.interestHistory[0].value, 0);
  // May 2026 has $15 actual interest in USD (not EUR!)
  const mayEntry = metrics.interestHistory[10];
  assertClose(mayEntry.actual, 15);
  assert.equal(mayEntry.isProjected, false);
  // Growth Index should NOT be 499900.0% (90 days ago balance was 0 before opening deposit; return on net inflows is +0.3%)
  assertClose(metrics.growthIndexPct, 0.3);
  assert.equal(metrics.growthIndexLabel, '+0.3%');
});

test('Forecast APY Compounding: generateBalanceForecast compounds APY on Savings accounts', () => {
  const savingsAcc: Account = {
    id: 'sav-forecast',
    name: 'Compound Vault',
    type: 'Savings',
    balance: 10000,
    apy: 5.0,
    currency: 'EUR',
  };
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);

  const { chartData } = generateBalanceForecast([savingsAcc], [], [], [], end, []);
  const finalBalance = chartData[chartData.length - 1].value;
  // 10,000 at 5% APY over 1 year should grow to ~10,500
  assert.ok(finalBalance > 10480 && finalBalance < 10520, `Expected ${finalBalance} around 10500`);
});

test('BUG-08 & BUG-09: generateAmortizationSchedule aggregates multiple payments in the same month and applies extraPrincipal overrides to reduce remaining balance', () => {
  const loan: Account = {
    id: 'loan-1',
    name: 'Home Loan',
    type: 'Loan',
    balance: -10000,
    principalAmount: 12000,
    interestRate: 6.0,
    duration: 12,
    loanStartDate: '2025-12-01',
    paymentDate: 15,
    currency: 'EUR',
  };

  // Two partial payments in Jan 2026
  const txs: Transaction[] = [
    {
      id: 'p1',
      accountId: 'loan-1',
      date: '2026-01-10',
      description: 'Part 1',
      amount: 500,
      principalAmount: 440,
      interestAmount: 60,
      category: 'Loan Payment',
      type: 'income',
      currency: 'EUR',
    },
    {
      id: 'p2',
      accountId: 'loan-1',
      date: '2026-01-20',
      description: 'Part 2',
      amount: 533,
      principalAmount: 533,
      interestAmount: 0,
      category: 'Loan Payment',
      type: 'income',
      currency: 'EUR',
    },
  ];

  const scheduleWithOverride = generateAmortizationSchedule(loan, txs, {
    2: { extraPrincipal: 2000 },
  });

  // Month 1 should aggregate both payments (440 + 533 = 973 principal)
  assertClose(scheduleWithOverride[0].principal, 973);
  assertClose(scheduleWithOverride[0].interest, 60);
  assert.equal(scheduleWithOverride[0].status, 'Paid');

  // Month 2 has 2000 extraPrincipal, so schedule should pay off earlier than 12 months
  assert.ok(scheduleWithOverride.length < 12);
});

test('BUG-10 & BUG-11: VehicleAccountView resolves bidirectional linkedLoan and subtracts baseline mileage in lease tracker', () => {
  const vehicle: Account = {
    id: 'veh-1',
    name: 'Family EV',
    type: 'Vehicle',
    balance: 35000,
    currency: 'EUR',
    linkedLoanId: 'loan-car',
    ownership: 'Leased',
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2027-01-01',
    annualMileageAllowance: 15000,
    mileageLogs: [
      { id: 'm1', date: '2026-01-01', reading: 50000 }, // Purchased/leased at 50,000 km
      { id: 'm2', date: '2026-07-02', reading: 57500 }, // Driven 7,500 km in 6 months
    ],
  };
  const carLoan: Account = {
    id: 'loan-car',
    name: 'Auto Loan',
    type: 'Loan',
    balance: -20000,
    currency: 'EUR',
  };

  const metrics = computeVehicleAccountMetrics(
    vehicle,
    [vehicle, carLoan],
    [],
    {},
    { referenceDate: new Date(2026, 6, 2) }
  );

  assert.equal(metrics.linkedLoan?.id, 'loan-car');
  assertClose(metrics.outstandingLoanBalance, 20000);
  assertClose(metrics.leaseStats?.drivenMileage ?? 0, 7500, 1);
  assert.equal(metrics.leaseStats?.mileageStatus, 'On Track');
});

test('BUG-12: CashAccountView computes burnRateMessage using a rolling 30-day window rather than MTD', () => {
  const cash: Account = {
    id: 'cash-1',
    name: 'Wallet',
    type: 'Other Assets',
    otherSubType: 'Cash',
    balance: 300,
    currency: 'EUR',
  };
  const txs: Transaction[] = [
    {
      id: 'tx-prev-month',
      accountId: 'cash-1',
      date: '2026-05-20',
      description: 'Groceries',
      amount: -300,
      category: 'Food',
      type: 'expense',
      currency: 'EUR',
    },
  ];

  // On June 1st, MTD outflow is 0, but rolling 30d outflow is 300 (10/day -> 30 days left)
  const metrics = computeCashAccountMetrics(cash, txs, {
    referenceDate: new Date(2026, 5, 1),
  });

  assert.equal(metrics.totalOutflow, 0);
  assertClose(metrics.rolling30dOutflow, 300);
  assert.equal(metrics.burnRateMessage, '~30 days runway');
});

test('BUG-13: CreditCardAccountView handles positive credit balances with 0% utilization and full available credit', () => {
  const cc: Account = {
    id: 'cc-pos',
    name: 'Refunded Card',
    type: 'Credit Card',
    balance: 150, // Overpaid by 150
    creditLimit: 2000,
    currency: 'EUR',
  };

  const metrics = computeCreditCardAccountMetrics(cc, []);
  assert.equal(metrics.balanceOwed, 0);
  assert.equal(metrics.creditBalance, 150);
  assert.equal(metrics.utilization, 0);
  assert.equal(metrics.availableCredit, 2150);
});

test('BUG-14: PensionAccountView computes true CAGR instead of cumulative return and matches dividend/interest exclusions consistently', () => {
  const pension: Account = {
    id: 'pen-1',
    name: 'State Pension',
    type: 'Investment',
    subType: 'Pension Fund',
    balance: 12100,
    apy: 6,
    currency: 'EUR',
    openingDate: '2024-06-15',
    expectedRetirementYear: 2046,
  };
  const txs: Transaction[] = [
    {
      id: 't1',
      accountId: 'pen-1',
      date: '2024-06-15',
      description: 'Contribution',
      amount: 10000,
      category: 'Retirement',
      type: 'income',
      currency: 'EUR',
    },
    {
      id: 't2',
      accountId: 'pen-1',
      date: '2025-06-15',
      description: 'Dividend Reinvestment',
      amount: 2100,
      category: 'Dividend Income',
      type: 'income',
      currency: 'EUR',
    },
  ];

  const metrics = computePensionAccountMetrics(pension, txs, {
    referenceDate: new Date(2026, 5, 15), // ~2 years
  });

  assertClose(metrics.totalContributions, 10000);
  assertClose(metrics.totalGrowth, 2100);
  // Cumulative return is 21%, but 2-year CAGR is ~10% (0.10)
  assertClose(metrics.annualizedReturn, 0.1, 0.01);
});

test('BUG-15: SpareChangeAccountView excludes manual lump-sum deposits from round-up count and average', () => {
  const spare: Account = {
    id: 'sp-1',
    name: 'Spare Change',
    type: 'Investment',
    subType: 'Spare Change',
    balance: 501.3,
    currency: 'EUR',
  };
  const txs: Transaction[] = [
    {
      id: 'r1',
      accountId: 'sp-1',
      date: '2026-06-02',
      description: 'Round-up from Coffee',
      amount: 0.5,
      category: 'Savings',
      type: 'income',
      currency: 'EUR',
    },
    {
      id: 'r2',
      accountId: 'sp-1',
      date: '2026-06-03',
      description: 'Round-up from Bakery',
      amount: 0.8,
      category: 'Savings',
      type: 'income',
      currency: 'EUR',
    },
    {
      id: 'lump',
      accountId: 'sp-1',
      date: '2026-06-05',
      description: 'Manual Deposit',
      amount: 500,
      category: 'Transfer',
      type: 'income',
      currency: 'EUR',
    },
  ];

  const metrics = computeSpareChangeAccountMetrics(spare, [spare], txs, {
    referenceDate: new Date(2026, 5, 15),
  });

  assert.equal(metrics.totalRoundUps, 2);
  assertClose(metrics.totalSaved, 1.3);
  assertClose(metrics.avgRoundUp, 0.65);
  assertClose(metrics.biggestRoundUp, 0.8);
  assertClose(metrics.manualDepositsTotal, 500);
});

test('BUG-10: PropertyAccountView converts foreign-currency linked loan and counts un-itemized loan payments', () => {
  const prop: Account = {
    id: 'prop-1',
    name: 'Apartment',
    type: 'Property',
    balance: 400000,
    purchasePrice: 350000,
    currency: 'EUR',
    linkedLoanId: 'loan-simple',
  };
  const simpleLoan: Account = {
    id: 'loan-simple',
    name: 'Private Family Loan',
    type: 'Loan',
    balance: -80000,
    principalAmount: 100000,
    downPayment: 50000,
    currency: 'EUR',
  };
  const txs: Transaction[] = [
    {
      id: 'pay-1',
      accountId: 'loan-simple',
      date: '2026-03-01',
      description: 'Repayment (no principalAmount field set)',
      amount: 20000,
      category: 'Loan Payment',
      type: 'income',
      currency: 'EUR',
    },
  ];

  const metrics = computePropertyAccountMetrics(prop, [prop, simpleLoan], txs, {});
  assertClose(metrics.principalPaidViaLoan, 20000);
  assertClose(metrics.investedEquity, 70000);
});

test('Phase 1 Archetypes: resolveAccountArchetype, Operating safe-to-spend, Compounding estimator, Loan simulator, Property cashflow, Vehicle TCO/mileage, and 3-of-4 Loan solver', () => {
  assert.equal(resolveAccountArchetype({ id: '1', name: 'C', type: 'Checking', balance: 0, currency: 'EUR' }), 'operating');
  assert.equal(resolveAccountArchetype({ id: '2', name: 'S', type: 'Savings', balance: 0, currency: 'EUR' }), 'yield_pot');
  assert.equal(resolveAccountArchetype({ id: '3', name: 'P', type: 'Investment', subType: 'Pension Fund', balance: 0, currency: 'EUR' }), 'yield_pot');
  assert.equal(resolveAccountArchetype({ id: '4', name: 'CC', type: 'Credit Card', balance: 0, currency: 'EUR' }), 'credit_card');
  assert.equal(resolveAccountArchetype({ id: '5', name: 'L', type: 'Loan', balance: 0, currency: 'EUR' }), 'loan');
  assert.equal(resolveAccountArchetype({ id: '6', name: 'V', type: 'Vehicle', balance: 0, currency: 'EUR' }), 'physical_asset');

  // Operating safe-to-spend with 14d upcoming bill
  const checking: Account = { id: 'chk-1', name: 'Main Checking', type: 'Checking', balance: 2500, currency: 'EUR' };
  const opMetrics = computeOperatingAccountMetrics(checking, [checking], [], {
    referenceDate: new Date(2026, 5, 10),
    billsAndPayments: [
      {
        id: 'b1',
        description: 'Electricity Bill',
        amount: -150,
        type: 'payment',
        dueDate: '2026-06-15',
        status: 'unpaid',
        accountId: 'chk-1',
        currency: 'EUR',
      },
    ],
  });
  assertClose(opMetrics.safeToSpend, 2350);
  assert.equal(opMetrics.upcomingPayments.length, 1);

  // Compounding projection
  const comp = computeCompoundingProjection({ initialBalance: 10000, monthlyDeposit: 200, apy: 5, years: 10 });
  assertClose(comp.totalPrincipal, 34000);
  assert.ok(comp.totalInterestEarned > 13000);
  assert.equal(comp.yearlySeries.length, 10);

  // Loan metrics & Extra Payment Simulator
  const loan: Account = {
    id: 'ln-sim',
    name: 'Mortgage',
    type: 'Loan',
    balance: -100000,
    principalAmount: 100000,
    interestRate: 5.0,
    duration: 120,
    loanStartDate: '2026-01-01',
    currency: 'EUR',
  };
  const loanMetrics = computeLoanAccountMetrics(loan, [loan], []);
  assert.equal(loanMetrics.schedule.length, 120);
  const sim = simulateExtraLoanPayment(loan, [], {}, 250, 5000);
  assert.ok(sim.monthsSaved > 20);
  assert.ok(sim.interestSaved > 5000);

  // Property holding cashflow
  const propCash = computePropertyHoldingCashflow({
    id: 'pr-1',
    name: 'Rental Flat',
    type: 'Property',
    balance: 300000,
    currency: 'EUR',
    rentalIncomeAmount: 1500,
    rentalIncomeFrequency: 'monthly',
    propertyTaxAmount: 1800,
    insuranceAmount: 600,
    insuranceFrequency: 'yearly',
    hoaFeeAmount: 200,
    hoaFeeFrequency: 'monthly',
  });
  assertClose(propCash.annualRentalIncome, 18000);
  assertClose(propCash.totalAnnualExpenses, 4800);
  assertClose(propCash.annualNetCashflow, 13200);
  assertClose(propCash.netRentalYieldPct, 4.4);

  // Vehicle TCO & Mileage Logbook helpers
  const veh: Account = {
    id: 'v-tco',
    name: 'Roadster',
    type: 'Vehicle',
    balance: 25000,
    purchasePrice: 30000,
    currency: 'EUR',
    mileageLogs: [
      { id: 'l1', date: '2026-01-01', reading: 10000 },
      { id: 'l2', date: '2026-01-11', reading: 11000 },
    ],
  };
  const vTco = computeVehicleTcoMetrics(veh, [
    { id: 'vt1', accountId: 'v-tco', date: '2026-01-05', description: 'Shell Fuel', amount: -200, category: 'Fuel', type: 'expense', currency: 'EUR' },
  ]);
  assertClose(vTco.depreciation, 5000);
  assertClose(vTco.fuelSpend, 200);
  assertClose(vTco.costPerKm ?? 0, 5.2);

  const enrichedLogs = enrichMileageLogsWithDeltas(veh.mileageLogs);
  assert.equal(enrichedLogs[1].deltaKm, 1000);
  assert.equal(enrichedLogs[1].daysElapsed, 10);
  assertClose(enrichedLogs[1].kmPerDay, 100);

  assert.equal(validateMileageReading(veh.mileageLogs || [], '2026-01-05', 9500).valid, false);
  assert.equal(validateMileageReading(veh.mileageLogs || [], '2026-01-05', 10500).valid, true);

  const parsedBatch = parseBatchMileageInput('2026-02-01, 12000\n2026-03-01\t13,500');
  assert.equal(parsedBatch.length, 2);
  assert.equal(parsedBatch[0].valid, true);
  assert.equal(parsedBatch[1].reading, 13500);

  // 3-of-4 Loan Solver
  const solvedPayment = solveLoanParameter({ principal: 100000, annualRate: 5, durationMonths: 120 }, 'monthlyPayment');
  assertClose(solvedPayment ?? 0, 1060.66, 0.05);
  const solvedPrincipal = solveLoanParameter({ monthlyPayment: 1060.66, annualRate: 5, durationMonths: 120 }, 'principal');
  assertClose(solvedPrincipal ?? 0, 100000, 2);
  const solvedDuration = solveLoanParameter({ principal: 100000, annualRate: 5, monthlyPayment: 1060.66 }, 'durationMonths');
  assert.equal(solvedDuration, 120);
  const solvedRate = solveLoanParameter({ principal: 100000, durationMonths: 120, monthlyPayment: 1060.66 }, 'annualRate');
  assertClose(solvedRate ?? 0, 5, 0.05);
});


import { v4 as uuidv4 } from 'uuid';
import { ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';
import type { Account, AccountType, Currency, FuelType, InvestmentSubType, MileageLog, OtherAssetSubType, OtherLiabilitySubType, PropertyType, RecurrenceFrequency, VehicleOwnership } from '../types';
import { toLocalISOString } from '../utils';

/** Text and number fields, held as typed. Each name matches the `Account` field it saves to. */
const TEXT_FIELDS = [
  'name', 'financialInstitution', 'accountNumber', 'routingNumber', 'openingDate', 'last4', 'expirationDate', 'cardNetwork', 'cardholderName',
  'symbol', 'location', 'assetCondition', 'counterparty', 'notes', 'make', 'model', 'licensePlate', 'registrationCountryCode', 'vin', 'purchaseDate',
  'leaseProvider', 'leaseStartDate', 'leaseEndDate', 'leasePaymentAccountId', 'address', 'propertyTaxDate', 'insuranceProvider', 'insurancePolicyNumber',
  'insurancePaymentDate', 'linkedAccountId', 'linkedAssetId', 'linkedLoanId', 'settlementAccountId', 'loanStartDate',
] as const;

const NUMBER_FIELDS = [
  'balance', 'apy', 'expectedRetirementYear', 'totalAmount', 'principalAmount', 'interestAmount', 'downPayment', 'duration', 'interestRate', 'monthlyPayment',
  'paymentDayOfMonth', 'year', 'purchasePrice', 'annualMileageAllowance', 'leasePaymentAmount', 'leasePaymentDay', 'statementStartDate', 'paymentDate', 'creditLimit',
  'principalOwned', 'propertySize', 'yearBuilt', 'floors', 'bedrooms', 'bathrooms', 'indoorParkingSpaces', 'outdoorParkingSpaces', 'gardenSize', 'terraceSize',
  'propertyTaxAmount', 'insuranceAmount', 'hoaFeeAmount', 'rentalIncomeAmount',
] as const;

const SWITCH_FIELDS = ['isPrimary', 'hasBasement', 'hasAttic', 'hasGarden', 'hasTerrace', 'isRental'] as const;

export type TextField = (typeof TEXT_FIELDS)[number] | (typeof NUMBER_FIELDS)[number] | 'currentMileage';
export type SwitchField = (typeof SWITCH_FIELDS)[number] | 'includeInAnalytics' | 'hasCard';

export type AccountDraft = Record<TextField, string> & Record<SwitchField, boolean> & {
  type: AccountType;
  currency: Currency;
  icon: string;
  subType: InvestmentSubType;
  otherAssetSubType: OtherAssetSubType;
  otherLiabilitySubType: OtherLiabilitySubType;
  fuelType: FuelType;
  vehicleOwnership: VehicleOwnership;
  propertyType: PropertyType;
  insuranceFrequency: RecurrenceFrequency;
  hoaFeeFrequency: RecurrenceFrequency;
  rentalIncomeFrequency: RecurrenceFrequency;
  vehicleImage: string;
  mileageLogs: MileageLog[];
};

export const defaultIcon = (draft: Pick<AccountDraft, 'type' | 'subType' | 'otherAssetSubType' | 'otherLiabilitySubType'>) => {
  if (draft.type === 'Investment') return INVESTMENT_SUB_TYPE_STYLES[draft.subType]?.icon || ACCOUNT_TYPE_STYLES.Investment.icon;
  if (draft.type === 'Other Assets') return OTHER_ASSET_SUB_TYPE_STYLES[draft.otherAssetSubType]?.icon || ACCOUNT_TYPE_STYLES['Other Assets'].icon;
  if (draft.type === 'Other Liabilities') return OTHER_LIABILITY_SUB_TYPE_STYLES[draft.otherLiabilitySubType]?.icon || ACCOUNT_TYPE_STYLES['Other Liabilities'].icon;
  return ACCOUNT_TYPE_STYLES[draft.type]?.icon || 'wallet';
};

export const emptyDraft = (type: AccountType = 'Checking'): AccountDraft => {
  const draft = {
    ...Object.fromEntries(TEXT_FIELDS.map(field => [field, ''])),
    ...Object.fromEntries(NUMBER_FIELDS.map(field => [field, ''])),
    ...Object.fromEntries(SWITCH_FIELDS.map(field => [field, false])),
    balance: '0',
    currentMileage: '',
    loanStartDate: toLocalISOString(new Date()),
    includeInAnalytics: true,
    hasCard: type === 'Credit Card',
    type,
    currency: 'EUR',
    subType: 'Stock',
    otherAssetSubType: 'Other',
    otherLiabilitySubType: 'Other',
    fuelType: 'Gasoline',
    vehicleOwnership: 'Owned',
    propertyType: 'Detached House',
    insuranceFrequency: 'yearly',
    hoaFeeFrequency: 'monthly',
    rentalIncomeFrequency: 'monthly',
    vehicleImage: '',
    mileageLogs: [],
  } as unknown as AccountDraft;
  return { ...draft, icon: defaultIcon(draft) };
};

export const draftFromAccount = (account: Account): AccountDraft => {
  // A legacy 'Crypto' type becomes an Investment with that sub-type.
  const isLegacyCrypto = (account.type as string) === 'Crypto';
  const record = account as unknown as Record<string, unknown>;
  const draft = emptyDraft(isLegacyCrypto ? 'Investment' : account.type);

  [...TEXT_FIELDS, ...NUMBER_FIELDS].forEach(field => { draft[field] = record[field] != null ? String(record[field]) : field === 'loanStartDate' ? draft[field] : ''; });
  SWITCH_FIELDS.forEach(field => { draft[field] = !!record[field]; });

  const logs = account.mileageLogs ?? [];
  return {
    ...draft,
    balance: String(account.balance),
    currency: account.currency,
    icon: account.icon || ACCOUNT_TYPE_STYLES[account.type]?.icon || 'wallet',
    includeInAnalytics: account.includeInAnalytics ?? true,
    hasCard: !!(account.cardNetwork || account.last4 || account.expirationDate || account.cardholderName || account.type === 'Credit Card'),
    subType: isLegacyCrypto ? 'Crypto' : account.subType || 'Stock',
    otherAssetSubType: (account.otherSubType as OtherAssetSubType) || 'Other',
    otherLiabilitySubType: (account.otherSubType as OtherLiabilitySubType) || 'Other',
    fuelType: account.fuelType || draft.fuelType,
    vehicleOwnership: account.ownership || draft.vehicleOwnership,
    propertyType: account.propertyType || draft.propertyType,
    insuranceFrequency: account.insuranceFrequency || draft.insuranceFrequency,
    hoaFeeFrequency: account.hoaFeeFrequency || draft.hoaFeeFrequency,
    rentalIncomeFrequency: account.rentalIncomeFrequency || draft.rentalIncomeFrequency,
    vehicleImage: account.imageUrl || '',
    mileageLogs: logs,
    currentMileage: logs.length ? String(Math.max(...logs.map(log => log.reading))) : '',
  };
};

/** Total, principal and interest reconcile: change one, and the third follows. */
export const reconcileLoan = (draft: AccountDraft, field: 'totalAmount' | 'principalAmount' | 'interestAmount', value: string): AccountDraft => {
  const next = { ...draft, [field]: value };
  const total = parseFloat(next.totalAmount);
  const principal = parseFloat(next.principalAmount);
  const interest = parseFloat(next.interestAmount);
  if (field === 'totalAmount') {
    if (!isNaN(total) && !isNaN(principal)) next.interestAmount = (total - principal).toFixed(2);
  } else if (!isNaN(principal) && !isNaN(interest)) {
    next.totalAmount = (principal + interest).toFixed(2);
  }
  return next;
};

const num = (value: string) => (value !== '' ? parseFloat(value) : undefined);
const int = (value: string) => (value !== '' ? parseInt(value, 10) : undefined);
const text = (value: string) => value.trim() || undefined;

/** Adds today's odometer reading to the log when it differs from the latest one. */
const withCurrentMileage = (draft: AccountDraft): MileageLog[] => {
  const reading = parseInt(draft.currentMileage, 10);
  if (isNaN(reading)) return draft.mileageLogs;
  const latest = draft.mileageLogs.reduce<number | undefined>((max, log) => (max === undefined || log.reading > max ? log.reading : max), undefined);
  if (latest === reading) return draft.mileageLogs;
  return [...draft.mileageLogs, { id: `log-${uuidv4()}`, date: toLocalISOString(new Date()), reading }];
};

interface BuildOptions {
  /** The account being edited, whose other fields are kept. */
  base?: Account;
  /** Warrant accounts take their balance from prices, so the form can't change it. */
  isComputed?: boolean;
}

export function buildAccount(draft: AccountDraft, { base, isComputed }: BuildOptions = {}): Omit<Account, 'id'> & { id?: string } {
  const { type, hasCard } = draft;
  const isLeased = draft.vehicleOwnership === 'Leased';
  const isOwned = draft.vehicleOwnership === 'Owned';
  const isLoanLinked = type === 'Property' && !!draft.linkedLoanId;
  const principal = num(draft.principalAmount) ?? 0;
  const balance = type === 'Loan' ? -Math.abs(principal)
    : type === 'Lending' ? Math.abs(principal)
    : isComputed && base ? base.balance
    : num(draft.balance) ?? 0;

  return {
    ...base,
    name: draft.name.trim(),
    type,
    balance,
    currency: draft.currency,
    icon: draft.icon,
    notes: text(draft.notes),
    last4: hasCard && draft.last4 ? draft.last4 : undefined,
    financialInstitution: ['Checking', 'Savings', 'Credit Card'].includes(type) ? text(draft.financialInstitution) : undefined,
    isPrimary: draft.isPrimary,
    includeInAnalytics: draft.includeInAnalytics,
    accountNumber: text(draft.accountNumber),
    routingNumber: text(draft.routingNumber),
    apy: num(draft.apy),
    openingDate: draft.openingDate || undefined,
    expirationDate: hasCard && draft.expirationDate ? draft.expirationDate : undefined,
    cardNetwork: hasCard && draft.cardNetwork ? draft.cardNetwork : undefined,
    cardholderName: hasCard ? text(draft.cardholderName) : undefined,

    ...(type === 'Investment' && {
      subType: draft.subType,
      symbol: draft.symbol ? draft.symbol.trim().toUpperCase() : undefined,
      expectedRetirementYear: draft.subType === 'Pension Fund' ? int(draft.expectedRetirementYear) : undefined,
      linkedAccountId: draft.subType === 'Spare Change' ? draft.linkedAccountId || undefined : undefined,
    }),
    ...(type === 'Other Assets' && {
      otherSubType: draft.otherAssetSubType,
      location: text(draft.location),
      assetCondition: text(draft.assetCondition),
      counterparty: text(draft.counterparty),
    }),
    ...(type === 'Other Liabilities' && {
      otherSubType: draft.otherLiabilitySubType,
      counterparty: text(draft.counterparty),
      interestRate: num(draft.interestRate),
    }),
    ...((type === 'Loan' || type === 'Lending') && {
      totalAmount: num(draft.totalAmount),
      principalAmount: num(draft.principalAmount),
      interestAmount: num(draft.interestAmount),
      duration: int(draft.duration),
      interestRate: num(draft.interestRate),
      loanStartDate: draft.loanStartDate,
      monthlyPayment: num(draft.monthlyPayment),
      paymentDayOfMonth: int(draft.paymentDayOfMonth),
      linkedAccountId: draft.linkedAccountId || undefined,
      linkedAssetId: draft.linkedAssetId || undefined,
    }),
    ...(type === 'Loan' && { downPayment: num(draft.downPayment) }),

    make: type === 'Vehicle' ? text(draft.make) : undefined,
    model: type === 'Vehicle' ? text(draft.model) : undefined,
    year: type === 'Vehicle' ? int(draft.year) : undefined,
    licensePlate: type === 'Vehicle' ? text(draft.licensePlate) : undefined,
    registrationCountryCode: type === 'Vehicle' ? text(draft.registrationCountryCode) : undefined,
    vin: type === 'Vehicle' ? text(draft.vin) : undefined,
    fuelType: type === 'Vehicle' ? draft.fuelType : undefined,
    ownership: type === 'Vehicle' ? draft.vehicleOwnership : undefined,
    purchaseDate: type === 'Vehicle' && isOwned ? draft.purchaseDate || undefined : undefined,
    leaseProvider: type === 'Vehicle' && isLeased ? text(draft.leaseProvider) : undefined,
    leaseStartDate: type === 'Vehicle' && isLeased ? draft.leaseStartDate || undefined : undefined,
    leaseEndDate: type === 'Vehicle' && isLeased ? draft.leaseEndDate || undefined : undefined,
    annualMileageAllowance: type === 'Vehicle' && isLeased ? int(draft.annualMileageAllowance) : undefined,
    leasePaymentAmount: type === 'Vehicle' && isLeased ? num(draft.leasePaymentAmount) : undefined,
    leasePaymentDay: type === 'Vehicle' && isLeased ? int(draft.leasePaymentDay) : undefined,
    leasePaymentAccountId: type === 'Vehicle' && isLeased ? draft.leasePaymentAccountId || undefined : undefined,
    imageUrl: type === 'Vehicle' ? draft.vehicleImage || undefined : undefined,
    mileageLogs: type === 'Vehicle' ? withCurrentMileage(draft) : undefined,

    ...(type === 'Vehicle' && { purchasePrice: num(draft.purchasePrice) }),
    ...(type === 'Property' && {
      address: text(draft.address),
      propertyType: draft.propertyType,
      purchasePrice: isLoanLinked ? undefined : num(draft.purchasePrice),
      principalOwned: isLoanLinked ? undefined : num(draft.principalOwned),
      linkedLoanId: draft.linkedLoanId || undefined,
      propertySize: num(draft.propertySize),
      yearBuilt: int(draft.yearBuilt),
      floors: int(draft.floors),
      bedrooms: int(draft.bedrooms),
      bathrooms: int(draft.bathrooms),
      hasBasement: draft.hasBasement,
      hasAttic: draft.hasAttic,
      indoorParkingSpaces: int(draft.indoorParkingSpaces),
      outdoorParkingSpaces: int(draft.outdoorParkingSpaces),
      hasGarden: draft.hasGarden,
      gardenSize: draft.hasGarden ? num(draft.gardenSize) : undefined,
      hasTerrace: draft.hasTerrace,
      terraceSize: draft.hasTerrace ? num(draft.terraceSize) : undefined,
      propertyTaxAmount: num(draft.propertyTaxAmount),
      propertyTaxDate: draft.propertyTaxDate || undefined,
      insuranceProvider: text(draft.insuranceProvider),
      insurancePolicyNumber: text(draft.insurancePolicyNumber),
      insuranceAmount: num(draft.insuranceAmount),
      insuranceFrequency: draft.insuranceFrequency,
      insurancePaymentDate: draft.insurancePaymentDate || undefined,
      hoaFeeAmount: num(draft.hoaFeeAmount),
      hoaFeeFrequency: draft.hoaFeeFrequency,
      isRental: draft.isRental,
      rentalIncomeAmount: draft.isRental ? num(draft.rentalIncomeAmount) : undefined,
      rentalIncomeFrequency: draft.isRental ? draft.rentalIncomeFrequency : undefined,
    }),
    ...(type === 'Credit Card' && {
      statementStartDate: int(draft.statementStartDate),
      paymentDate: int(draft.paymentDate),
      settlementAccountId: draft.settlementAccountId || undefined,
      creditLimit: num(draft.creditLimit),
    }),
  };
}

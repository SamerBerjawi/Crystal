import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type {
  Account,
  AccountType,
  Currency,
  FuelType,
  InvestmentSubType,
  OtherAssetSubType,
  OtherLiabilitySubType,
  PropertyType,
  VehicleOwnership,
} from '../../../types';
import { solveLoanParameter } from '../../../utils/accountDetailModel';
import { currencySign, formatCurrency, normalizeCurrency, toLocalISOString } from '../../../utils';
import { AmountPad } from '../../kokonutui/amount-pad';
import { Drawer, useMediaQuery } from '../Drawer';
import { NvIcon, type NvIconName } from '../NvIcon';
import { toast } from '../toast';
import { Button, SegmentedTabs, Switch } from '../ui';

/*
 * AccountFormSheet: Unified Add / Edit Account Drawer for `/accounts-new` and `/accounts-new/:id`.
 * Supports all 10 AccountType values and includes the interactive 3-of-4 Loan Auto-Calculator.
 * Strictly adheres to `nv-*` tokens and imports zero classic UI or `constants`.
 */

const CURRENCY_OPTIONS: Currency[] = ['EUR', 'USD', 'GBP', 'RON', 'BTC'];

const ACCOUNT_TYPE_OPTIONS: {
  type: AccountType;
  label: string;
  subtitle: string;
  icon: NvIconName;
  group: 'liquid' | 'credit_debt' | 'wealth_physical';
}[] = [
  { type: 'Checking', label: 'Checking', subtitle: 'Everyday bank & debit', icon: 'bank', group: 'liquid' },
  { type: 'Savings', label: 'Savings', subtitle: 'APY reserve & emergency', icon: 'piggy', group: 'liquid' },
  { type: 'Credit Card', label: 'Credit card', subtitle: 'Revolving limit & cycle', icon: 'card', group: 'credit_debt' },
  { type: 'Loan', label: 'Loan / mortgage', subtitle: 'Amortized or fixed debt', icon: 'invoice', group: 'credit_debt' },
  { type: 'Lending', label: 'Lending', subtitle: 'Money owed to you', icon: 'transactions', group: 'credit_debt' },
  { type: 'Property', label: 'Property', subtitle: 'Real estate & equity', icon: 'home', group: 'wealth_physical' },
  { type: 'Vehicle', label: 'Vehicle', subtitle: 'Owned or leased', icon: 'pin', group: 'wealth_physical' },
  { type: 'Investment', label: 'Pension / round-up', subtitle: 'Pension fund or spare change', icon: 'investments', group: 'wealth_physical' },
  { type: 'Other Assets', label: 'Other asset', subtitle: 'Physical cash, metals, etc.', icon: 'wallet', group: 'wealth_physical' },
  { type: 'Other Liabilities', label: 'Other liability', subtitle: 'Informal debt or tax', icon: 'warning', group: 'credit_debt' },
];

const CARD_NETWORKS: string[] = ['Visa', 'Mastercard', 'Amex', 'Discover', 'Other'];
const PROPERTY_TYPES: PropertyType[] = [
  'Apartment',
  'Detached House',
  'Semi-Detached House',
  'Terraced House',
  'Commercial',
  'Land',
  'Other',
];
const VEHICLE_OWNERSHIP_TYPES: VehicleOwnership[] = ['Owned', 'Leased'];
const FUEL_TYPES: FuelType[] = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'LPG'];
const OTHER_ASSET_SUBTYPES: OtherAssetSubType[] = [
  'Cash',
  'Meal Voucher',
  'Precious Metals',
  'Collectibles',
  'Art',
  'Business Equity',
  'Private Loan',
  'Electronics',
  'Furniture',
  'Other',
];
const OTHER_LIABILITY_SUBTYPES: OtherLiabilitySubType[] = [
  'Private Debt',
  'Tax',
  'Legal Settlement',
  'Business Debt',
  'Other',
];


const FieldLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="mb-1.5 flex items-center justify-between gap-2">
    <label className="text-[13px] font-medium text-nv-muted">{children}</label>
    {hint && <span className="text-xs text-nv-faint">{hint}</span>}
  </div>
);

const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input
    {...props}
    className={cn(
      'h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-[15px] text-nv-ink placeholder:text-nv-faint outline-none transition-colors focus:border-nv-violet',
      className
    )}
  />
);

const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select
    {...props}
    className={cn(
      'h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-[15px] text-nv-ink outline-none transition-colors focus:border-nv-violet',
      className
    )}
  >
    {children}
  </select>
);

export interface AccountFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccount?: Account | null;
  defaultType?: AccountType;
  accounts: Account[];
  defaultCurrency: Currency;
  onSave: (draft: Omit<Account, 'id'> & { id?: string }) => {
    created: boolean;
    id: string;
    undo?: () => void;
  };
  onDelete?: (accountId: string) => void;
}

type LoanSolveTarget = 'monthlyPayment' | 'principal' | 'durationMonths' | 'annualRate';

export const AccountFormSheet: React.FC<AccountFormSheetProps> = ({
  open,
  onOpenChange,
  editingAccount,
  defaultType = 'Checking',
  accounts,
  defaultCurrency,
  onSave,
}) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const isEditing = !!editingAccount;

  // Core fields
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(defaultType);
  const [currency, setCurrency] = useState<Currency>(normalizeCurrency(defaultCurrency));
  const [balanceStr, setBalanceStr] = useState('0');
  const [isNegativeBalance, setIsNegativeBalance] = useState(false);
  const [institution, setInstitution] = useState('');
  const [website, setWebsite] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [last4, setLast4] = useState('');
  const [cardNetwork, setCardNetwork] = useState<string>('Visa');
  const [cardholderName, setCardholderName] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [includeInAnalytics, setIncludeInAnalytics] = useState(true);
  const [notes, setNotes] = useState('');

  // Savings / Investment fields
  const [apyStr, setApyStr] = useState('');
  const [subType, setSubType] = useState<InvestmentSubType>('Pension Fund');
  const [retirementTargetYearStr, setRetirementTargetYearStr] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');

  // Credit Card fields
  const [creditLimitStr, setCreditLimitStr] = useState('');
  const [interestRateStr, setInterestRateStr] = useState('');
  const [statementStartDayStr, setStatementStartDayStr] = useState('1');
  const [paymentDueDayStr, setPaymentDueDayStr] = useState('15');
  const [settlementAccountId, setSettlementAccountId] = useState('');

  // Loan / Lending fields + 3-of-4 solver
  const [principalStr, setPrincipalStr] = useState('');
  const [durationStr, setDurationStr] = useState('60');
  const [monthlyPaymentStr, setMonthlyPaymentStr] = useState('');
  const [downPaymentStr, setDownPaymentStr] = useState('');
  const [loanStartDate, setLoanStartDate] = useState(() => toLocalISOString(new Date()));
  const [paymentDayOfMonthStr, setPaymentDayOfMonthStr] = useState('1');
  const [linkedAssetId, setLinkedAssetId] = useState('');
  const [solveTarget, setSolveTarget] = useState<LoanSolveTarget>('monthlyPayment');

  // Property fields
  const [propertyType, setPropertyType] = useState<PropertyType>('Apartment');
  const [address, setAddress] = useState('');
  const [purchasePriceStr, setPurchasePriceStr] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [propertySizeStr, setPropertySizeStr] = useState('');
  const [linkedLoanId, setLinkedLoanId] = useState('');
  const [rentalIncomeStr, setRentalIncomeStr] = useState('');
  const [propertyTaxStr, setPropertyTaxStr] = useState('');
  const [insuranceStr, setInsuranceStr] = useState('');
  const [hoaFeeStr, setHoaFeeStr] = useState('');

  // Vehicle fields
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [yearStr, setYearStr] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [registrationCountryCode, setRegistrationCountryCode] = useState('BE');
  const [vin, setVin] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasoline');
  const [currentMileageStr, setCurrentMileageStr] = useState('');
  const [ownership, setOwnership] = useState<VehicleOwnership>('Owned');
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [leasePaymentStr, setLeasePaymentStr] = useState('');
  const [residualValueStr, setResidualValueStr] = useState('');
  const [annualMileageAllowanceStr, setAnnualMileageAllowanceStr] = useState('15000');

  // Other Assets / Liabilities
  const [otherAssetSubType, setOtherAssetSubType] = useState<OtherAssetSubType>('Cash');
  const [otherLiabilitySubType, setOtherLiabilitySubType] = useState<OtherLiabilitySubType>('Private Debt');
  const [counterparty, setCounterparty] = useState('');

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        toast.success('Image loaded from disk');
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!open) return;
    if (editingAccount) {
      setName(editingAccount.name);
      setType(editingAccount.type);
      setCurrency(normalizeCurrency(editingAccount.currency));
      const rawBal = editingAccount.balance || 0;
      setBalanceStr(String(Math.abs(rawBal)));
      setIsNegativeBalance(
        rawBal < 0 || editingAccount.type === 'Credit Card' || editingAccount.type === 'Loan' || editingAccount.type === 'Other Liabilities'
      );
      setInstitution(editingAccount.financialInstitution || '');
      setWebsite(editingAccount.website || '');
      setImageUrl(editingAccount.imageUrl || '');
      setAccountNumber(editingAccount.accountNumber || '');
      setRoutingNumber(editingAccount.routingNumber || '');
      setOpeningDate(editingAccount.openingDate || '');
      setLast4(editingAccount.last4 || '');
      setCardNetwork(editingAccount.cardNetwork || 'Visa');
      setCardholderName(editingAccount.cardholderName || '');
      setExpirationDate(editingAccount.expirationDate || '');
      setIsPrimary(!!editingAccount.isPrimary);
      setIncludeInAnalytics(editingAccount.includeInAnalytics ?? true);
      setNotes(editingAccount.notes || '');
      setApyStr(editingAccount.apy !== undefined ? String(editingAccount.apy) : '');
      setSubType(
        editingAccount.subType === 'Spare Change' ? 'Spare Change' : 'Pension Fund'
      );
      setRetirementTargetYearStr(
        editingAccount.expectedRetirementYear !== undefined
          ? String(editingAccount.expectedRetirementYear)
          : ''
      );
      setLinkedAccountId(editingAccount.linkedAccountId || '');
      setCreditLimitStr(
        editingAccount.creditLimit !== undefined ? String(editingAccount.creditLimit) : ''
      );
      setInterestRateStr(
        editingAccount.interestRate !== undefined ? String(editingAccount.interestRate) : ''
      );
      setStatementStartDayStr(String(editingAccount.statementStartDate || 1));
      setPaymentDueDayStr(String(editingAccount.paymentDate || 15));
      setSettlementAccountId(editingAccount.settlementAccountId || '');
      setPrincipalStr(
        editingAccount.principalAmount !== undefined
          ? String(editingAccount.principalAmount)
          : editingAccount.totalAmount !== undefined
            ? String(editingAccount.totalAmount)
            : ''
      );
      setDurationStr(editingAccount.duration !== undefined ? String(editingAccount.duration) : '60');
      setMonthlyPaymentStr(
        editingAccount.monthlyPayment !== undefined ? String(editingAccount.monthlyPayment) : ''
      );
      setDownPaymentStr(
        editingAccount.downPayment !== undefined ? String(editingAccount.downPayment) : ''
      );
      setLoanStartDate(editingAccount.loanStartDate || toLocalISOString(new Date()));
      setPaymentDayOfMonthStr(String(editingAccount.paymentDayOfMonth || 1));
      setLinkedAssetId(editingAccount.linkedAssetId || '');
      setPropertyType(editingAccount.propertyType || 'Apartment');
      setAddress(editingAccount.address || '');
      setPurchasePriceStr(
        editingAccount.purchasePrice !== undefined ? String(editingAccount.purchasePrice) : ''
      );
      setPurchaseDate(editingAccount.purchaseDate || '');
      setPropertySizeStr(
        editingAccount.propertySize !== undefined ? String(editingAccount.propertySize) : ''
      );
      setLinkedLoanId(editingAccount.linkedLoanId || '');
      setRentalIncomeStr(
        editingAccount.rentalIncomeAmount !== undefined ? String(editingAccount.rentalIncomeAmount) : ''
      );
      setPropertyTaxStr(
        editingAccount.propertyTaxAmount !== undefined ? String(editingAccount.propertyTaxAmount) : ''
      );
      setInsuranceStr(
        editingAccount.insuranceAmount !== undefined ? String(editingAccount.insuranceAmount) : ''
      );
      setHoaFeeStr(editingAccount.hoaFeeAmount !== undefined ? String(editingAccount.hoaFeeAmount) : '');
      setMake(editingAccount.make || '');
      setModel(editingAccount.model || '');
      setYearStr(editingAccount.year !== undefined ? String(editingAccount.year) : '');
      setLicensePlate(editingAccount.licensePlate || '');
      setRegistrationCountryCode(editingAccount.registrationCountryCode || 'BE');
      setVin(editingAccount.vin || '');
      setFuelType(editingAccount.fuelType || 'Gasoline');
      const latestLog =
        editingAccount.mileageLogs && editingAccount.mileageLogs.length > 0
          ? editingAccount.mileageLogs[editingAccount.mileageLogs.length - 1].reading
          : undefined;
      setCurrentMileageStr(latestLog !== undefined ? String(latestLog) : '');
      setOwnership(editingAccount.ownership || 'Owned');
      setLeaseStartDate(editingAccount.leaseStartDate || '');
      setLeaseEndDate(editingAccount.leaseEndDate || '');
      setLeasePaymentStr(
        editingAccount.leasePaymentAmount !== undefined ? String(editingAccount.leasePaymentAmount) : ''
      );
      setResidualValueStr(editingAccount.residualValue !== undefined ? String(editingAccount.residualValue) : '');
      setAnnualMileageAllowanceStr(
        editingAccount.annualMileageAllowance !== undefined
          ? String(editingAccount.annualMileageAllowance)
          : '15000'
      );
      if (editingAccount.type === 'Other Assets') {
        setOtherAssetSubType((editingAccount.otherSubType as OtherAssetSubType) || 'Cash');
      } else if (editingAccount.type === 'Other Liabilities') {
        setOtherLiabilitySubType(
          (editingAccount.otherSubType as OtherLiabilitySubType) || 'Private Debt'
        );
      }
      setCounterparty(editingAccount.counterparty || '');
    } else {
      setName('');
      setType(defaultType);
      setCurrency(normalizeCurrency(defaultCurrency));
      setBalanceStr('');
      setIsNegativeBalance(
        defaultType === 'Credit Card' || defaultType === 'Loan' || defaultType === 'Other Liabilities'
      );
      setInstitution('');
      setWebsite('');
      setImageUrl('');
      setAccountNumber('');
      setRoutingNumber('');
      setOpeningDate('');
      setLast4('');
      setCardNetwork('Visa');
      setCardholderName('');
      setExpirationDate('');
      setIsPrimary(false);
      setIncludeInAnalytics(true);
      setNotes('');
      setApyStr('');
      setSubType('Pension Fund');
      setRetirementTargetYearStr('');
      setLinkedAccountId('');
      setCreditLimitStr('');
      setInterestRateStr('');
      setStatementStartDayStr('1');
      setPaymentDueDayStr('15');
      setSettlementAccountId('');
      setPrincipalStr('');
      setDurationStr('60');
      setMonthlyPaymentStr('');
      setDownPaymentStr('');
      setLoanStartDate(toLocalISOString(new Date()));
      setPaymentDayOfMonthStr('1');
      setLinkedAssetId('');
      setPropertyType('Apartment');
      setAddress('');
      setPurchasePriceStr('');
      setPurchaseDate('');
      setPropertySizeStr('');
      setLinkedLoanId('');
      setRentalIncomeStr('');
      setPropertyTaxStr('');
      setInsuranceStr('');
      setHoaFeeStr('');
      setMake('');
      setModel('');
      setYearStr('');
      setLicensePlate('');
      setRegistrationCountryCode('BE');
      setVin('');
      setFuelType('Gasoline');
      setCurrentMileageStr('');
      setOwnership('Owned');
      setLeaseStartDate('');
      setLeaseEndDate('');
      setLeasePaymentStr('');
      setResidualValueStr('');
      setAnnualMileageAllowanceStr('15000');
      setOtherAssetSubType('Cash');
      setOtherLiabilitySubType('Private Debt');
      setCounterparty('');
    }
  }, [open, editingAccount, defaultType, defaultCurrency]);

  // 3-of-4 Loan Auto-Calculator
  const solvedLoanValue = useMemo(() => {
    if (type !== 'Loan' && type !== 'Lending') return null;
    const principal = parseFloat(principalStr) || 0;
    const annualRate = parseFloat(interestRateStr) || 0;
    const durationMonths = parseInt(durationStr, 10) || 0;
    const monthlyPayment = parseFloat(monthlyPaymentStr) || 0;
    return solveLoanParameter(
      { principal, annualRate, durationMonths, monthlyPayment },
      solveTarget
    );
  }, [type, principalStr, interestRateStr, durationStr, monthlyPaymentStr, solveTarget]);

  const applySolvedLoanValue = () => {
    if (solvedLoanValue === null) return;
    if (solveTarget === 'monthlyPayment') setMonthlyPaymentStr(String(solvedLoanValue));
    else if (solveTarget === 'principal') setPrincipalStr(String(solvedLoanValue));
    else if (solveTarget === 'durationMonths') setDurationStr(String(solvedLoanValue));
    else if (solveTarget === 'annualRate') setInterestRateStr(String(solvedLoanValue));
  };

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'Checking' || a.type === 'Savings'),
    [accounts]
  );

  const physicalAssets = useMemo(
    () => accounts.filter((a) => a.type === 'Property' || a.type === 'Vehicle'),
    [accounts]
  );

  const loanAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'Loan'),
    [accounts]
  );

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Please enter an account name');
      return;
    }

    const rawMagnitude = parseFloat(balanceStr || '0') || 0;
    const isDebtType =
      type === 'Credit Card' ||
      type === 'Loan' ||
      type === 'Other Liabilities' ||
      isNegativeBalance;
    const signedBalance =
      rawMagnitude === 0 ? 0 : isDebtType ? -Math.abs(rawMagnitude) : Math.abs(rawMagnitude);

    const draft: Omit<Account, 'id'> & { id?: string } = {
      ...(editingAccount ?? {}),
      id: editingAccount?.id,
      name: trimmedName,
      type,
      currency: normalizeCurrency(currency),
      balance: signedBalance,
      financialInstitution: institution.trim() || undefined,
      website: website.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      routingNumber: routingNumber.trim().toUpperCase() || undefined,
      openingDate: openingDate || undefined,
      last4: last4.trim().slice(-4) || undefined,
      isPrimary,
      includeInAnalytics,
      notes: notes.trim() || undefined,
      status: editingAccount?.status || 'open',
    };

    if (type === 'Checking' || type === 'Savings' || type === 'Credit Card') {
      draft.cardNetwork = cardNetwork;
      draft.cardholderName = cardholderName.trim() || undefined;
      draft.expirationDate = expirationDate.trim() || undefined;
    }

    if (type === 'Savings') {
      const apy = parseFloat(apyStr);
      draft.apy = Number.isFinite(apy) ? apy : undefined;
    }

    if (type === 'Investment') {
      draft.subType = subType;
      if (subType === 'Pension Fund') {
        const apy = parseFloat(apyStr);
        draft.apy = Number.isFinite(apy) ? apy : undefined;
        const retYear = parseInt(retirementTargetYearStr, 10);
        draft.expectedRetirementYear = Number.isFinite(retYear) ? retYear : undefined;
      } else if (subType === 'Spare Change') {
        draft.linkedAccountId = linkedAccountId || undefined;
      }
    }

    if (type === 'Credit Card') {
      const limit = parseFloat(creditLimitStr);
      draft.creditLimit = Number.isFinite(limit) ? limit : undefined;
      const apr = parseFloat(interestRateStr);
      draft.interestRate = Number.isFinite(apr) ? apr : undefined;
      const stmtDay = parseInt(statementStartDayStr, 10);
      draft.statementStartDate = Number.isFinite(stmtDay) ? Math.min(31, Math.max(1, stmtDay)) : 1;
      const dueDay = parseInt(paymentDueDayStr, 10);
      draft.paymentDate = Number.isFinite(dueDay) ? Math.min(31, Math.max(1, dueDay)) : 15;
      draft.settlementAccountId = settlementAccountId || undefined;
    }

    if (type === 'Loan' || type === 'Lending') {
      const effPrincipal =
        solveTarget === 'principal' && solvedLoanValue !== null
          ? solvedLoanValue
          : parseFloat(principalStr);
      const effRate =
        solveTarget === 'annualRate' && solvedLoanValue !== null
          ? solvedLoanValue
          : parseFloat(interestRateStr);
      const effDuration =
        solveTarget === 'durationMonths' && solvedLoanValue !== null
          ? solvedLoanValue
          : parseInt(durationStr, 10);
      const effMonthly =
        solveTarget === 'monthlyPayment' && solvedLoanValue !== null
          ? solvedLoanValue
          : parseFloat(monthlyPaymentStr);
      const downPmt = parseFloat(downPaymentStr);
      const payDay = parseInt(paymentDayOfMonthStr, 10);

      draft.principalAmount = Number.isFinite(effPrincipal) && effPrincipal > 0 ? effPrincipal : undefined;
      draft.totalAmount = draft.principalAmount;
      draft.interestRate = Number.isFinite(effRate) ? effRate : 0;
      draft.duration = Number.isFinite(effDuration) && effDuration > 0 ? effDuration : undefined;
      draft.monthlyPayment = Number.isFinite(effMonthly) && effMonthly > 0 ? effMonthly : undefined;
      draft.downPayment = Number.isFinite(downPmt) && downPmt >= 0 ? downPmt : undefined;
      draft.loanStartDate = loanStartDate || undefined;
      draft.paymentDayOfMonth = Number.isFinite(payDay) ? Math.min(31, Math.max(1, payDay)) : 1;
      draft.linkedAssetId = linkedAssetId || undefined;
      draft.counterparty = counterparty.trim() || undefined;
      if (draft.principalAmount && rawMagnitude === 0) {
        draft.balance = type === 'Loan' ? -draft.principalAmount : draft.principalAmount;
      }
    }

    if (type === 'Property') {
      draft.propertyType = propertyType;
      draft.address = address.trim() || undefined;
      const pp = parseFloat(purchasePriceStr);
      draft.purchasePrice = Number.isFinite(pp) ? pp : undefined;
      draft.purchaseDate = purchaseDate || undefined;
      const sz = parseFloat(propertySizeStr);
      draft.propertySize = Number.isFinite(sz) ? sz : undefined;
      draft.linkedLoanId = linkedLoanId || undefined;
      const rent = parseFloat(rentalIncomeStr);
      draft.rentalIncomeAmount = Number.isFinite(rent) ? rent : undefined;
      draft.rentalIncomeFrequency = 'monthly';
      const pTax = parseFloat(propertyTaxStr);
      draft.propertyTaxAmount = Number.isFinite(pTax) ? pTax : undefined;
      const ins = parseFloat(insuranceStr);
      draft.insuranceAmount = Number.isFinite(ins) ? ins : undefined;
      draft.insuranceFrequency = 'yearly';
      const hoa = parseFloat(hoaFeeStr);
      draft.hoaFeeAmount = Number.isFinite(hoa) ? hoa : undefined;
      draft.hoaFeeFrequency = 'monthly';
      draft.balance = Math.abs(rawMagnitude);
    }

    if (type === 'Vehicle') {
      draft.make = make.trim() || undefined;
      draft.model = model.trim() || undefined;
      const yr = parseInt(yearStr, 10);
      draft.year = Number.isFinite(yr) ? yr : undefined;
      draft.licensePlate = licensePlate.trim().toUpperCase() || undefined;
      draft.registrationCountryCode = registrationCountryCode.trim().toUpperCase() || 'BE';
      draft.vin = vin.trim().toUpperCase() || undefined;
      draft.fuelType = fuelType;
      draft.ownership = ownership;
      const parsedMileage = parseInt(currentMileageStr, 10);
      if (Number.isFinite(parsedMileage) && parsedMileage >= 0) {
        const existingLogs = editingAccount?.mileageLogs ? [...editingAccount.mileageLogs] : [];
        const latestReading =
          existingLogs.length > 0 ? existingLogs[existingLogs.length - 1].reading : null;
        if (latestReading === null) {
          draft.mileageLogs = [
            {
              id: `log-${Date.now()}`,
              date: toLocalISOString(new Date()),
              reading: parsedMileage,
            },
          ];
        } else if (latestReading !== parsedMileage) {
          draft.mileageLogs = [
            ...existingLogs,
            {
              id: `log-${Date.now()}`,
              date: toLocalISOString(new Date()),
              reading: parsedMileage,
            },
          ];
        } else {
          draft.mileageLogs = existingLogs;
        }
      } else if (editingAccount?.mileageLogs) {
        draft.mileageLogs = editingAccount.mileageLogs;
      }
      const pp = parseFloat(purchasePriceStr);
      draft.purchasePrice = Number.isFinite(pp) ? pp : undefined;
      draft.purchaseDate = purchaseDate || undefined;
      draft.linkedLoanId = linkedLoanId || undefined;
      if (ownership === 'Leased') {
        draft.leaseStartDate = leaseStartDate || undefined;
        draft.leaseEndDate = leaseEndDate || undefined;
        const lp = parseFloat(leasePaymentStr);
        draft.leasePaymentAmount = Number.isFinite(lp) ? lp : undefined;
        const allowance = parseInt(annualMileageAllowanceStr, 10);
        draft.annualMileageAllowance = Number.isFinite(allowance) ? allowance : 15000;
        // Counts in net worth only with a residual value (Q5).
        const rv = parseFloat(residualValueStr);
        draft.residualValue = Number.isFinite(rv) && rv > 0 ? rv : undefined;
        draft.balance = draft.residualValue ?? 0;
      } else {
        draft.balance = Math.abs(rawMagnitude);
      }
    }

    if (type === 'Other Assets') {
      draft.otherSubType = otherAssetSubType;
      draft.counterparty = counterparty.trim() || undefined;
      draft.balance = Math.abs(rawMagnitude);
    }

    if (type === 'Other Liabilities') {
      draft.otherSubType = otherLiabilitySubType;
      draft.counterparty = counterparty.trim() || undefined;
      draft.balance = -Math.abs(rawMagnitude);
    }

    const res = onSave(draft);
    if (res.undo && !res.created) {
      toast.undo(`Updated "${trimmedName}"`, res.undo);
    } else {
      toast.success(isEditing ? `Saved "${trimmedName}"` : `Added "${trimmedName}"`);
    }
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${editingAccount.name}` : 'New Account'}
      description={
        isEditing
          ? 'Update account parameters, linked obligations, or automation settings'
          : 'Configure a bank account, card, reserve, loan, or physical asset'
      }
      width={560}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button variant="cta" onClick={handleSave} disabled={!name.trim()} className="flex-1">
            {isEditing ? 'Save changes' : 'Create Account'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 1. Account Type Grid */}
        <div>
          <FieldLabel>Account category</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPE_OPTIONS.map((opt) => {
              const selected = type === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setType(opt.type);
                    setIsNegativeBalance(
                      opt.type === 'Credit Card' ||
                        opt.type === 'Loan' ||
                        opt.type === 'Other Liabilities'
                    );
                  }}
                  className={cn(
                    'flex items-start gap-2.5 rounded-nv-control border p-3 text-left transition-colors',
                    selected
                      ? 'border-nv-ink bg-nv-ink text-nv-on-ink'
                      : 'border-nv-line bg-nv-surface text-nv-ink hover:bg-nv-inset'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      selected ? 'bg-nv-surface/15 text-nv-on-ink' : 'bg-nv-inset text-nv-ink'
                    )}
                  >
                    <NvIcon name={opt.icon} size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{opt.label}</p>
                    <p
                      className={cn(
                        'truncate text-xs',
                        selected ? 'opacity-75' : 'text-nv-muted'
                      )}
                    >
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Investment Sub-Type Selector (Pension Fund vs Spare Change) */}
        {type === 'Investment' && (
          <div className="rounded-nv-tile bg-nv-inset p-4">
            <FieldLabel>Accumulation vehicle</FieldLabel>
            <SegmentedTabs<InvestmentSubType>
              label="Investment subtype"
              size="sm"
              className="w-full"
              value={subType}
              onChange={setSubType}
              items={[
                { id: 'Pension Fund', label: 'Pension fund' },
                { id: 'Spare Change', label: 'Spare change round-ups' },
              ]}
            />
          </div>
        )}

        {/* 3. Amount Pad (Current Balance / Market Value / Owed Balance) */}
        {!(type === 'Vehicle' && ownership === 'Leased') && (
          <div className="rounded-nv-tile bg-nv-inset p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-medium text-nv-muted">
                {type === 'Property' || type === 'Vehicle'
                  ? 'Current Market Valuation'
                  : type === 'Credit Card' || type === 'Loan' || type === 'Other Liabilities'
                    ? 'Current Balance Owed'
                    : 'Current Balance'}
              </span>
              {(type === 'Checking' || type === 'Savings') && (
                <button
                  type="button"
                  onClick={() => setIsNegativeBalance((v) => !v)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    isNegativeBalance
                      ? 'bg-nv-red-soft text-nv-red-text'
                      : 'bg-nv-surface text-nv-muted hover:text-nv-ink'
                  )}
                >
                  {isNegativeBalance ? 'Overdrawn (−)' : 'Positive (+)'}
                </button>
              )}
            </div>
            <AmountPad
              value={balanceStr}
              onChange={setBalanceStr}
              currency={currencySign(currency)}
              keypad={phone}
              label="Account balance"
            />
          </div>
        )}

        {/* 4. Core Identity Fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <FieldLabel>Account name</FieldLabel>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === 'Property'
                  ? 'e.g. Brussels Primary Residence'
                  : type === 'Vehicle'
                    ? 'e.g. Polestar 2 Long Range'
                    : 'e.g. KBC Plus Account'
              }
            />
          </div>
          <div>
            <FieldLabel>Currency</FieldLabel>
            <SelectInput
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c} ({currencySign(c)})
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>Financial institution / provider</FieldLabel>
            <TextInput
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. KBC, Revolut, ING"
            />
          </div>
          <div>
            <FieldLabel hint="Domain or URL">Website / portal</FieldLabel>
            <TextInput
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. revolut.com"
            />
          </div>
          <div>
            <FieldLabel hint="Upload or URL">Image / logo</FieldLabel>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageFileUpload}
            />
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <TextInput
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... or upload"
                />
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-nv-muted hover:bg-nv-inset hover:text-nv-ink"
                    title="Clear image"
                  >
                    <NvIcon name="close" size={13} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-nv-control border border-nv-line bg-nv-surface px-3 text-xs font-semibold text-nv-ink transition-colors hover:bg-nv-inset"
                title="Upload image file from disk"
              >
                <NvIcon name="add" size={15} />
                <span>Upload</span>
              </button>
            </div>
            {imageUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="h-8 w-8 rounded-lg object-cover bg-nv-inset"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-xs text-nv-muted">Image preview</span>
              </div>
            )}
          </div>
        </div>

        {/* 5. Type-Specific Configuration Sections */}

        {/* Checking / Savings / Card Identifiers */}
        {(type === 'Checking' || type === 'Savings' || type === 'Credit Card') && (
          <div className="space-y-4 rounded-nv-tile bg-nv-inset p-4">
            <p className="text-sm font-semibold text-nv-ink">Card & banking identifiers</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <FieldLabel hint="IBAN or Account #">Account number / IBAN</FieldLabel>
                <TextInput
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="BE00 0000 0000 0000"
                />
              </div>
              <div>
                <FieldLabel>Card last 4</FieldLabel>
                <TextInput
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                  placeholder="4821"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel hint="BIC / SWIFT">Routing number / BIC</FieldLabel>
                <TextInput
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. GEBABEBB"
                />
              </div>
              <div>
                <FieldLabel>Account opening date</FieldLabel>
                <TextInput
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Card network</FieldLabel>
                <SelectInput
                  value={cardNetwork}
                  onChange={(e) => setCardNetwork(e.target.value)}
                >
                  {CARD_NETWORKS.map((net) => (
                    <option key={net} value={net}>
                      {net}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Cardholder name</FieldLabel>
                <TextInput
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <FieldLabel hint="MM/YY">Card expiration</FieldLabel>
                <TextInput
                  maxLength={5}
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  placeholder="12/28"
                />
              </div>
            </div>

            {type === 'Savings' && (
              <div>
                <FieldLabel hint="Annual Yield">APY (%)</FieldLabel>
                <TextInput
                  type="number"
                  step="0.01"
                  value={apyStr}
                  onChange={(e) => setApyStr(e.target.value)}
                  placeholder="e.g. 2.85"
                />
              </div>
            )}
          </div>
        )}

        {/* Credit Card Statement & Cycle */}
        {type === 'Credit Card' && (
          <div className="space-y-4 rounded-nv-tile bg-nv-inset p-4">
            <p className="text-sm font-semibold text-nv-ink">Credit limit & statement cycle</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <FieldLabel>Credit Limit ({currencySign(currency)})</FieldLabel>
                <TextInput
                  type="number"
                  step="100"
                  value={creditLimitStr}
                  onChange={(e) => setCreditLimitStr(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div>
                <FieldLabel>APR (%)</FieldLabel>
                <TextInput
                  type="number"
                  step="0.1"
                  value={interestRateStr}
                  onChange={(e) => setInterestRateStr(e.target.value)}
                  placeholder="14.9"
                />
              </div>
              <div>
                <FieldLabel>Stmt day (1–31)</FieldLabel>
                <TextInput
                  type="number"
                  min={1}
                  max={31}
                  value={statementStartDayStr}
                  onChange={(e) => setStatementStartDayStr(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Payment due day (1–31)</FieldLabel>
                <TextInput
                  type="number"
                  min={1}
                  max={31}
                  value={paymentDueDayStr}
                  onChange={(e) => setPaymentDueDayStr(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Auto-debit settlement account</FieldLabel>
                <SelectInput
                  value={settlementAccountId}
                  onChange={(e) => setSettlementAccountId(e.target.value)}
                >
                  <option value="">None (manual payment)</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
          </div>
        )}

        {/* Loan & Lending 3-of-4 Auto-Calculator */}
        {(type === 'Loan' || type === 'Lending') && (
          <div className="space-y-4 rounded-nv-tile bg-nv-inset p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-nv-ink">3-of-4 amortization calculator</p>
                <p className="text-xs text-nv-muted">
                  Choose which parameter Crystal solves automatically from the other three
                </p>
              </div>
              {solvedLoanValue !== null && (
                <button
                  type="button"
                  onClick={applySolvedLoanValue}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-nv-ink px-4 text-xs font-medium text-nv-on-ink"
                >
                  <NvIcon name="sparkles" size={13} />
                  <span>
                    Apply Solved:{' '}
                    {solveTarget === 'durationMonths'
                      ? `${solvedLoanValue} mo`
                      : solveTarget === 'annualRate'
                        ? `${solvedLoanValue}%`
                        : formatCurrency(Number(solvedLoanValue), currency)}
                  </span>
                </button>
              )}
            </div>

            <SegmentedTabs<LoanSolveTarget>
              label="Solve target"
              size="sm"
              className="w-full"
              value={solveTarget}
              onChange={setSolveTarget}
              items={[
                { id: 'monthlyPayment', label: 'Solve monthly' },
                { id: 'principal', label: 'Solve principal' },
                { id: 'durationMonths', label: 'Solve term' },
                { id: 'annualRate', label: 'Solve rate' },
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel hint={solveTarget === 'principal' ? 'Auto-solved' : undefined}>
                  Principal ({currencySign(currency)})
                </FieldLabel>
                <TextInput
                  type="number"
                  step="100"
                  value={
                    solveTarget === 'principal' && solvedLoanValue !== null
                      ? String(solvedLoanValue)
                      : principalStr
                  }
                  onChange={(e) => setPrincipalStr(e.target.value)}
                  placeholder="250000"
                />
              </div>
              <div>
                <FieldLabel hint={solveTarget === 'annualRate' ? 'Auto-solved' : undefined}>
                  Interest rate (% APR)
                </FieldLabel>
                <TextInput
                  type="number"
                  step="0.01"
                  value={
                    solveTarget === 'annualRate' && solvedLoanValue !== null
                      ? String(solvedLoanValue)
                      : interestRateStr
                  }
                  onChange={(e) => setInterestRateStr(e.target.value)}
                  placeholder="3.45"
                />
              </div>
              <div>
                <FieldLabel hint={solveTarget === 'durationMonths' ? 'Auto-solved' : undefined}>
                  Duration (months)
                </FieldLabel>
                <TextInput
                  type="number"
                  min={1}
                  value={
                    solveTarget === 'durationMonths' && solvedLoanValue !== null
                      ? String(solvedLoanValue)
                      : durationStr
                  }
                  onChange={(e) => setDurationStr(e.target.value)}
                  placeholder="240"
                />
              </div>
              <div>
                <FieldLabel hint={solveTarget === 'monthlyPayment' ? 'Auto-solved' : undefined}>
                  Monthly payment ({currencySign(currency)})
                </FieldLabel>
                <TextInput
                  type="number"
                  step="1"
                  value={
                    solveTarget === 'monthlyPayment' && solvedLoanValue !== null
                      ? String(solvedLoanValue)
                      : monthlyPaymentStr
                  }
                  onChange={(e) => setMonthlyPaymentStr(e.target.value)}
                  placeholder="1443.12"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Start date</FieldLabel>
                <TextInput
                  type="date"
                  value={loanStartDate}
                  onChange={(e) => setLoanStartDate(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Payment day (1–31)</FieldLabel>
                <TextInput
                  type="number"
                  min={1}
                  max={31}
                  value={paymentDayOfMonthStr}
                  onChange={(e) => setPaymentDayOfMonthStr(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Down payment</FieldLabel>
                <TextInput
                  type="number"
                  step="100"
                  value={downPaymentStr}
                  onChange={(e) => setDownPaymentStr(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {type === 'Loan' && physicalAssets.length > 0 && (
              <div>
                <FieldLabel>Linked financed asset (property / vehicle)</FieldLabel>
                <SelectInput
                  value={linkedAssetId}
                  onChange={(e) => setLinkedAssetId(e.target.value)}
                >
                  <option value="">No linked physical asset</option>
                  {physicalAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.type})
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
          </div>
        )}

        {/* Property Fields */}
        {type === 'Property' && (
          <div className="space-y-4 rounded-nv-tile bg-nv-inset p-4">
            <p className="text-sm font-semibold text-nv-ink">Property & operating economics</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Property type</FieldLabel>
                <SelectInput
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                >
                  {PROPERTY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Street address / city</FieldLabel>
                <TextInput
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Avenue Louise 140, 1050 Brussels"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Purchase price</FieldLabel>
                <TextInput
                  type="number"
                  value={purchasePriceStr}
                  onChange={(e) => setPurchasePriceStr(e.target.value)}
                  placeholder="420000"
                />
              </div>
              <div>
                <FieldLabel>Purchase date</FieldLabel>
                <TextInput
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Area (m²)</FieldLabel>
                <TextInput
                  type="number"
                  value={propertySizeStr}
                  onChange={(e) => setPropertySizeStr(e.target.value)}
                  placeholder="115"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <FieldLabel hint="Monthly">Rental income</FieldLabel>
                <TextInput
                  type="number"
                  value={rentalIncomeStr}
                  onChange={(e) => setRentalIncomeStr(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <FieldLabel hint="Yearly">Property tax</FieldLabel>
                <TextInput
                  type="number"
                  value={propertyTaxStr}
                  onChange={(e) => setPropertyTaxStr(e.target.value)}
                  placeholder="1400"
                />
              </div>
              <div>
                <FieldLabel hint="Yearly">Insurance</FieldLabel>
                <TextInput
                  type="number"
                  value={insuranceStr}
                  onChange={(e) => setInsuranceStr(e.target.value)}
                  placeholder="650"
                />
              </div>
              <div>
                <FieldLabel hint="Monthly">HOA / syndicate</FieldLabel>
                <TextInput
                  type="number"
                  value={hoaFeeStr}
                  onChange={(e) => setHoaFeeStr(e.target.value)}
                  placeholder="180"
                />
              </div>
            </div>

            {loanAccounts.length > 0 && (
              <div>
                <FieldLabel>Linked mortgage loan</FieldLabel>
                <SelectInput
                  value={linkedLoanId}
                  onChange={(e) => setLinkedLoanId(e.target.value)}
                >
                  <option value="">No linked mortgage</option>
                  {loanAccounts.map((ln) => (
                    <option key={ln.id} value={ln.id}>
                      {ln.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
          </div>
        )}

        {/* Vehicle Fields */}
        {type === 'Vehicle' && (
          <div className="space-y-4 rounded-nv-tile bg-nv-inset p-4">
            <p className="text-sm font-semibold text-nv-ink">Vehicle specifications & ownership</p>
            <SegmentedTabs<VehicleOwnership>
              label="Vehicle ownership"
              size="sm"
              className="w-full"
              value={ownership}
              onChange={setOwnership}
              items={VEHICLE_OWNERSHIP_TYPES.map((ow) => ({ id: ow, label: ow }))}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Make</FieldLabel>
                <TextInput
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Polestar / BMW"
                />
              </div>
              <div>
                <FieldLabel>Model</FieldLabel>
                <TextInput
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="2 Long Range"
                />
              </div>
              <div>
                <FieldLabel>Model year</FieldLabel>
                <TextInput
                  type="number"
                  value={yearStr}
                  onChange={(e) => setYearStr(e.target.value)}
                  placeholder="2025"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <FieldLabel>License plate</FieldLabel>
                <TextInput
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                  placeholder="1-ABC-234"
                />
              </div>
              <div>
                <FieldLabel>Country code</FieldLabel>
                <TextInput
                  maxLength={3}
                  value={registrationCountryCode}
                  onChange={(e) => setRegistrationCountryCode(e.target.value.toUpperCase())}
                  placeholder="BE"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel hint="17-char VIN">VIN</FieldLabel>
                <TextInput
                  maxLength={17}
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="e.g. WBA33AY08..."
                />
              </div>
              <div>
                <FieldLabel>Fuel / powertrain</FieldLabel>
                <SelectInput
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as FuelType)}
                >
                  {FUEL_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel hint="km">Odometer reading</FieldLabel>
                <TextInput
                  type="number"
                  value={currentMileageStr}
                  onChange={(e) => setCurrentMileageStr(e.target.value)}
                  placeholder="45000"
                />
              </div>
            </div>

            {ownership === 'Leased' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <FieldLabel>Lease start</FieldLabel>
                  <TextInput
                    type="date"
                    value={leaseStartDate}
                    onChange={(e) => setLeaseStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Lease end</FieldLabel>
                  <TextInput
                    type="date"
                    value={leaseEndDate}
                    onChange={(e) => setLeaseEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Monthly lease</FieldLabel>
                  <TextInput
                    type="number"
                    value={leasePaymentStr}
                    onChange={(e) => setLeasePaymentStr(e.target.value)}
                    placeholder="690"
                  />
                </div>
                <div>
                  <FieldLabel>Residual value (optional)</FieldLabel>
                  <TextInput
                    type="number"
                    value={residualValueStr}
                    onChange={(e) => setResidualValueStr(e.target.value)}
                    placeholder="18000"
                  />
                </div>
                <div>
                  <FieldLabel>Annual km limit</FieldLabel>
                  <TextInput
                    type="number"
                    value={annualMileageAllowanceStr}
                    onChange={(e) => setAnnualMileageAllowanceStr(e.target.value)}
                    placeholder="15000"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Purchase price</FieldLabel>
                  <TextInput
                    type="number"
                    value={purchasePriceStr}
                    onChange={(e) => setPurchasePriceStr(e.target.value)}
                    placeholder="48000"
                  />
                </div>
                <div>
                  <FieldLabel>Purchase date</FieldLabel>
                  <TextInput
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {ownership === 'Owned' && loanAccounts.length > 0 && (
              <div>
                <FieldLabel>Linked auto loan</FieldLabel>
                <SelectInput
                  value={linkedLoanId}
                  onChange={(e) => setLinkedLoanId(e.target.value)}
                >
                  <option value="">No linked auto loan</option>
                  {loanAccounts.map((ln) => (
                    <option key={ln.id} value={ln.id}>
                      {ln.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
          </div>
        )}

        {/* Pension Fund / Spare Change Fields */}
        {type === 'Investment' && (
          <div className="space-y-4 rounded-nv-tile bg-nv-inset p-4">
            {subType === 'Pension Fund' ? (
              <>
                <p className="text-sm font-semibold text-nv-ink">Pension horizon & yield</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Expected annual return / APY (%)</FieldLabel>
                    <TextInput
                      type="number"
                      step="0.1"
                      value={apyStr}
                      onChange={(e) => setApyStr(e.target.value)}
                      placeholder="4.5"
                    />
                  </div>
                  <div>
                    <FieldLabel>Target retirement year</FieldLabel>
                    <TextInput
                      type="number"
                      value={retirementTargetYearStr}
                      onChange={(e) => setRetirementTargetYearStr(e.target.value)}
                      placeholder="2050"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-nv-ink">Round-up source account</p>
                <p className="text-xs text-nv-muted">
                  Every outgoing purchase on the linked account automatically transfers the spare change to €1.00 into this pot.
                </p>
                <SelectInput
                  value={linkedAccountId}
                  onChange={(e) => setLinkedAccountId(e.target.value)}
                >
                  <option value="">Select debit / checking account</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                </SelectInput>
              </>
            )}
          </div>
        )}

        {/* Other Assets / Liabilities */}
        {(type === 'Other Assets' || type === 'Other Liabilities') && (
          <div className="grid grid-cols-1 gap-3 rounded-nv-tile bg-nv-inset p-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Sub-category</FieldLabel>
              {type === 'Other Assets' ? (
                <SelectInput
                  value={otherAssetSubType}
                  onChange={(e) => setOtherAssetSubType(e.target.value as OtherAssetSubType)}
                >
                  {OTHER_ASSET_SUBTYPES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </SelectInput>
              ) : (
                <SelectInput
                  value={otherLiabilitySubType}
                  onChange={(e) => setOtherLiabilitySubType(e.target.value as OtherLiabilitySubType)}
                >
                  {OTHER_LIABILITY_SUBTYPES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </SelectInput>
              )}
            </div>
            <div>
              <FieldLabel>Counterparty / custodian</FieldLabel>
              <TextInput
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Optional name or location"
              />
            </div>
          </div>
        )}

        {/* 6. Switches & Notes */}
        <div className="space-y-2 rounded-nv-tile bg-nv-inset p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-medium text-nv-ink">Include in net worth & analytics</p>
              <p className="text-xs text-nv-muted">
                Count this account toward portfolio net worth, burn runway, and reports
              </p>
            </div>
            <Switch
              checked={includeInAnalytics}
              onChange={setIncludeInAnalytics}
              label="Include in analytics"
            />
          </div>
          <div className="h-px bg-nv-line" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-medium text-nv-ink">Pin as primary account</p>
              <p className="text-xs text-nv-muted">
                Prioritize at the top of lists and default quick-add selectors
              </p>
            </div>
            <Switch checked={isPrimary} onChange={setIsPrimary} label="Primary account" />
          </div>
        </div>

        <div>
          <FieldLabel hint="Optional">Notes</FieldLabel>
          <TextInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any private notes or contract references..."
          />
        </div>
      </div>
    </Drawer>
  );
};

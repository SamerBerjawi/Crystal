
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { Account, AccountType, Currency, InvestmentSubType, PropertyType, Warrant, FuelType, VehicleOwnership, MileageLog, RecurrenceFrequency, OtherAssetSubType, OtherLiabilitySubType } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_STYLES, INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ACCOUNT_ICON_LIST, INVESTMENT_SUB_TYPES, PROPERTY_TYPES, INVESTMENT_SUB_TYPE_STYLES, FUEL_TYPES, VEHICLE_OWNERSHIP_TYPES, CHECKBOX_STYLE, FREQUENCIES, ALL_ACCOUNT_TYPES as ALL_TYPES_CONST, CARD_NETWORKS, OTHER_ASSET_SUB_TYPES, OTHER_LIABILITY_SUB_TYPES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';
import IconPicker from './IconPicker';
import { v4 as uuidv4 } from 'uuid';
import { toLocalISOString } from '../utils';

interface EditAccountModalProps {
  onClose: () => void;
  onSave: (account: Account) => void;
  onDelete: (accountId: string) => void;
  account: Account;
  accounts: Account[];
  warrants: Warrant[];
  onToggleStatus: (accountId: string) => void;
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({ onClose, onSave, onDelete, account, accounts, warrants, onToggleStatus }) => {
  // Gracefully handle legacy 'Crypto' type by migrating it to an 'Investment' type
  const initialType = (account.type as string) === 'Crypto' ? 'Investment' : account.type;
  const initialSubType = (account.type as string) === 'Crypto' ? 'Crypto' : account.subType || 'Stock';
  const initialOtherAssetSubType = account.otherSubType as OtherAssetSubType || 'Other';
  const initialOtherLiabilitySubType = account.otherSubType as OtherLiabilitySubType || 'Other';

  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(initialType);
  const [balance, setBalance] = useState<string>(String(account.balance));
  const [currency, setCurrency] = useState<Currency>(account.currency);
  const [icon, setIcon] = useState(account.icon || ACCOUNT_TYPE_STYLES[account.type]?.icon || 'wallet');
  const [last4, setLast4] = useState(account.last4 || '');
  const [isPrimary, setIsPrimary] = useState(account.isPrimary || false);
  const [includeInAnalytics, setIncludeInAnalytics] = useState(account.includeInAnalytics ?? true);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [financialInstitution, setFinancialInstitution] = useState(account.financialInstitution || '');
  
  // Banking Details
  const [accountNumber, setAccountNumber] = useState(account.accountNumber || '');
  const [routingNumber, setRoutingNumber] = useState(account.routingNumber || '');
  const [apy, setApy] = useState(account.apy != null ? String(account.apy) : '');
  const [openingDate, setOpeningDate] = useState(account.openingDate || '');

  // Card Details
  const [hasCard, setHasCard] = useState(!!(account.cardNetwork || account.last4 || account.expirationDate || account.cardholderName || account.type === 'Credit Card'));
  
  const [expirationDate, setExpirationDate] = useState(account.expirationDate || '');
  const [cardNetwork, setCardNetwork] = useState(account.cardNetwork || '');
  const [cardholderName, setCardholderName] = useState(account.cardholderName || '');

  // New detailed fields
  const [subType, setSubType] = useState<InvestmentSubType>(initialSubType);
  const [symbol, setSymbol] = useState(account.symbol || '');
  const [otherAssetSubType, setOtherAssetSubType] = useState<OtherAssetSubType>(initialOtherAssetSubType);
  const [otherLiabilitySubType, setOtherLiabilitySubType] = useState<OtherLiabilitySubType>(initialOtherLiabilitySubType);
  const [expectedRetirementYear, setExpectedRetirementYear] = useState(account.expectedRetirementYear != null ? String(account.expectedRetirementYear) : '');
  
  const [totalAmount, setTotalAmount] = useState(account.totalAmount != null ? String(account.totalAmount) : '');
  const [principalAmount, setPrincipalAmount] = useState(account.principalAmount != null ? String(account.principalAmount) : '');
  const [interestAmount, setInterestAmount] = useState(account.interestAmount != null ? String(account.interestAmount) : '');
  const [downPayment, setDownPayment] = useState(account.downPayment != null ? String(account.downPayment) : '');
  const [lastEditedLoanField, setLastEditedLoanField] = useState<'total' | 'principal' | 'interest' | null>(null);

  const [duration, setDuration] = useState(account.duration != null ? String(account.duration) : '');
  const [interestRate, setInterestRate] = useState(account.interestRate != null ? String(account.interestRate) : '');
  const [loanStartDate, setLoanStartDate] = useState(account.loanStartDate || toLocalISOString(new Date()));
  const [monthlyPayment, setMonthlyPayment] = useState(account.monthlyPayment != null ? String(account.monthlyPayment) : '');
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState(account.paymentDayOfMonth != null ? String(account.paymentDayOfMonth) : '');
  const [make, setMake] = useState(account.make || '');
  const [model, setModel] = useState(account.model || '');
  const [year, setYear] = useState(account.year != null ? String(account.year) : '');
  const [purchasePrice, setPurchasePrice] = useState(account.purchasePrice != null ? String(account.purchasePrice) : '');
  const [address, setAddress] = useState(account.address || '');
  const [propertyType, setPropertyType] = useState<PropertyType>(account.propertyType || 'Detached House');
  const [notes, setNotes] = useState(account.notes || '');
  const [linkedAccountId, setLinkedAccountId] = useState(account.linkedAccountId || '');
  const [linkedAssetId, setLinkedAssetId] = useState(account.linkedAssetId || '');
  
  // Other Asset/Liability Specific
  const [counterparty, setCounterparty] = useState(account.counterparty || '');
  const [assetCondition, setAssetCondition] = useState(account.assetCondition || '');
  const [location, setLocation] = useState(account.location || '');

  // Vehicle Specific
  const [licensePlate, setLicensePlate] = useState(account.licensePlate || '');
  const [registrationCountryCode, setRegistrationCountryCode] = useState(account.registrationCountryCode || '');
  const [vin, setVin] = useState(account.vin || '');
  const [fuelType, setFuelType] = useState<FuelType>(account.fuelType || 'Gasoline');
  const [vehicleOwnership, setVehicleOwnership] = useState<VehicleOwnership>(account.ownership || 'Owned');
  const [purchaseDate, setPurchaseDate] = useState(account.purchaseDate || '');
  const [leaseProvider, setLeaseProvider] = useState(account.leaseProvider || '');
  const [leaseStartDate, setLeaseStartDate] = useState(account.leaseStartDate || '');
  const [leaseEndDate, setLeaseEndDate] = useState(account.leaseEndDate || '');
  const [annualMileageAllowance, setAnnualMileageAllowance] = useState(account.annualMileageAllowance != null ? String(account.annualMileageAllowance) : '');
  const [leasePaymentAmount, setLeasePaymentAmount] = useState(account.leasePaymentAmount != null ? String(account.leasePaymentAmount) : '');
  const [leasePaymentDay, setLeasePaymentDay] = useState(account.leasePaymentDay != null ? String(account.leasePaymentDay) : '');
  const [leasePaymentAccountId, setLeasePaymentAccountId] = useState(account.leasePaymentAccountId || '');
  const [vehicleImage, setVehicleImage] = useState(account.imageUrl || '');
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>(account.mileageLogs || []);
  const [currentMileage, setCurrentMileage] = useState(() => {
    if (account.mileageLogs && account.mileageLogs.length > 0) {
      const sorted = [...account.mileageLogs].sort((a, b) => b.reading - a.reading);
      return String(sorted[0]?.reading || '');
    }
    return '';
  });
  const [newLogDate, setNewLogDate] = useState(toLocalISOString(new Date()));
  const [newLogReading, setNewLogReading] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Credit card specific fields from original modal
  const [statementStartDate, setStatementStartDate] = useState<string>(account.statementStartDate != null ? String(account.statementStartDate) : '');
  const [paymentDate, setPaymentDate] = useState<string>(account.paymentDate != null ? String(account.paymentDate) : '');
  const [settlementAccountId, setSettlementAccountId] = useState<string>(account.settlementAccountId || '');
  const [creditLimit, setCreditLimit] = useState<string>(account.creditLimit != null ? String(account.creditLimit) : '');
  
  // Property specific
  const [principalOwned, setPrincipalOwned] = useState(account.principalOwned != null ? String(account.principalOwned) : '');
  const [linkedLoanId, setLinkedLoanId] = useState(account.linkedLoanId || '');
  const [propertySize, setPropertySize] = useState(account.propertySize != null ? String(account.propertySize) : '');
  const [yearBuilt, setYearBuilt] = useState(account.yearBuilt != null ? String(account.yearBuilt) : '');
  const [floors, setFloors] = useState(account.floors != null ? String(account.floors) : '');
  const [bedrooms, setBedrooms] = useState(account.bedrooms != null ? String(account.bedrooms) : '');
  const [bathrooms, setBathrooms] = useState(account.bathrooms != null ? String(account.bathrooms) : '');
  const [hasBasement, setHasBasement] = useState(account.hasBasement || false);
  const [hasAttic, setHasAttic] = useState(account.hasAttic || false);
  const [indoorParkingSpaces, setIndoorParkingSpaces] = useState(account.indoorParkingSpaces != null ? String(account.indoorParkingSpaces) : '');
  const [outdoorParkingSpaces, setOutdoorParkingSpaces] = useState(account.outdoorParkingSpaces != null ? String(account.outdoorParkingSpaces) : '');
  const [hasGarden, setHasGarden] = useState(account.hasGarden || false);
  const [gardenSize, setGardenSize] = useState(account.gardenSize != null ? String(account.gardenSize) : '');
  const [hasTerrace, setHasTerrace] = useState(account.hasTerrace || false);
  const [terraceSize, setTerraceSize] = useState(account.terraceSize != null ? String(account.terraceSize) : '');

  // Property Recurring Expenses & Income
  const [propertyTaxAmount, setPropertyTaxAmount] = useState(account.propertyTaxAmount != null ? String(account.propertyTaxAmount) : '');
  const [propertyTaxDate, setPropertyTaxDate] = useState(account.propertyTaxDate || '');
  const [insuranceProvider, setInsuranceProvider] = useState(account.insuranceProvider || '');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState(account.insurancePolicyNumber || '');
  const [insuranceAmount, setInsuranceAmount] = useState(account.insuranceAmount != null ? String(account.insuranceAmount) : '');
  const [insuranceFrequency, setInsuranceFrequency] = useState<RecurrenceFrequency>(account.insuranceFrequency || 'yearly');
  const [insurancePaymentDate, setInsurancePaymentDate] = useState(account.insurancePaymentDate || '');
  const [hoaFeeAmount, setHoaFeeAmount] = useState(account.hoaFeeAmount != null ? String(account.hoaFeeAmount) : '');
  const [hoaFeeFrequency, setHoaFeeFrequency] = useState<RecurrenceFrequency>(account.hoaFeeFrequency || 'monthly');
  const [isRental, setIsRental] = useState(account.isRental || false);
  const [rentalIncomeAmount, setRentalIncomeAmount] = useState(account.rentalIncomeAmount != null ? String(account.rentalIncomeAmount) : '');
  const [rentalIncomeFrequency, setRentalIncomeFrequency] = useState<RecurrenceFrequency>(account.rentalIncomeFrequency || 'monthly');
  
  const isComputedAccount = useMemo(() => {
    if (type !== 'Investment' || !account.symbol) {
        return false;
    }
    return warrants.some(w => w.isin === account.symbol);
  }, [type, account.symbol, warrants]);

  useEffect(() => {
    let oldDefaultIcon = 'wallet';
    if (account.type === 'Investment') oldDefaultIcon = INVESTMENT_SUB_TYPE_STYLES[account.subType || 'Stock']?.icon;
    else if (account.type === 'Other Assets') oldDefaultIcon = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType || 'Other']?.icon;
    else if (account.type === 'Other Liabilities') oldDefaultIcon = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType || 'Other']?.icon;
    else oldDefaultIcon = ACCOUNT_TYPE_STYLES[account.type as AccountType]?.icon;

    if (icon === oldDefaultIcon) {
        let newDefaultIcon = ACCOUNT_TYPE_STYLES[type as AccountType]?.icon;
        if (type === 'Investment') newDefaultIcon = INVESTMENT_SUB_TYPE_STYLES[subType]?.icon;
        else if (type === 'Other Assets') newDefaultIcon = OTHER_ASSET_SUB_TYPE_STYLES[otherAssetSubType]?.icon;
        else if (type === 'Other Liabilities') newDefaultIcon = OTHER_LIABILITY_SUB_TYPE_STYLES[otherLiabilitySubType]?.icon;
      
        if (newDefaultIcon) {
            setIcon(newDefaultIcon);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, subType, otherAssetSubType, otherLiabilitySubType]);
  
  useEffect(() => {
    const total = parseFloat(totalAmount);
    const principal = parseFloat(principalAmount);
    const interest = parseFloat(interestAmount);

    if (lastEditedLoanField === 'total') {
        if (!isNaN(total) && !isNaN(principal)) {
            setInterestAmount((total - principal).toFixed(2));
        }
    } else if (lastEditedLoanField === 'principal' || lastEditedLoanField === 'interest') {
        if (!isNaN(principal) && !isNaN(interest)) {
            setTotalAmount((principal + interest).toFixed(2));
        }
    }
  }, [totalAmount, principalAmount, interestAmount, lastEditedLoanField]);


  const iconColorClass = useMemo(() => {
    if (type === 'Investment') {
        return INVESTMENT_SUB_TYPE_STYLES[subType]?.color || ACCOUNT_TYPE_STYLES.Investment.color;
    }
    if (type === 'Other Assets') {
        return OTHER_ASSET_SUB_TYPE_STYLES[otherAssetSubType]?.color || ACCOUNT_TYPE_STYLES['Other Assets'].color;
    }
    if (type === 'Other Liabilities') {
        return OTHER_LIABILITY_SUB_TYPE_STYLES[otherLiabilitySubType]?.color || ACCOUNT_TYPE_STYLES['Other Liabilities'].color;
    }
    return ACCOUNT_TYPE_STYLES[type as AccountType]?.color || 'text-gray-500';
  }, [type, subType, otherAssetSubType, otherLiabilitySubType]);


  const groupedDebitAccounts = useMemo(() => {
    const debitAccounts = accounts.filter(acc => (acc.type === 'Checking' || acc.type === 'Savings') && (acc.status !== 'closed' || acc.id === settlementAccountId || acc.id === linkedAccountId || acc.id === leasePaymentAccountId));
    const groups: Record<string, Account[]> = {};
    debitAccounts.forEach(acc => {
        if (!groups[acc.type]) groups[acc.type] = [];
        groups[acc.type].push(acc);
    });
    return groups;
  }, [accounts, settlementAccountId, linkedAccountId, leasePaymentAccountId]);

  const groupedLoanAccounts = useMemo(() => {
    const loanAccounts = accounts.filter(acc => acc.type === 'Loan' && (acc.status !== 'closed' || acc.id === linkedLoanId));
    const groups: Record<string, Account[]> = {};
    loanAccounts.forEach(acc => {
        if (!groups[acc.type]) groups[acc.type] = [];
        groups[acc.type].push(acc);
    });
    return groups;
  }, [accounts, linkedLoanId]);

  const assetAccounts = useMemo(() => {
    return accounts.filter(acc => acc.type === 'Property' || acc.type === 'Vehicle');
  }, [accounts]);

  const isLoanForPropertyLinked = useMemo(() => type === 'Property' && !!linkedLoanId, [type, linkedLoanId]);
  
  useEffect(() => {
    if (type === 'Property' && linkedLoanId) {
        const linkedLoan = accounts.find(a => a.id === linkedLoanId);
        if (linkedLoan) {
            const price = (linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0);
            setPurchasePrice(String(price));
        }
    } else if (type === 'Property' && !linkedLoanId) {
        setPurchasePrice(account.purchasePrice ? String(account.purchasePrice) : '');
    }
  }, [linkedLoanId, type, accounts, account.purchasePrice]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setVehicleImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleAddLog = () => {
      if (newLogDate && newLogReading) {
          setMileageLogs(prev => [...prev, { id: `log-${uuidv4()}`, date: newLogDate, reading: parseInt(newLogReading, 10) }]);
          setNewLogReading('');
      }
  };
  
  const handleDeleteLog = (index: number) => {
      setMileageLogs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedMileageLogs = [...mileageLogs];
    if (type === 'Vehicle' && currentMileage) {
      const intMileage = parseInt(currentMileage, 10);
      if (!isNaN(intMileage)) {
        const sorted = [...updatedMileageLogs].sort((a, b) => b.reading - a.reading);
        const latestReading = sorted[0]?.reading;
        if (latestReading === undefined || latestReading !== intMileage) {
          updatedMileageLogs.push({
            id: `log-${uuidv4()}`,
            date: toLocalISOString(new Date()),
            reading: intMileage
          });
        }
      }
    }
    
    const updatedAccount: Account = {
      ...account,
      name,
      type,
      balance: type === 'Loan' ? -Math.abs(principalAmount !== '' ? parseFloat(principalAmount) : 0) : (type === 'Lending' ? Math.abs(principalAmount !== '' ? parseFloat(principalAmount) : 0) : (isComputedAccount ? account.balance : (balance !== '' ? parseFloat(balance) : 0))),
      currency,
      icon,
      last4: hasCard && last4 ? last4 : undefined,
      financialInstitution: ['Checking', 'Savings', 'Credit Card'].includes(type) && financialInstitution ? financialInstitution : undefined,
      isPrimary,
      includeInAnalytics,
      accountNumber: accountNumber || undefined,
      routingNumber: routingNumber || undefined,
      apy: apy !== '' ? parseFloat(apy) : undefined,
      openingDate: openingDate || undefined,
      expirationDate: hasCard && expirationDate ? expirationDate : undefined,
      cardNetwork: hasCard && cardNetwork ? cardNetwork : undefined,
      cardholderName: hasCard && cardholderName ? cardholderName : undefined,

      ...(type === 'Investment' && { 
          subType,
          symbol: symbol ? symbol.toUpperCase() : undefined,
          expectedRetirementYear: subType === 'Pension Fund' && expectedRetirementYear ? parseInt(expectedRetirementYear, 10) : undefined,
          linkedAccountId: subType === 'Spare Change' ? linkedAccountId : undefined,
      }),
      ...(type === 'Other Assets' && { 
          otherSubType: otherAssetSubType,
          location: location || undefined,
          assetCondition: assetCondition || undefined,
          counterparty: counterparty || undefined,
       }),
       ...(type === 'Other Liabilities' && { 
          otherSubType: otherLiabilitySubType,
          counterparty: counterparty || undefined,
          interestRate: interestRate !== '' ? parseFloat(interestRate) : undefined,
       }),

      ...((type === 'Loan' || type === 'Lending') && { 
          totalAmount: totalAmount !== '' ? parseFloat(totalAmount) : undefined,
          principalAmount: principalAmount !== '' ? parseFloat(principalAmount) : undefined,
          interestAmount: interestAmount !== '' ? parseFloat(interestAmount) : undefined,
          duration: duration !== '' ? parseInt(duration, 10) : undefined,
          interestRate: interestRate !== '' ? parseFloat(interestRate) : undefined,
          loanStartDate,
          monthlyPayment: monthlyPayment !== '' ? parseFloat(monthlyPayment) : undefined,
          paymentDayOfMonth: paymentDayOfMonth !== '' ? parseInt(paymentDayOfMonth, 10) : undefined,
          linkedAssetId: linkedAssetId || undefined,
      }),
      
      ...(type === 'Loan' && { downPayment: downPayment !== '' ? parseFloat(downPayment) : undefined }),

      make: type === 'Vehicle' ? make || undefined : undefined,
      model: type === 'Vehicle' ? model || undefined : undefined,
      year: type === 'Vehicle' && year !== '' ? parseInt(year, 10) : undefined,
      licensePlate: type === 'Vehicle' ? licensePlate || undefined : undefined,
      registrationCountryCode: type === 'Vehicle' ? registrationCountryCode || undefined : undefined,
      vin: type === 'Vehicle' ? vin || undefined : undefined,
      fuelType: type === 'Vehicle' ? fuelType : undefined,
      ownership: type === 'Vehicle' ? vehicleOwnership : undefined,
      purchaseDate: type === 'Vehicle' && vehicleOwnership === 'Owned' && purchaseDate ? purchaseDate : undefined,
      leaseProvider: type === 'Vehicle' && vehicleOwnership === 'Leased' && leaseProvider ? leaseProvider : undefined,
      leaseStartDate: type === 'Vehicle' && vehicleOwnership === 'Leased' && leaseStartDate ? leaseStartDate : undefined,
      leaseEndDate: type === 'Vehicle' && vehicleOwnership === 'Leased' && leaseEndDate ? leaseEndDate : undefined,
      annualMileageAllowance: type === 'Vehicle' && vehicleOwnership === 'Leased' && annualMileageAllowance !== '' ? parseInt(annualMileageAllowance, 10) : undefined,
      leasePaymentAmount: type === 'Vehicle' && vehicleOwnership === 'Leased' && leasePaymentAmount !== '' ? parseFloat(leasePaymentAmount) : undefined,
      leasePaymentDay: type === 'Vehicle' && vehicleOwnership === 'Leased' && leasePaymentDay !== '' ? parseInt(leasePaymentDay, 10) : undefined,
      leasePaymentAccountId: type === 'Vehicle' && vehicleOwnership === 'Leased' && leasePaymentAccountId ? leasePaymentAccountId : undefined,
      mileageLogs: type === 'Vehicle' ? updatedMileageLogs : undefined,
      imageUrl: type === 'Vehicle' ? vehicleImage || undefined : undefined,
      address: type === 'Property' ? address || undefined : undefined,
      propertyType: type === 'Property' ? propertyType : undefined,
      purchasePrice: (type === 'Vehicle' || (type === 'Property' && !isLoanForPropertyLinked)) && purchasePrice !== '' ? parseFloat(purchasePrice) : undefined,
      principalOwned: type === 'Property' && !isLoanForPropertyLinked && principalOwned !== '' ? parseFloat(principalOwned) : undefined,
      linkedLoanId: type === 'Property' ? linkedLoanId || undefined : undefined,
      propertySize: propertySize !== '' ? parseFloat(propertySize) : undefined,
      yearBuilt: yearBuilt !== '' ? parseInt(yearBuilt, 10) : undefined,
      floors: floors !== '' ? parseInt(floors, 10) : undefined,
      bedrooms: bedrooms !== '' ? parseInt(bedrooms, 10) : undefined,
      bathrooms: bathrooms !== '' ? parseInt(bathrooms, 10) : undefined,
      hasBasement,
      hasAttic,
      indoorParkingSpaces: indoorParkingSpaces !== '' ? parseInt(indoorParkingSpaces, 10) : undefined,
      outdoorParkingSpaces: outdoorParkingSpaces !== '' ? parseInt(outdoorParkingSpaces, 10) : undefined,
      hasGarden,
      gardenSize: hasGarden && gardenSize !== '' ? parseFloat(gardenSize) : undefined,
      hasTerrace,
      terraceSize: hasTerrace && terraceSize !== '' ? parseFloat(terraceSize) : undefined,
      propertyTaxAmount: type === 'Property' && propertyTaxAmount !== '' ? parseFloat(propertyTaxAmount) : undefined,
      propertyTaxDate: type === 'Property' ? propertyTaxDate || undefined : undefined,
      insuranceProvider: type === 'Property' ? insuranceProvider || undefined : undefined,
      insurancePolicyNumber: type === 'Property' ? insurancePolicyNumber || undefined : undefined,
      insuranceAmount: type === 'Property' && insuranceAmount !== '' ? parseFloat(insuranceAmount) : undefined,
      insuranceFrequency: type === 'Property' ? insuranceFrequency : undefined,
      insurancePaymentDate: type === 'Property' ? insurancePaymentDate || undefined : undefined,
      hoaFeeAmount: type === 'Property' && hoaFeeAmount !== '' ? parseFloat(hoaFeeAmount) : undefined,
      hoaFeeFrequency: type === 'Property' ? hoaFeeFrequency : undefined,
      isRental: type === 'Property' ? isRental : undefined,
      rentalIncomeAmount: type === 'Property' && isRental && rentalIncomeAmount !== '' ? parseFloat(rentalIncomeAmount) : undefined,
      rentalIncomeFrequency: type === 'Property' && isRental ? rentalIncomeFrequency : undefined,
      notes: (type === 'Other Assets' || type === 'Other Liabilities') ? notes || undefined : undefined,
      statementStartDate: type === 'Credit Card' && statementStartDate !== '' ? parseInt(statementStartDate, 10) : undefined,
      paymentDate: type === 'Credit Card' && paymentDate !== '' ? parseInt(paymentDate, 10) : undefined,
      settlementAccountId: type === 'Credit Card' && settlementAccountId ? settlementAccountId : undefined,
      creditLimit: type === 'Credit Card' && creditLimit !== '' ? parseFloat(creditLimit) : undefined,
    };
    onSave(updatedAccount);
  };
  
  const handleDelete = () => {
    onDelete(account.id);
  };

  const handleToggleStatus = () => {
    onToggleStatus(account.id);
    onClose();
  };
  
  const labelStyle = "block text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-2";
  
  const showBankingDetails = ['Checking', 'Savings', 'Investment', 'Credit Card', 'Lending'].includes(type);

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={ACCOUNT_ICON_LIST} />}
      <Modal onClose={onClose} title={`Synchronize: ${account.name}`} size="3xl">
        <form onSubmit={handleSubmit} className="space-y-12">
          
          {/* Header Section */}
          <div className="relative group p-8 rounded-[2.5rem] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary-500/10 blur-[80px] rounded-full" />
            </div>

            <div className="relative flex flex-col md:flex-row items-center gap-10">
                <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="relative flex-shrink-0 group/icon"
                >
                    <div className="absolute inset-0 bg-primary-500/20 blur-2xl rounded-full opacity-0 group-hover/icon:opacity-100 transition-opacity" />
                    <div className="relative w-32 h-32 rounded-[2.5rem] bg-white dark:bg-dark-bg shadow-2xl flex items-center justify-center border border-black/5 dark:border-white/5 transition-transform duration-500 group-hover/icon:-rotate-6">
                        <span className={`material-symbols-outlined ${iconColorClass}`} style={{ fontSize: '64px' }}>
                            {icon}
                        </span>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/40">
                            <span className="material-symbols-outlined text-xl">edit_square</span>
                        </div>
                    </div>
                </button>

                <div className="flex-grow space-y-6 w-full text-center md:text-left">
                    <div>
                        <label htmlFor="account-name" className={labelStyle}>System Designation</label>
                        <input
                            id="account-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !text-3xl font-black bg-transparent border-none p-0 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-700`}
                            placeholder="Enter Identity..."
                            required
                        />
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-full border border-black/10 dark:border-white/10 flex items-center gap-2">
                             <span className={`w-2 h-2 rounded-full ${account.status === 'closed' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`} />
                             <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                                {account.status === 'closed' ? 'Inactive' : 'Live Integration'}
                             </span>
                        </div>
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-full border border-black/10 dark:border-white/10 flex items-center gap-2">
                             <span className="material-symbols-outlined text-xs text-gray-400">fingerprint</span>
                             <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                                ID: {account.id.split('-')[0].toUpperCase()}
                             </span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div className="space-y-10">
            
            {/* 1. Core Identification Card */}
            <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-500 text-lg">settings_input_component</span>
                    Node Identification
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="account-name" className={labelStyle}>Account Alias / Node Name</label>
                        <input id="account-name" type="text" value={name} onChange={e => setName(e.target.value)} className={`${INPUT_BASE_STYLE} !text-xl font-bold h-14`} required autoFocus />
                    </div>
                </div>
            </div>

            {/* 2. Primary Classification & Balance Hero */}
            <div className="bg-white dark:bg-black/20 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-10 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                        <label className={labelStyle}>Primary Classification</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                           <select
                              value={type}
                              onChange={(e) => setType(e.target.value as AccountType)}
                              className={`${SELECT_STYLE} h-16 !text-lg font-black tracking-widest uppercase`}
                            >
                              {ALL_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>

                    {type !== 'Loan' && type !== 'Lending' && (
                        <div className="space-y-4">
                          <label className={labelStyle}>{ (type === 'Vehicle' || type === 'Property') ? 'Fair Market Value' : 'Liquid Assets (Balance)'}</label>
                          <div className="relative flex group/balance">
                            <input
                              type="number"
                              step="0.01"
                              value={balance}
                              onChange={(e) => setBalance(e.target.value)}
                              className={`${INPUT_BASE_STYLE} h-16 !text-3xl font-black tabular-nums rounded-r-none border-r-0 focus:ring-0 ${isComputedAccount ? 'bg-black/5 dark:bg-white/5 opacity-50' : 'bg-transparent'}`}
                              required
                              readOnly={isComputedAccount}
                            />
                            <div className={`${SELECT_WRAPPER_STYLE} w-32`}>
                                <select
                                  value={currency}
                                  onChange={(e) => setCurrency(e.target.value as Currency)}
                                  className={`${SELECT_STYLE} h-16 rounded-l-none bg-black/5 dark:bg-white/5 border-l border-black/10 dark:border-white/10 font-black tracking-tighter`}
                                  disabled={isComputedAccount}
                                >
                                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                 <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                          </div>
                          {isComputedAccount && <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest text-center animate-pulse mt-2">Sync-Driven: Calculated from holdings</p>}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Conditional Architecture Cards */}
            <div className="space-y-10">
                {(showBankingDetails || ['Checking', 'Savings', 'Credit Card'].includes(type)) && (
                    <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary-500">account_balance</span>
                            <h4 className="text-[10px] font-black text-light-text dark:text-dark-text uppercase tracking-widest">Banking Architecture</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                            {['Checking', 'Savings', 'Credit Card'].includes(type) && (
                                <div className="bg-white dark:bg-black/20 p-6 rounded-2xl border border-black/5 dark:border-white/5">
                                    <label htmlFor="financial-institution" className={labelStyle}>Underwriting Entity</label>
                                    <input
                                        id="financial-institution"
                                        type="text"
                                        value={financialInstitution}
                                        onChange={(e) => setFinancialInstitution(e.target.value)}
                                        className={`${INPUT_BASE_STYLE} h-12 font-black`}
                                        placeholder="e.g. Chase, Goldman Sachs"
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-black/20 p-6 rounded-2xl border border-black/5 dark:border-white/5">
                                <div>
                                    <label htmlFor="accountNumber" className={labelStyle}>System Identity (Acct # / IBAN)</label>
                                    <input id="accountNumber" type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 !text-xs font-black tracking-widest tabular-nums`} placeholder="ID-ALPHA-778" />
                                </div>
                                <div>
                                    <label htmlFor="routingNumber" className={labelStyle}>Relational Routing (BIC / SWIFT)</label>
                                    <input id="routingNumber" type="text" value={routingNumber} onChange={e => setRoutingNumber(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 !text-xs font-black tracking-widest`} placeholder="Optional" />
                                </div>
                                {['Checking', 'Savings', 'Investment'].includes(type) && (
                                    <div>
                                        <label htmlFor="apy" className={labelStyle}>Annual Compound Yield (%)</label>
                                        <input id="apy" type="number" step="0.01" value={apy} onChange={e => setApy(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-black text-emerald-500 tabular-nums`} placeholder="0.00" />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="openingDate" className={labelStyle}>Inception Date</label>
                                    <input id="openingDate" type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-bold`} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className={`p-6 rounded-3xl border transition-all duration-500 ${hasCard ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/20 shadow-lg' : 'bg-black/5 dark:bg-white/5 border-transparent opacity-60'}`}>
                     <div className="flex items-center justify-between mb-8 cursor-pointer group/card" onClick={() => setHasCard(!hasCard)}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${hasCard ? 'bg-primary-500 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                                <span className="material-symbols-outlined text-2xl">credit_card</span>
                            </div>
                            <div className="flex flex-col">
                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${hasCard ? 'text-primary-600' : 'text-gray-500'}`}>Payment Instrument</h4>
                                <span className="text-[10px] font-bold text-gray-400">Physical shell or virtual node</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasCard ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xl transition-transform ${hasCard ? 'translate-x-6' : 'translate-x-1'}`} />
                        </div>
                    </div>

                    {hasCard && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in bg-white dark:bg-black/20 p-6 rounded-2xl border border-black/5 dark:border-white/5">
                            <div>
                                <label htmlFor="cardNetwork" className={labelStyle}>Network Protocol</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="cardNetwork" value={cardNetwork} onChange={e => setCardNetwork(e.target.value)} className={`${SELECT_STYLE} h-12 font-black uppercase tracking-widest`}>
                                        <option value="">Select Network</option>
                                        {CARD_NETWORKS.map(net => <option key={net} value={net}>{net}</option>)}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="last-4" className={labelStyle}>Terminal Segments (Last 4)</label>
                                <input
                                    id="last-4"
                                    type="text"
                                    maxLength={4}
                                    value={last4}
                                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                                    className={`${INPUT_BASE_STYLE} h-12 font-black tracking-[0.3em] text-center`}
                                    placeholder="0000"
                                />
                            </div>
                             <div>
                                <label htmlFor="expirationDate" className={labelStyle}>Validity Period (MM/YY)</label>
                                <input id="expirationDate" type="text" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-black text-center tracking-widest`} placeholder="12/28" />
                            </div>
                            <div>
                                <label htmlFor="cardholderName" className={labelStyle}>Signatory / Custodian</label>
                                <input id="cardholderName" type="text" value={cardholderName} onChange={e => setCardholderName(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-black uppercase tracking-widest text-center`} placeholder="Name on Card" />
                            </div>
                        </div>
                    )}
                </div>

                {type === 'Investment' && (
                  <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary-500">trending_up</span>
                        <h4 className="text-[10px] font-black text-light-text dark:text-dark-text uppercase tracking-widest">Market Strategy</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-black/20 p-6 rounded-2xl border border-black/5 dark:border-white/5">
                        <div>
                          <label htmlFor="subType" className={labelStyle}>Core Specialization</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select id="subType" value={subType} onChange={(e) => setSubType(e.target.value as InvestmentSubType)} className={`${SELECT_STYLE} h-12 font-black`}>
                              {INVESTMENT_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                          </div>
                        </div>
                        {['Stock', 'ETF', 'Crypto'].includes(subType) && (
                            <div>
                                 <label htmlFor="symbol" className={labelStyle}>Exchange Ticker / Protocol</label>
                                 <input id="symbol" type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 !text-xs font-black uppercase tracking-widest text-primary-500`} placeholder="AAPL / BTC" />
                            </div>
                        )}
                        {subType === 'Pension Fund' && (
                             <div>
                                <label htmlFor="retirementYear" className={labelStyle}>Projected Maturity Year</label>
                                <input id="retirementYear" type="number" value={expectedRetirementYear} onChange={e => setExpectedRetirementYear(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-black`} placeholder="eg. 2055" />
                            </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Other Assets */}
                {type === 'Other Assets' && (
                    <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6 animate-fade-in-up">
                       <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">category</span>
                                Asset Specifications
                            </h4>
                        </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="otherAssetSubType" className={labelStyle}>Categorical Sub-Type</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                            <select id="otherAssetSubType" value={otherAssetSubType} onChange={e => setOtherAssetSubType(e.target.value as OtherAssetSubType)} className={`${SELECT_STYLE} h-14 font-black`}>
                                {OTHER_ASSET_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="counterparty" className={labelStyle}>Associated Entity</label>
                            <input id="counterparty" type="text" value={counterparty} onChange={e => setCounterparty(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} placeholder="Owner / Source" />
                        </div>
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="location" className={labelStyle}>Geographic / Store Location</label>
                            <input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} placeholder="e.g., Vault" />
                        </div>
                         <div>
                            <label htmlFor="assetCondition" className={labelStyle}>Verified Condition</label>
                            <input id="assetCondition" type="text" value={assetCondition} onChange={e => setAssetCondition(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} placeholder="State of Asset" />
                        </div>
                       </div>
                    </div>
                )}

                {/* Other Liabilities */}
                {type === 'Other Liabilities' && (
                     <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6 animate-fade-in-up">
                        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">money_off</span>
                                Liability Metrics
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="otherLiabilitySubType" className={labelStyle}>Sub-Categorization</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                <select id="otherLiabilitySubType" value={otherLiabilitySubType} onChange={e => setOtherLiabilitySubType(e.target.value as OtherLiabilitySubType)} className={`${SELECT_STYLE} h-14 font-black`}>
                                    {OTHER_LIABILITY_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="counterparty" className={labelStyle}>Owed Entity</label>
                                <input id="counterparty" type="text" value={counterparty} onChange={e => setCounterparty(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} placeholder="Creditor" />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label htmlFor="interestRate" className={labelStyle}>Interest Burden (%)</label>
                                <div className="relative">
                                    <input id="interestRate" type="number" step="0.01" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-rose-500`} placeholder="0.00" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 font-black">%</span>
                                </div>
                            </div>
                         </div>
                     </div>
                )}

                {/* Loan/Lending */}
                {(type === 'Loan' || type === 'Lending') && (
                    <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6 animate-fade-in-up">
                        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">request_quote</span>
                                Financial Obligation
                            </h4>
                        </div>
                        
                        <div className="bg-primary-500/5 p-4 rounded-2xl border border-primary-500/10 mb-2">
                            <p className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1 italic">Computational Logic Active</p>
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary">Input any dual values; the tertiary will resolve automatically.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><label htmlFor="totalAmount" className={labelStyle}>Total Principal</label><input id="totalAmount" type="number" step="0.01" value={totalAmount} onFocus={() => setLastEditedLoanField('total')} onChange={e=>{setTotalAmount(e.target.value); setLastEditedLoanField('total');}} className={`${INPUT_BASE_STYLE} h-14 font-black !text-lg tabular-nums`} /></div>
                            <div><label htmlFor="principalAmount" className={labelStyle}>Net Capital</label><input id="principalAmount" type="number" step="0.01" value={principalAmount} onFocus={() => setLastEditedLoanField('principal')} onChange={e=>{setPrincipalAmount(e.target.value); setLastEditedLoanField('principal');}} className={`${INPUT_BASE_STYLE} h-14 font-black !text-lg tabular-nums`} /></div>
                            <div><label htmlFor="interestAmount" className={labelStyle}>Accumulated Interest</label><input id="interestAmount" type="number" step="0.01" value={interestAmount} onFocus={() => setLastEditedLoanField('interest')} onChange={e=>{setInterestAmount(e.target.value); setLastEditedLoanField('interest');}} className={`${INPUT_BASE_STYLE} h-14 font-black !text-lg tabular-nums`} /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-black/5 dark:border-white/5">
                            <div>
                                <label htmlFor="interestRate" className={labelStyle}>Annual Percentage Rate (%)</label>
                                <div className="relative">
                                    <input id="interestRate" type="number" step="0.01" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-primary-500`} />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500 font-black">%</span>
                                </div>
                            </div>
                            <div><label htmlFor="duration" className={labelStyle}>Term Horizon (Months)</label><input id="duration" type="number" value={duration} onChange={e=>setDuration(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} placeholder="e.g., 48" /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label htmlFor="loanStartDate" className={labelStyle}>Effective Start</label><input id="loanStartDate" type="date" value={loanStartDate} onChange={e=>setLoanStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} /></div>
                            {type === 'Loan' && (
                                <div><label htmlFor="downPayment" className={labelStyle}>Initial Equity (Down Payment)</label><input id="downPayment" type="number" step="0.01" value={downPayment} onChange={e=>setDownPayment(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} /></div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-black/10 dark:border-white/10 space-y-6">
                            <div className="flex items-center gap-2">
                                 <span className="material-symbols-outlined text-primary-500">event_repeat</span>
                                 <h5 className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Amortization Schedule</h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="monthlyPayment" className={labelStyle}>Installment Amount</label>
                                    <input id="monthlyPayment" type="number" step="0.01" value={monthlyPayment} onChange={e=>setMonthlyPayment(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black !text-lg tabular-nums`} placeholder="Calculated if null" />
                                </div>
                                <div>
                                    <label htmlFor="paymentDayOfMonth" className={labelStyle}>Ordinal Due Day</label>
                                    <input id="paymentDayOfMonth" type="number" min="1" max="31" value={paymentDayOfMonth} onChange={e=>setPaymentDayOfMonth(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} placeholder="Day (1-31)" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-black/10 dark:border-white/10">
                            <div>
                                <label htmlFor="linkedAccountId" className={labelStyle}>Settlement Disbursement Account</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="linkedAccountId" value={linkedAccountId} onChange={e => setLinkedAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-black`}>
                                        <option value="">No Link</option>
                                        {ALL_TYPES_CONST.map(t => {
                                            const group = groupedDebitAccounts[t];
                                            if (!group || group.length === 0) return null;
                                            return (
                                                <optgroup key={t} label={t}>
                                                    {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>
                            {type === 'Loan' && (
                                <div>
                                    <label htmlFor="linkedAssetId" className={labelStyle}>Collateral Asset Association</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="linkedAssetId" value={linkedAssetId} onChange={e => setLinkedAssetId(e.target.value)} className={`${SELECT_STYLE} h-14 font-black`}>
                                            <option value="">Unsecured</option>
                                            {assetAccounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                            ))}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                 {/* Vehicle Details */}
                 {type === 'Vehicle' && (
                    <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8 animate-fade-in-up">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">directions_car</span>
                                Automotive Registry
                            </h4>
                        </div>

                      <div className="flex flex-col items-center">
                          <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="relative group w-full max-w-sm aspect-video bg-light-fill dark:bg-dark-fill rounded-[2rem] flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-black/10 dark:border-white/10 hover:border-primary-500 hover:bg-primary-500/5 transition-all duration-300"
                          >
                              {vehicleImage ? (
                                  <>
                                    <img src={vehicleImage} alt="Vehicle" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-white text-[10px] font-black uppercase tracking-widest text-center">Replace Profile Image</p>
                                    </div>
                                  </>
                              ) : (
                                  <div className="flex flex-col items-center gap-3 animate-glow">
                                      <div className="w-16 h-16 bg-white dark:bg-dark-card rounded-full flex items-center justify-center shadow-2xl">
                                          <span className="material-symbols-outlined text-3xl text-primary-500">add_a_photo</span>
                                      </div>
                                      <div className="text-center">
                                          <p className="text-[10px] font-black text-light-text dark:text-dark-text uppercase tracking-widest">Asset Visualization</p>
                                          <p className="text-[10px] font-bold text-gray-400">Secure image upload</p>
                                      </div>
                                  </div>
                              )}
                              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                          </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div><label htmlFor="make" className={labelStyle}>Manufacturer</label><input id="make" type="text" value={make} onChange={e=>setMake(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase`} placeholder="e.g., Porsche" /></div>
                        <div><label htmlFor="model" className={labelStyle}>Designation</label><input id="model" type="text" value={model} onChange={e=>setModel(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase`} placeholder="e.g., 911 GT3" /></div>
                        <div><label htmlFor="year" className={labelStyle}>Model Year</label><input id="year" type="number" value={year} onChange={e=>setYear(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} placeholder="2024" /></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div><label htmlFor="regCode" className={labelStyle}>Jurisdiction</label><input id="regCode" type="text" value={registrationCountryCode} onChange={e=>setRegistrationCountryCode(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase text-center tracking-widest`} placeholder="EU" /></div>
                        <div><label htmlFor="plate" className={labelStyle}>License Identity</label><input id="plate" type="text" value={licensePlate} onChange={e=>setLicensePlate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase tracking-widest text-center`} placeholder="PLATE" /></div>
                        <div><label htmlFor="vin" className={labelStyle}>Chassis VIN</label><input id="vin" type="text" value={vin} onChange={e=>setVin(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase text-center text-xs`} placeholder="IDENTIFIER" /></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <label htmlFor="fuel" className={labelStyle}>Propulsion Core</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="fuel" value={fuelType} onChange={e => setFuelType(e.target.value as FuelType)} className={`${SELECT_STYLE} h-14 font-black`}>
                                    {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                         </div>
                         <div><label htmlFor="mileage" className={labelStyle}>Odometer Reading (KM)</label><input id="mileage" type="number" value={currentMileage} onChange={e=>setCurrentMileage(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} /></div>
                      </div>

                      <div className="space-y-4">
                            <label className={labelStyle}>Legal Ownership Status</label>
                            <div className="flex bg-light-fill dark:bg-dark-fill p-1.5 rounded-2xl shadow-inner border border-black/5 dark:border-white/5">
                                 {VEHICLE_OWNERSHIP_TYPES.map(o => (
                                     <button 
                                        key={o} 
                                        type="button" 
                                        onClick={() => setVehicleOwnership(o)} 
                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${vehicleOwnership === o ? 'bg-white dark:bg-gray-700 shadow-xl text-primary-600 dark:text-primary-400 scale-[1.02]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                     >
                                        {o}
                                     </button>
                                 ))}
                            </div>
                       </div>

                       {vehicleOwnership === 'Owned' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
                                <div><label htmlFor="purchasePrice" className={labelStyle}>Acquisition Capital</label><input id="purchasePrice" type="number" step="0.01" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} /></div>
                                <div><label htmlFor="purchaseDate" className={labelStyle}>Acquisition Date</label><input id="purchaseDate" type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} /></div>
                            </div>
                       )}

                       {vehicleOwnership === 'Leased' && (
                           <div className="space-y-6 animate-fade-in-up bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/5 dark:border-white/5">
                                <div><label htmlFor="leaseProvider" className={labelStyle}>Disbursement Provider</label><input id="leaseProvider" type="text" value={leaseProvider} onChange={e=>setLeaseProvider(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} placeholder="Provider Entity" /></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label htmlFor="leaseStart" className={labelStyle}>Commencement</label><input id="leaseStart" type="date" value={leaseStartDate} onChange={e=>setLeaseStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} /></div>
                                    <div><label htmlFor="leaseEnd" className={labelStyle}>Termination</label><input id="leaseEnd" type="date" value={leaseEndDate} onChange={e=>setLeaseEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} /></div>
                                    <div className="col-span-1 md:col-span-2"><label htmlFor="annualMileageAllowance" className={labelStyle}>Annual Utilization Limit (KM)</label><input id="annualMileageAllowance" type="number" value={annualMileageAllowance} onChange={e=>setAnnualMileageAllowance(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} placeholder="Limit" /></div>
                                    <div><label htmlFor="leasePaymentAmount" className={labelStyle}>Periodic Obligation</label><input id="leasePaymentAmount" type="number" step="0.01" value={leasePaymentAmount} onChange={e=>setLeasePaymentAmount(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} /></div>
                                    <div><label htmlFor="leasePaymentDay" className={labelStyle}>Due Ordinal Day</label><input id="leasePaymentDay" type="number" min="1" max="31" value={leasePaymentDay} onChange={e=>setLeasePaymentDay(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} placeholder="1-31" /></div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label htmlFor="leasePaymentAccountId" className={labelStyle}>Settlement Ledger</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="leasePaymentAccountId" value={leasePaymentAccountId} onChange={e => setLeasePaymentAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-black`}>
                                                <option value="">Detached</option>
                                                {ALL_TYPES_CONST.map(t => {
                                                    const group = groupedDebitAccounts[t];
                                                    if (!group || group.length === 0) return null;
                                                    return (
                                                        <optgroup key={t} label={t}>
                                                            {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                                        </optgroup>
                                                    );
                                                })}
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                        </div>
                                    </div>
                                </div>
                           </div>
                       )}

                       {/* Interactive Mileage Logs Dashboard */}
                       <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                            <label className="text-[10px] font-black uppercase tracking-widest text-primary-600 block mb-2">Mileage Journal Logs</label>
                            <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {mileageLogs.length > 0 ? (
                                    mileageLogs.map((log, index) => (
                                        <div key={log.id || index} className="flex justify-between items-center p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                            <span className="text-xs font-bold text-gray-500">{new Date(log.date).toLocaleDateString()}</span>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm font-black text-light-text dark:text-dark-text">{log.reading.toLocaleString()} km</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleDeleteLog(index)} 
                                                    className="text-rose-500 hover:text-rose-600 p-1 flex items-center justify-center"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[10px] text-gray-400 uppercase font-bold text-center py-4">No logged history</p>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                                <div>
                                    <label htmlFor="newLogDate" className={labelStyle}>Log Date</label>
                                    <input 
                                        id="newLogDate" 
                                        type="date" 
                                        value={newLogDate} 
                                        onChange={e => setNewLogDate(e.target.value)} 
                                        className={`${INPUT_BASE_STYLE} h-12`} 
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex-grow">
                                        <label htmlFor="newLogReading" className={labelStyle}>Odometer reading (km)</label>
                                        <input 
                                            id="newLogReading" 
                                            type="number" 
                                            value={newLogReading} 
                                            onChange={e => setNewLogReading(e.target.value)} 
                                            className={`${INPUT_BASE_STYLE} h-12`} 
                                            placeholder="Value"
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleAddLog} 
                                        className={`${BTN_PRIMARY_STYLE} h-12 w-12 flex items-center justify-center p-0`}
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            </div>
                       </div>
                    </div>
                 )}

                 {/* Property Details */}
                 {type === 'Property' && (
                    <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8 animate-fade-in-up">
                       <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">home</span>
                                Real Estate Specifications
                            </h4>
                        </div>
                       <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label htmlFor="propertyType" className={labelStyle}>Estate Classification</label>
                              <div className={SELECT_WRAPPER_STYLE}>
                                <select id="propertyType" value={propertyType} onChange={e => setPropertyType(e.target.value as PropertyType)} className={`${SELECT_STYLE} h-14 font-black`}>
                                  {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                </select>
                                 <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                              </div>
                            </div>
                             <div><label htmlFor="purchasePrice" className={labelStyle}>Acquisition Capital</label><input id="purchasePrice" type="number" step="0.01" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} disabled={isLoanForPropertyLinked} /></div>
                          </div>
                          <div><label htmlFor="address" className={labelStyle}>Geospatial Address</label><input id="address" type="text" value={address} onChange={e=>setAddress(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black placeholder-black/20 dark:placeholder-white/20 uppercase text-xs`} placeholder="STREET, CITY, ZIP" /></div>
                          
                          <div className="grid grid-cols-3 gap-6">
                             <div><label htmlFor="propertySize" className={labelStyle}>Internal (m²)</label><input id="propertySize" type="number" value={propertySize} onChange={e=>setPropertySize(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums text-center`} /></div>
                             <div><label htmlFor="yearBuilt" className={labelStyle}>Erection Year</label><input id="yearBuilt" type="number" value={yearBuilt} onChange={e=>setYearBuilt(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-center tracking-widest`} /></div>
                             <div><label htmlFor="floors" className={labelStyle}>Total Levels</label><input id="floors" type="number" value={floors} onChange={e=>setFloors(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-center`} /></div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                             <div><label htmlFor="bedrooms" className={labelStyle}>Sleeping Quarters</label><input id="bedrooms" type="number" value={bedrooms} onChange={e=>setBedrooms(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-center`} /></div>
                             <div><label htmlFor="bathrooms" className={labelStyle}>Sanitary Labs</label><input id="bathrooms" type="number" value={bathrooms} onChange={e=>setBathrooms(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-center`} /></div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                             <button 
                                type="button" 
                                onClick={() => setHasBasement(!hasBasement)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${hasBasement ? 'bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400' : 'bg-black/5 dark:bg-white/5 border-transparent text-gray-400'}`}
                             >
                                <span className="material-symbols-outlined">{hasBasement ? 'check_box' : 'check_box_outline_blank'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Basement</span>
                             </button>
                             <button 
                                type="button" 
                                onClick={() => setHasAttic(!hasAttic)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${hasAttic ? 'bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400' : 'bg-black/5 dark:bg-white/5 border-transparent text-gray-400'}`}
                             >
                                <span className="material-symbols-outlined">{hasAttic ? 'check_box' : 'check_box_outline_blank'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Attic</span>
                             </button>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                             <div><label htmlFor="indoorParking" className={labelStyle}>Garaged Vehicle Capacity</label><input id="indoorParking" type="number" value={indoorParkingSpaces} onChange={e=>setIndoorParkingSpaces(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-center`} placeholder="Count" /></div>
                             <div><label htmlFor="outdoorParking" className={labelStyle}>External Surface Parking</label><input id="outdoorParking" type="number" value={outdoorParkingSpaces} onChange={e=>setOutdoorParkingSpaces(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-center`} placeholder="Count" /></div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                             <button 
                                type="button" 
                                onClick={() => setHasGarden(!hasGarden)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all h-14 ${hasGarden ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-black/5 dark:bg-white/5 border-transparent text-gray-400'}`}
                             >
                                <span className="material-symbols-outlined">{hasGarden ? 'psychology' : 'check_box_outline_blank'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Garden Zone</span>
                             </button>
                             <div>
                                <label htmlFor="gardenSize" className={labelStyle}>Exterior Area (m²)</label>
                                <input id="gardenSize" type="number" value={gardenSize} onChange={e=>setGardenSize(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums text-center`} disabled={!hasGarden} />
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                             <button 
                                type="button" 
                                onClick={() => setHasTerrace(!hasTerrace)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all h-14 ${hasTerrace ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400' : 'bg-black/5 dark:bg-white/5 border-transparent text-gray-400'}`}
                             >
                                <span className="material-symbols-outlined">{hasTerrace ? 'deck' : 'check_box_outline_blank'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Terrace / Balcony</span>
                             </button>
                             <div>
                                <label htmlFor="terraceSize" className={labelStyle}>Refined Exterior (m²)</label>
                                <input id="terraceSize" type="number" value={terraceSize} onChange={e=>setTerraceSize(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums text-center`} disabled={!hasTerrace} />
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-black/10 dark:border-white/10 pt-6">
                              <div>
                                <label htmlFor="linkedLoanId" className={labelStyle}>Financial Linkage (Loan)</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="linkedLoanId" value={linkedLoanId} onChange={e => setLinkedLoanId(e.target.value)} className={`${SELECT_STYLE} h-14 font-black`}>
                                        <option value="">Detached</option>
                                        {ALL_TYPES_CONST.map(t => {
                                            const group = groupedLoanAccounts[t];
                                            if (!group || group.length === 0) return null;
                                            return (
                                                <optgroup key={t} label={t}>
                                                    {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                              </div>
                               <div>
                                <label htmlFor="principalOwned" className={labelStyle}>Owned Equity (Principal)</label>
                                <input id="principalOwned" type="number" step="0.01" value={principalOwned} onChange={e=>setPrincipalOwned(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} disabled={isLoanForPropertyLinked} />
                            </div>
                          </div>
                       </div>
                       
                       {/* Recurring Expenses & Income Section */}
                       <div className="pt-6 border-t border-black/10 dark:border-white/10 space-y-8">
                            <div className="flex items-center gap-2">
                                 <span className="material-symbols-outlined text-primary-500">sync_alt</span>
                                 <h4 className="text-[10px] font-black text-light-text dark:text-dark-text uppercase tracking-widest">Recurring Obligations & Cashflow</h4>
                            </div>
                            
                            <div className="space-y-8">
                                {/* Property Tax */}
                                <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary-600 block mb-2">Municipal Assessments</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label htmlFor="propTaxAmt" className={labelStyle}>Annual Assessment</label><input id="propTaxAmt" type="number" step="0.01" value={propertyTaxAmount} onChange={e=>setPropertyTaxAmount(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-rose-500`} placeholder="0.00" /></div>
                                        <div><label htmlFor="propTaxDate" className={labelStyle}>Ordinal Maturity Date</label><input id="propTaxDate" type="date" value={propertyTaxDate} onChange={e=>setPropertyTaxDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} /></div>
                                    </div>
                                </div>

                                 {/* Home Insurance */}
                                 <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary-600 block mb-2">Asset Indemnity</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label htmlFor="insProvider" className={labelStyle}>Underwriting Entity</label><input id="insProvider" type="text" value={insuranceProvider} onChange={e=>setInsuranceProvider(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} /></div>
                                        <div><label htmlFor="insPolicy" className={labelStyle}>Policy Instrument No.</label><input id="insPolicy" type="text" value={insurancePolicyNumber} onChange={e=>setInsurancePolicyNumber(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div><label htmlFor="insAmount" className={labelStyle}>Periodic Premium</label><input id="insAmount" type="number" step="0.01" value={insuranceAmount} onChange={e=>setInsuranceAmount(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} /></div>
                                        <div>
                                            <label htmlFor="insFreq" className={labelStyle}>Payment Frequency</label>
                                            <div className={SELECT_WRAPPER_STYLE}>
                                                <select id="insFreq" value={insuranceFrequency} onChange={e => setInsuranceFrequency(e.target.value as RecurrenceFrequency)} className={`${SELECT_STYLE} h-14 font-black`}>
                                                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                            </div>
                                        </div>
                                        <div><label htmlFor="insDate" className={labelStyle}>Maturity Event</label><input id="insDate" type="date" value={insurancePaymentDate} onChange={e=>setInsurancePaymentDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} /></div>
                                    </div>
                                </div>
                                
                                {/* HOA Fees */}
                                 <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary-600 block mb-2">Commonhold Contribution</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label htmlFor="hoaAmount" className={labelStyle}>Levy Amount</label><input id="hoaAmount" type="number" step="0.01" value={hoaFeeAmount} onChange={e=>setHoaFeeAmount(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tabular-nums`} /></div>
                                        <div>
                                            <label htmlFor="hoaFreq" className={labelStyle}>Billing Cycle</label>
                                            <div className={SELECT_WRAPPER_STYLE}>
                                                <select id="hoaFreq" value={hoaFeeFrequency} onChange={e => setHoaFeeFrequency(e.target.value as RecurrenceFrequency)} className={`${SELECT_STYLE} h-14 font-black`}>
                                                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Rental Income */}
                                <div className={`p-6 rounded-3xl border transition-all duration-300 ${isRental ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 shadow-xl shadow-emerald-500/5' : 'bg-black/5 dark:bg-white/5 border-transparent opacity-60'}`}>
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isRental ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                                                <span className="material-symbols-outlined">real_estate_agent</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${isRental ? 'text-emerald-600' : 'text-gray-500'}`}>Rental Monetization</h4>
                                                <span className="text-[10px] font-bold text-gray-400">Generate inward cashflow</span>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={isRental} onChange={e => setIsRental(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>
                                    {isRental && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                            <div><label htmlFor="rentAmount" className={labelStyle}>Periodic Yield</label><input id="rentAmount" type="number" step="0.01" value={rentalIncomeAmount} onChange={e=>setRentalIncomeAmount(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-emerald-500 tabular-nums`} /></div>
                                            <div>
                                                <label htmlFor="rentFreq" className={labelStyle}>Collection Cycle</label>
                                                <div className={SELECT_WRAPPER_STYLE}>
                                                    <select id="rentFreq" value={rentalIncomeFrequency} onChange={e => setRentalIncomeFrequency(e.target.value as RecurrenceFrequency)} className={`${SELECT_STYLE} h-14 font-black text-emerald-600`}>
                                                        {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                    </select>
                                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                       </div>
                    </div>
                 )}

                 {type === 'Credit Card' && (
                   <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6 animate-fade-in-up">
                        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 flex items-center gap-2">
                                 <span className="material-symbols-outlined text-lg">credit_card</span>
                                 Credit Architecture
                             </h4>
                         </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div><label htmlFor="statement-start" className={labelStyle}>Cycle Commencement Day</label><input id="statement-start" type="number" min="1" max="31" value={statementStartDate} onChange={(e) => setStatementStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest text-center`} placeholder="1-31" /></div>
                            <div><label htmlFor="payment-date" className={labelStyle}>Maturity / Due Day</label><input id="payment-date" type="number" min="1" max="31" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest text-center`} placeholder="1-31" /></div>
                       </div>
                       <div className="space-y-6">
                           <div>
                               <label htmlFor="settlement-account" className={labelStyle}>Liquid Settlement Ledger</label>
                               <div className={SELECT_WRAPPER_STYLE}>
                                    <select id="settlement-account" value={settlementAccountId} onChange={(e) => setSettlementAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-black`}>
                                       <option value="">Detached</option>
                                       {ALL_TYPES_CONST.map(t => {
                                           const group = groupedDebitAccounts[t];
                                           if (!group || group.length === 0) return null;
                                           return (
                                             <optgroup key={t} label={t}>
                                               {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                             </optgroup>
                                           );
                                       })}
                                   </select>
                                   <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                               </div>
                           </div>
                           <div><label htmlFor="credit-limit" className={labelStyle}>Authorized Credit Threshold</label><input id="credit-limit" type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-rose-500 tabular-nums`} /></div>
                       </div>
                   </div>
                 )}
            </div>

            {/* 4. Functional Directives Card */}
            <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
                <label className={labelStyle}>Operational Directives / Notes</label>
                <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className={`${INPUT_BASE_STYLE} min-h-[120px] p-4 text-sm leading-relaxed`} 
                    placeholder="Append specific account parameters, goals, or usage guidelines..."
                />
            </div>

            {/* 5. Logical Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsPrimary(!isPrimary)}
                  className={`flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-black/20 border transition-all group ${isPrimary ? 'border-primary-500/50 shadow-md ring-2 ring-primary-500/10' : 'border-black/5 dark:border-white/5 hover:border-primary-500/20'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isPrimary ? 'bg-primary-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:text-primary-500 group-hover:bg-primary-500/10'}`}>
                            <span className="material-symbols-outlined text-lg">stars</span>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text dark:text-dark-text">Master Nexus</p>
                            <p className="text-[10px] font-bold text-gray-400">Primary anchor</p>
                        </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${isPrimary ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`h-3 w-3 rounded-full bg-white absolute top-0.5 transition-transform ${isPrimary ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIncludeInAnalytics(!includeInAnalytics)}
                  className={`flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-black/20 border transition-all group ${includeInAnalytics ? 'border-emerald-500/50 shadow-md ring-2 ring-emerald-500/10' : 'border-black/5 dark:border-white/5 hover:border-emerald-500/20'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${includeInAnalytics ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:text-emerald-500 group-hover:bg-emerald-500/10'}`}>
                            <span className="material-symbols-outlined text-lg">analytics</span>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text dark:text-dark-text">Analytics Sync</p>
                            <p className="text-[10px] font-bold text-gray-400">Include in reports</p>
                        </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${includeInAnalytics ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`h-3 w-3 rounded-full bg-white absolute top-0.5 transition-transform ${includeInAnalytics ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6 pt-10 border-t border-black/5 dark:border-white/5">
            <div className="flex gap-4">
                 <button 
                    type="button" 
                    onClick={handleDelete} 
                    className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 group shadow-lg shadow-rose-500/5"
                    title="Terminate Integration"
                >
                    <span className="material-symbols-outlined group-hover:scale-110 transition-transform font-bold">delete_forever</span>
                </button>
                <button 
                    type="button" 
                    onClick={handleToggleStatus} 
                    className={`h-12 px-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-black/10 dark:border-white/10 ${
                        account.status === 'closed' 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-white dark:bg-dark-fill text-amber-600 hover:bg-amber-50'
                    }`}
                >
                    <span className="material-symbols-outlined text-lg">{account.status === 'closed' ? 'sync' : 'block'}</span>
                    {account.status === 'closed' ? 'Initialize Account' : 'Suspend Node'}
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className={`${BTN_SECONDARY_STYLE} h-12 px-8 uppercase tracking-widest text-[10px] font-black`}
                >
                    Retract
                </button>
                <button 
                    type="submit" 
                    className={`${BTN_PRIMARY_STYLE} h-12 px-10 gap-2 group animate-glow uppercase tracking-widest text-[10px] font-black`}
                >
                    Commit Changes
                    <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">save</span>
                </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default EditAccountModal;

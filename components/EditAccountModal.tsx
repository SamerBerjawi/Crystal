
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { Account, AccountType, Currency, InvestmentSubType, PropertyType, Warrant, FuelType, VehicleOwnership, MileageLog, RecurrenceFrequency, OtherAssetSubType, OtherLiabilitySubType } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_STYLES, INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ACCOUNT_ICON_LIST, INVESTMENT_SUB_TYPES, PROPERTY_TYPES, INVESTMENT_SUB_TYPE_STYLES, FUEL_TYPES, VEHICLE_OWNERSHIP_TYPES, CHECKBOX_STYLE, FREQUENCIES, ALL_ACCOUNT_TYPES as ALL_TYPES_CONST, CARD_NETWORKS, OTHER_ASSET_SUB_TYPES, OTHER_LIABILITY_SUB_TYPES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';
import IconPicker from './IconPicker';
import { v4 as uuidv4 } from 'uuid';

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
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [financialInstitution, setFinancialInstitution] = useState(account.financialInstitution || '');
  
  // Banking Details
  const [accountNumber, setAccountNumber] = useState(account.accountNumber || '');
  const [routingNumber, setRoutingNumber] = useState(account.routingNumber || '');
  const [apy, setApy] = useState(account.apy != null ? String(account.apy) : '');
  const [openingDate, setOpeningDate] = useState(account.openingDate || '');

  // Card Details
  // Initialize hasCard based on whether any card-specific data exists for this account
  const [hasCard, setHasCard] = useState(!!(account.cardNetwork || account.last4 || account.expirationDate || account.cardholderName || account.type === 'Credit Card'));
  
  const [expirationDate, setExpirationDate] = useState(account.expirationDate || '');
  const [cardNetwork, setCardNetwork] = useState(account.cardNetwork || '');
  const [cardholderName, setCardholderName] = useState(account.cardholderName || '');

  // New detailed fields
  const [subType, setSubType] = useState<InvestmentSubType>(initialSubType);
  const [otherAssetSubType, setOtherAssetSubType] = useState<OtherAssetSubType>(initialOtherAssetSubType);
  const [otherLiabilitySubType, setOtherLiabilitySubType] = useState<OtherLiabilitySubType>(initialOtherLiabilitySubType);
  
  const [totalAmount, setTotalAmount] = useState(account.totalAmount != null ? String(account.totalAmount) : '');
  const [principalAmount, setPrincipalAmount] = useState(account.principalAmount != null ? String(account.principalAmount) : '');
  const [interestAmount, setInterestAmount] = useState(account.interestAmount != null ? String(account.interestAmount) : '');
  const [downPayment, setDownPayment] = useState(account.downPayment != null ? String(account.downPayment) : '');
  const [lastEditedLoanField, setLastEditedLoanField] = useState<'total' | 'principal' | 'interest' | null>(null);

  const [duration, setDuration] = useState(account.duration != null ? String(account.duration) : '');
  const [interestRate, setInterestRate] = useState(account.interestRate != null ? String(account.interestRate) : '');
  const [loanStartDate, setLoanStartDate] = useState(account.loanStartDate || new Date().toISOString().split('T')[0]);
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
  const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
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
    // An investment account is 'computed' and not manually editable if it's a warrant being tracked automatically.
    if (type !== 'Investment' || !account.symbol) {
        return false;
    }
    return warrants.some(w => w.isin === account.symbol);
  }, [type, account.symbol, warrants]);

  useEffect(() => {
    // Determine the default icon for the account's original state
    let oldDefaultIcon = 'wallet';
    if (account.type === 'Investment') oldDefaultIcon = INVESTMENT_SUB_TYPE_STYLES[account.subType || 'Stock']?.icon;
    else if (account.type === 'Other Assets') oldDefaultIcon = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType || 'Other']?.icon;
    else if (account.type === 'Other Liabilities') oldDefaultIcon = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType || 'Other']?.icon;
    else oldDefaultIcon = ACCOUNT_TYPE_STYLES[account.type as AccountType]?.icon;

    // Only update the icon if it's currently the default for the *original* type/subtype.
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
  
  // Loan amount calculation logic
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

  const isLoanForPropertyLinked = useMemo(() => type === 'Property' && !!linkedLoanId, [type, linkedLoanId]);
  
  useEffect(() => {
    if (type === 'Property' && linkedLoanId) {
        const linkedLoan = accounts.find(a => a.id === linkedLoanId);
        if (linkedLoan) {
            const price = (linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0);
            setPurchasePrice(String(price));
        }
    } else if (type === 'Property' && !linkedLoanId) {
        // When unlinking, revert purchase price to the original value if it exists, otherwise clear it.
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
    
    // If card is toggled off, we clear the card-related fields.
    // We also handle potential cleanup of Credit Card specific logic if type is changed.
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
      accountNumber: accountNumber || undefined,
      routingNumber: routingNumber || undefined,
      apy: apy !== '' ? parseFloat(apy) : undefined,
      openingDate: openingDate || undefined,
      // Card details - Only include if hasCard is true
      expirationDate: hasCard && expirationDate ? expirationDate : undefined,
      cardNetwork: hasCard && cardNetwork ? cardNetwork : undefined,
      cardholderName: hasCard && cardholderName ? cardholderName : undefined,

      // Conditionally add new fields
      subType: type === 'Investment' ? subType : undefined,
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

      totalAmount: (type === 'Loan' || type === 'Lending') && totalAmount !== '' ? parseFloat(totalAmount) : undefined,
      principalAmount: (type === 'Loan' || type === 'Lending') && principalAmount !== '' ? parseFloat(principalAmount) : undefined,
      interestAmount: (type === 'Loan' || type === 'Lending') && interestAmount !== '' ? parseFloat(interestAmount) : undefined,
      downPayment: type === 'Loan' && downPayment !== '' ? parseFloat(downPayment) : undefined,
      duration: (type === 'Loan' || type === 'Lending') && duration !== '' ? parseInt(duration, 10) : undefined,
      interestRate: (type === 'Loan' || type === 'Lending') && interestRate !== '' ? parseFloat(interestRate) : undefined,
      loanStartDate: (type === 'Loan' || type === 'Lending') ? loanStartDate : undefined,
      monthlyPayment: (type === 'Loan' || type === 'Lending') && monthlyPayment !== '' ? parseFloat(monthlyPayment) : undefined,
      paymentDayOfMonth: (type === 'Loan' || type === 'Lending') && paymentDayOfMonth !== '' ? parseInt(paymentDayOfMonth, 10) : undefined,
      linkedAccountId: (type === 'Loan' || type === 'Lending') ? linkedAccountId || undefined : undefined,
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
      mileageLogs: type === 'Vehicle' ? mileageLogs : undefined,
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
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  
  const showBankingDetails = ['Checking', 'Savings', 'Investment', 'Credit Card', 'Lending'].includes(type);

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={ACCOUNT_ICON_LIST} />}
      <Modal onClose={onClose} title={`Edit ${account.name}`} size="3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              className="flex items-center justify-center w-16 h-16 bg-light-bg dark:bg-dark-bg rounded-full shadow-neu-raised-light dark:shadow-neu-raised-dark hover:shadow-neu-inset-light dark:hover:shadow-neu-inset-dark transition-shadow"
            >
              <span className={`material-symbols-outlined ${iconColorClass}`} style={{ fontSize: '36px' }}>
                {icon}
              </span>
            </button>
            <div className="flex-grow">
              <label htmlFor="account-name" className={labelStyle}>Account Name</label>
              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_BASE_STYLE}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="account-type" className={labelStyle}>Account Type</label>
              <div className={SELECT_WRAPPER_STYLE}>
                 <select
                    id="account-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className={INPUT_BASE_STYLE}
                  >
                    {ALL_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
            </div>
            {type !== 'Loan' && type !== 'Lending' && (
                <div>
                  <label htmlFor="account-balance" className={labelStyle}>{ (type === 'Vehicle' || type === 'Property') ? 'Current Value' : 'Current Balance'}</label>
                  <div className="relative flex">
                    <input
                      id="account-balance"
                      type="number"
                      step="0.01"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className={`${INPUT_BASE_STYLE} rounded-r-none`}
                      required
                      readOnly={isComputedAccount}
                      disabled={isComputedAccount}
                    />
                    <div className={`${SELECT_WRAPPER_STYLE} w-24`}>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as Currency)}
                          className={`${INPUT_BASE_STYLE} rounded-l-none border-l-2 border-transparent`}
                          disabled={isComputedAccount}
                        >
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                  </div>
                  {isComputedAccount && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Balance is calculated automatically from holdings.</p>}
                </div>
            )}
          </div>

           {/* Dynamic fields based on type */}
          <div className="space-y-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
            {['Checking', 'Savings', 'Credit Card'].includes(type) && (
                <div>
                    <label htmlFor="financial-institution" className={labelStyle}>Financial Institution</label>
                    <input
                        id="financial-institution"
                        type="text"
                        value={financialInstitution}
                        onChange={(e) => setFinancialInstitution(e.target.value)}
                        className={INPUT_BASE_STYLE}
                        placeholder="e.g., Chase, Bank of America"
                    />
                </div>
            )}

            {showBankingDetails && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="accountNumber" className={labelStyle}>Account Number / IBAN</label>
                    <input id="accountNumber" type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className={INPUT_BASE_STYLE} placeholder="Optional" />
                  </div>
                  <div>
                    <label htmlFor="routingNumber" className={labelStyle}>Routing / BIC / Sort Code</label>
                    <input id="routingNumber" type="text" value={routingNumber} onChange={e => setRoutingNumber(e.target.value)} className={INPUT_BASE_STYLE} placeholder="Optional" />
                  </div>
                  {['Checking', 'Savings', 'Investment'].includes(type) && (
                     <div>
                        <label htmlFor="apy" className={labelStyle}>APY / Interest Rate (%)</label>
                        <input id="apy" type="number" step="0.01" value={apy} onChange={e => setApy(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. 4.5" />
                     </div>
                  )}
                   <div>
                    <label htmlFor="openingDate" className={labelStyle}>Opening Date</label>
                    <input id="openingDate" type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} className={INPUT_BASE_STYLE} />
                  </div>
               </div>
            )}
            
            {/* Card Details Toggle */}
            <div className="flex items-center justify-between py-2 border-t border-black/10 dark:border-white/10 mt-4 pt-4">
              <label className="text-sm font-medium text-light-text dark:text-dark-text">Link a Bank Card</label>
              <button
                type="button"
                onClick={() => setHasCard(!hasCard)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasCard ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${hasCard ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {hasCard && (
                <div className="pt-4 animate-fade-in-up">
                    <h4 className="font-semibold text-light-text dark:text-dark-text mb-3">Card Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="cardNetwork" className={labelStyle}>Card Network</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="cardNetwork" value={cardNetwork} onChange={e => setCardNetwork(e.target.value)} className={INPUT_BASE_STYLE}>
                                    <option value="">Select Network</option>
                                    {CARD_NETWORKS.map(net => <option key={net} value={net}>{net}</option>)}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="last-4" className={labelStyle}>Last 4 Digits (Optional)</label>
                            <input
                                id="last-4"
                                type="text"
                                maxLength={4}
                                value={last4}
                                onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                                className={INPUT_BASE_STYLE}
                                placeholder="****"
                            />
                        </div>
                         <div>
                            <label htmlFor="expirationDate" className={labelStyle}>Expiration Date (MM/YY)</label>
                            <input id="expirationDate" type="text" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className={INPUT_BASE_STYLE} placeholder="MM/YY" />
                        </div>
                        <div>
                            <label htmlFor="cardholderName" className={labelStyle}>Cardholder Name</label>
                            <input id="cardholderName" type="text" value={cardholderName} onChange={e => setCardholderName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="Name on Card" />
                        </div>
                    </div>
                </div>
            )}

            {type === 'Investment' && (
              <div>
                <label htmlFor="subType" className={labelStyle}>Investment Type</label>
                <div className={SELECT_WRAPPER_STYLE}>
                  <select id="subType" value={subType} onChange={(e) => setSubType(e.target.value as InvestmentSubType)} className={INPUT_BASE_STYLE}>
                    {INVESTMENT_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
              </div>
            )}
             {type === 'Other Assets' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="otherAssetSubType" className={labelStyle}>Sub-Type</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                        <select id="otherAssetSubType" value={otherAssetSubType} onChange={e => setOtherAssetSubType(e.target.value as OtherAssetSubType)} className={INPUT_BASE_STYLE}>
                            {OTHER_ASSET_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="counterparty" className={labelStyle}>Counterparty (Optional)</label>
                        <input id="counterparty" type="text" value={counterparty} onChange={e => setCounterparty(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., John Doe" />
                    </div>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="location" className={labelStyle}>Location (Optional)</label>
                        <input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Safe Box" />
                    </div>
                     <div>
                        <label htmlFor="assetCondition" className={labelStyle}>Condition (Optional)</label>
                        <input id="assetCondition" type="text" value={assetCondition} onChange={e => setAssetCondition(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Mint" />
                    </div>
                   </div>
                </div>
            )}
            {type === 'Other Liabilities' && (
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="otherLiabilitySubType" className={labelStyle}>Sub-Type</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                            <select id="otherLiabilitySubType" value={otherLiabilitySubType} onChange={e => setOtherLiabilitySubType(e.target.value as OtherLiabilitySubType)} className={INPUT_BASE_STYLE}>
                                {OTHER_LIABILITY_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="counterparty" className={labelStyle}>Owed To (Optional)</label>
                            <input id="counterparty" type="text" value={counterparty} onChange={e => setCounterparty(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Tax Authority" />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="interestRate" className={labelStyle}>Interest Rate (%)</label>
                            <input id="interestRate" type="number" step="0.01" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className={INPUT_BASE_STYLE} />
                        </div>
                     </div>
                 </div>
            )}
            {(type === 'Loan' || type === 'Lending') && (
                <div className="space-y-4">
                  <div>
                        <p className="font-medium mb-2">{type} Breakdown</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">Enter any two values to calculate the third. The account balance will be the {type === 'Loan' ? 'negative' : 'positive'} of the principal.</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div><label htmlFor="totalAmount" className={labelStyle}>Total Amount</label><input id="totalAmount" type="number" step="0.01" value={totalAmount} onFocus={() => setLastEditedLoanField('total')} onChange={e=>{setTotalAmount(e.target.value); setLastEditedLoanField('total');}} className={INPUT_BASE_STYLE} /></div>
                            <div><label htmlFor="principalAmount" className={labelStyle}>Principal</label><input id="principalAmount" type="number" step="0.01" value={principalAmount} onFocus={() => setLastEditedLoanField('principal')} onChange={e=>{setPrincipalAmount(e.target.value); setLastEditedLoanField('principal');}} className={INPUT_BASE_STYLE} /></div>
                            <div><label htmlFor="interestAmount" className={labelStyle}>Interest</label><input id="interestAmount" type="number" step="0.01" value={interestAmount} onFocus={() => setLastEditedLoanField('interest')} onChange={e=>{setInterestAmount(e.target.value); setLastEditedLoanField('interest');}} className={INPUT_BASE_STYLE} /></div>
                        </div>
                    </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                    <div><label htmlFor="interestRate" className={labelStyle}>Interest Rate (%)</label><input id="interestRate" type="number" step="0.01" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                    <div><label htmlFor="duration" className={labelStyle}>Duration (months)</label><input id="duration" type="number" value={duration} onChange={e=>setDuration(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div><label htmlFor="loanStartDate" className={labelStyle}>Start Date</label><input id="loanStartDate" type="date" value={loanStartDate} onChange={e=>setLoanStartDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                        {type === 'Loan' && <div><label htmlFor="downPayment" className={labelStyle}>Down Payment (Optional)</label><input id="downPayment" type="number" step="0.01" value={downPayment} onChange={e=>setDownPayment(e.target.value)} className={INPUT_BASE_STYLE} /></div>}
                   </div>
                    <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="monthlyPayment" className={labelStyle}>Monthly Payment (Optional)</label>
                                <input id="monthlyPayment" type="number" step="0.01" value={monthlyPayment} onChange={e=>setMonthlyPayment(e.target.value)} className={INPUT_BASE_STYLE} />
                            </div>
                            <div>
                                <label htmlFor="paymentDayOfMonth" className={labelStyle}>Payment Day of Month</label>
                                <input id="paymentDayOfMonth" type="number" min="1" max="31" value={paymentDayOfMonth} onChange={e=>setPaymentDayOfMonth(e.target.value)} className={INPUT_BASE_STYLE} />
                            </div>
                        </div>
                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary -mt-2">
                            If set, a recurring payment will be scheduled. If blank, payment is calculated from loan terms.
                        </p>
                    </div>
                   <div>
                        <label htmlFor="linkedAccountId" className={labelStyle}>Linked Debit Account</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select id="linkedAccountId" value={linkedAccountId} onChange={e => setLinkedAccountId(e.target.value)} className={INPUT_BASE_STYLE}>
                                <option value="">None</option>
                                {ALL_ACCOUNT_TYPES.map(type => {
                                    const group = groupedDebitAccounts[type];
                                    if (!group || group.length === 0) return null;
                                    return (
                                        <optgroup key={type} label={type}>
                                            {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                        </optgroup>
                                    );
                                })}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                </div>
            )}
             {type === 'Vehicle' && (
                <div className="space-y-4">
                    <div className="flex justify-center mb-4">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                          <div className="w-24 h-24 rounded-full bg-light-fill dark:bg-dark-fill flex items-center justify-center overflow-hidden border border-black/10 dark:border-white/10">
                              {vehicleImage ? (
                                  <img src={vehicleImage} alt="Vehicle" className="w-full h-full object-cover" />
                              ) : (
                                  <span className="material-symbols-outlined text-4xl text-gray-400">directions_car</span>
                              )}
                          </div>
                          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="material-symbols-outlined text-white">upload</span>
                          </div>
                          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                      </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label htmlFor="make" className={labelStyle}>Make</label><input id="make" type="text" value={make} onChange={e=>setMake(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                    <div><label htmlFor="model" className={labelStyle}>Model</label><input id="model" type="text" value={model} onChange={e=>setModel(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                    <div><label htmlFor="year" className={labelStyle}>Year</label><input id="year" type="number" value={year} onChange={e=>setYear(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1"><label htmlFor="regCode" className={labelStyle}>Reg. Code</label><input id="regCode" type="text" value={registrationCountryCode} onChange={e=>setRegistrationCountryCode(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. B" /></div>
                    <div className="col-span-1"><label htmlFor="plate" className={labelStyle}>License Plate</label><input id="plate" type="text" value={licensePlate} onChange={e=>setLicensePlate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                    <div className="col-span-1"><label htmlFor="vin" className={labelStyle}>VIN</label><input id="vin" type="text" value={vin} onChange={e=>setVin(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="fuel" className={labelStyle}>Fuel Type</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select id="fuel" value={fuelType} onChange={e => setFuelType(e.target.value as FuelType)} className={INPUT_BASE_STYLE}>
                                {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                     </div>
                  </div>
                   <div>
                        <label className={labelStyle}>Ownership</label>
                        <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                             {VEHICLE_OWNERSHIP_TYPES.map(o => (
                                 <button key={o} type="button" onClick={() => setVehicleOwnership(o)} className={`flex-1 py-1 rounded-md text-sm font-medium transition-all ${vehicleOwnership === o ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500'}`}>{o}</button>
                             ))}
                        </div>
                   </div>
                   {vehicleOwnership === 'Owned' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div><label htmlFor="purchasePrice" className={labelStyle}>Purchase Price</label><input id="purchasePrice" type="number" step="0.01" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                            <div><label htmlFor="purchaseDate" className={labelStyle}>Purchase Date</label><input id="purchaseDate" type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                        </div>
                   )}
                   {vehicleOwnership === 'Leased' && (
                       <div className="space-y-4">
                            <div><label htmlFor="leaseProvider" className={labelStyle}>Lease Provider</label><input id="leaseProvider" type="text" value={leaseProvider} onChange={e=>setLeaseProvider(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. LeasePlan" /></div>
                           <div className="grid grid-cols-2 gap-4">
                                <div><label htmlFor="leaseStart" className={labelStyle}>Lease Start</label><input id="leaseStart" type="date" value={leaseStartDate} onChange={e=>setLeaseStartDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                <div><label htmlFor="leaseEnd" className={labelStyle}>Lease End</label><input id="leaseEnd" type="date" value={leaseEndDate} onChange={e=>setLeaseEndDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                <div className="col-span-2"><label htmlFor="annualMileageAllowance" className={labelStyle}>Annual Mileage Allowance (km)</label><input id="annualMileageAllowance" type="number" value={annualMileageAllowance} onChange={e=>setAnnualMileageAllowance(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. 15000" /></div>
                                <div><label htmlFor="leasePaymentAmount" className={labelStyle}>Lease Price (Optional)</label><input id="leasePaymentAmount" type="number" step="0.01" value={leasePaymentAmount} onChange={e=>setLeasePaymentAmount(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                <div><label htmlFor="leasePaymentDay" className={labelStyle}>Payment Day (Optional)</label><input id="leasePaymentDay" type="number" min="1" max="31" value={leasePaymentDay} onChange={e=>setLeasePaymentDay(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                <div className="col-span-2">
                                    <label htmlFor="leasePaymentAccountId" className={labelStyle}>Payment Account (Optional)</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="leasePaymentAccountId" value={leasePaymentAccountId} onChange={e => setLeasePaymentAccountId(e.target.value)} className={INPUT_BASE_STYLE}>
                                            <option value="">None</option>
                                            {ALL_ACCOUNT_TYPES.map(type => {
                                                const group = groupedDebitAccounts[type];
                                                if (!group || group.length === 0) return null;
                                                return (
                                                    <optgroup key={type} label={type}>
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

                   <div className="pt-4 border-t border-black/10 dark:border-white/10">
                       <h4 className="font-medium mb-2">Mileage Logs</h4>
                       <div className="flex gap-2 mb-2">
                           <input type="date" value={newLogDate} onChange={e => setNewLogDate(e.target.value)} className={INPUT_BASE_STYLE} />
                           <input type="number" placeholder="Km" value={newLogReading} onChange={e => setNewLogReading(e.target.value)} className={INPUT_BASE_STYLE} />
                           <button type="button" onClick={handleAddLog} className={BTN_SECONDARY_STYLE}>Add</button>
                       </div>
                       <div className="max-h-32 overflow-y-auto space-y-1">
                           {mileageLogs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log, index) => (
                               <div key={log.id || index} className="flex justify-between items-center text-sm p-2 bg-light-fill dark:bg-dark-fill rounded">
                                   <span>{log.date}: {log.reading.toLocaleString()} km</span>
                                   <button type="button" onClick={() => handleDeleteLog(index)} className="text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
                               </div>
                           ))}
                       </div>
                   </div>
                </div>
            )}
            {type === 'Property' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="propertyType" className={labelStyle}>Property Type</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select id="propertyType" value={propertyType} onChange={e => setPropertyType(e.target.value as PropertyType)} className={INPUT_BASE_STYLE}>
                              {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                            </select>
                             <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                          </div>
                        </div>
                         <div><label htmlFor="purchasePrice" className={labelStyle}>Purchase Price</label><input id="purchasePrice" type="number" step="0.01" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} className={INPUT_BASE_STYLE} disabled={isLoanForPropertyLinked} /></div>
                      </div>
                      <div><label htmlFor="address" className={labelStyle}>Address</label><input id="address" type="text" value={address} onChange={e=>setAddress(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                      
                      <div className="grid grid-cols-3 gap-4">
                         <div><label htmlFor="propertySize" className={labelStyle}>Size (m²)</label><input id="propertySize" type="number" value={propertySize} onChange={e=>setPropertySize(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                         <div><label htmlFor="yearBuilt" className={labelStyle}>Year Built</label><input id="yearBuilt" type="number" value={yearBuilt} onChange={e=>setYearBuilt(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                         <div><label htmlFor="floors" className={labelStyle}>Floors</label><input id="floors" type="number" value={floors} onChange={e=>setFloors(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div><label htmlFor="bedrooms" className={labelStyle}>Bedrooms</label><input id="bedrooms" type="number" value={bedrooms} onChange={e=>setBedrooms(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                         <div><label htmlFor="bathrooms" className={labelStyle}>Bathrooms</label><input id="bathrooms" type="number" value={bathrooms} onChange={e=>setBathrooms(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={hasBasement} onChange={e => setHasBasement(e.target.checked)} className={CHECKBOX_STYLE} />
                            <span className="text-sm font-medium text-light-text dark:text-dark-text">Has Basement</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={hasAttic} onChange={e => setHasAttic(e.target.checked)} className={CHECKBOX_STYLE} />
                            <span className="text-sm font-medium text-light-text dark:text-dark-text">Has Attic</span>
                         </label>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div><label htmlFor="indoorParking" className={labelStyle}>Indoor Parking (Cars)</label><input id="indoorParking" type="number" value={indoorParkingSpaces} onChange={e=>setIndoorParkingSpaces(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                         <div><label htmlFor="outdoorParking" className={labelStyle}>Outdoor Parking (Cars)</label><input id="outdoorParking" type="number" value={outdoorParkingSpaces} onChange={e=>setOutdoorParkingSpaces(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-end">
                         <div className="mb-3">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={hasGarden} onChange={e => setHasGarden(e.target.checked)} className={CHECKBOX_STYLE} />
                                <span className="text-sm font-medium text-light-text dark:text-dark-text">Has Garden</span>
                             </label>
                         </div>
                         <div>
                            <label htmlFor="gardenSize" className={labelStyle}>Garden Size (m²)</label>
                            <input id="gardenSize" type="number" value={gardenSize} onChange={e=>setGardenSize(e.target.value)} className={INPUT_BASE_STYLE} disabled={!hasGarden} />
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 items-end">
                         <div className="mb-3">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={hasTerrace} onChange={e => setHasTerrace(e.target.checked)} className={CHECKBOX_STYLE} />
                                <span className="text-sm font-medium text-light-text dark:text-dark-text">Has Terrace</span>
                             </label>
                         </div>
                         <div>
                            <label htmlFor="terraceSize" className={labelStyle}>Terrace Size (m²)</label>
                            <input id="terraceSize" type="number" value={terraceSize} onChange={e=>setTerraceSize(e.target.value)} className={INPUT_BASE_STYLE} disabled={!hasTerrace} />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-black/10 dark:border-white/10 pt-4">
                          <div>
                            <label htmlFor="linkedLoanId" className={labelStyle}>Linked Loan (Optional)</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select id="linkedLoanId" value={linkedLoanId} onChange={e => setLinkedLoanId(e.target.value)} className={INPUT_BASE_STYLE}>
                                    <option value="">None</option>
                                    {ALL_ACCOUNT_TYPES.map(type => {
                                        const group = groupedLoanAccounts[type];
                                        if (!group || group.length === 0) return null;
                                        return (
                                            <optgroup key={type} label={type}>
                                                {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                          </div>
                           <div>
                            <label htmlFor="principalOwned" className={labelStyle}>Principal Owned</label>
                            <input id="principalOwned" type="number" step="0.01" value={principalOwned} onChange={e=>setPrincipalOwned(e.target.value)} className={INPUT_BASE_STYLE} disabled={isLoanForPropertyLinked} />
                            {isLoanForPropertyLinked && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Calculated from linked loan.</p>}
                        </div>
                      </div>
                  </div>
                  
                  {/* Recurring Expenses & Income Section */}
                  <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg space-y-4">
                        <h4 className="font-semibold text-light-text dark:text-dark-text border-b border-black/10 dark:border-white/10 pb-2">Recurring Expenses & Income</h4>
                        
                        {/* Property Tax */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Property Tax</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label htmlFor="propTaxAmt" className={labelStyle}>Annual Amount</label><input id="propTaxAmt" type="number" step="0.01" value={propertyTaxAmount} onChange={e=>setPropertyTaxAmount(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" /></div>
                                <div><label htmlFor="propTaxDate" className={labelStyle}>Next Due Date</label><input id="propTaxDate" type="date" value={propertyTaxDate} onChange={e=>setPropertyTaxDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                            </div>
                        </div>

                         {/* Home Insurance */}
                         <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Home Insurance</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label htmlFor="insProvider" className={labelStyle}>Provider</label><input id="insProvider" type="text" value={insuranceProvider} onChange={e=>setInsuranceProvider(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                <div><label htmlFor="insPolicy" className={labelStyle}>Policy Number</label><input id="insPolicy" type="text" value={insurancePolicyNumber} onChange={e=>setInsurancePolicyNumber(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label htmlFor="insAmount" className={labelStyle}>Amount</label><input id="insAmount" type="number" step="0.01" value={insuranceAmount} onChange={e=>setInsuranceAmount(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                <div>
                                    <label htmlFor="insFreq" className={labelStyle}>Frequency</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="insFreq" value={insuranceFrequency} onChange={e => setInsuranceFrequency(e.target.value as RecurrenceFrequency)} className={INPUT_BASE_STYLE}>
                                            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                                <div><label htmlFor="insDate" className={labelStyle}>Next Payment</label><input id="insDate" type="date" value={insurancePaymentDate} onChange={e=>setInsurancePaymentDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                            </div>
                        </div>
                        
                        {/* HOA Fees */}
                         <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">HOA / Syndic Fees</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label htmlFor="hoaAmount" className={labelStyle}>Amount</label><input id="hoaAmount" type="number" step="0.01" value={hoaFeeAmount} onChange={e=>setHoaFeeAmount(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                <div>
                                    <label htmlFor="hoaFreq" className={labelStyle}>Frequency</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="hoaFreq" value={hoaFeeFrequency} onChange={e => setHoaFeeFrequency(e.target.value as RecurrenceFrequency)} className={INPUT_BASE_STYLE}>
                                            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rental Income */}
                        <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Rental Income</p>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={isRental} onChange={e => setIsRental(e.target.checked)} className={CHECKBOX_STYLE} />
                                    <span className="text-sm font-medium text-light-text dark:text-dark-text">Is Rental Property</span>
                                </label>
                            </div>
                            {isRental && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label htmlFor="rentAmount" className={labelStyle}>Income Amount</label><input id="rentAmount" type="number" step="0.01" value={rentalIncomeAmount} onChange={e=>setRentalIncomeAmount(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                                    <div>
                                        <label htmlFor="rentFreq" className={labelStyle}>Frequency</label>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select id="rentFreq" value={rentalIncomeFrequency} onChange={e => setRentalIncomeFrequency(e.target.value as RecurrenceFrequency)} className={INPUT_BASE_STYLE}>
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
            )}
            {(type === 'Other Assets' || type === 'Other Liabilities') && (
              <div><label htmlFor="notes" className={labelStyle}>Notes</label><textarea id="notes" value={notes} onChange={e=>setNotes(e.target.value)} className={INPUT_BASE_STYLE} rows={2}></textarea></div>
            )}

            {type === 'Credit Card' && (
              <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label htmlFor="statement-start" className={labelStyle}>Statement Day</label><input id="statement-start" type="number" min="1" max="31" value={statementStartDate} onChange={(e) => setStatementStartDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                       <div><label htmlFor="payment-date" className={labelStyle}>Payment Day</label><input id="payment-date" type="number" min="1" max="31" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                  </div>
                  <div>
                      <label htmlFor="settlement-account" className={labelStyle}>Settlement Account</label>
                      <div className={SELECT_WRAPPER_STYLE}>
                           <select id="settlement-account" value={settlementAccountId} onChange={(e) => setSettlementAccountId(e.target.value)} className={INPUT_BASE_STYLE}>
                              <option value="">Select an account</option>
                              {ALL_ACCOUNT_TYPES.map(type => {
                                  const group = groupedDebitAccounts[type];
                                  if (!group || group.length === 0) return null;
                                  return (
                                    <optgroup key={type} label={type}>
                                      {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </optgroup>
                                  );
                              })}
                          </select>
                          <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                      </div>
                  </div>
                  <div><label htmlFor="credit-limit" className={labelStyle}>Credit Limit (Optional)</label><input id="credit-limit" type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className={INPUT_BASE_STYLE} /></div>
              </div>
            )}
          </div>

          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg">
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-medium text-light-text dark:text-dark-text">Primary Account</p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Set as the default account for this account type (e.g., default {type}).</p>
                </div>
                <div 
                  onClick={() => setIsPrimary(!isPrimary)}
                  className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors ${isPrimary ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${isPrimary ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
            </div>
          </div>


          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-4 border-t border-black/10 dark:border-white/10">
            <div>
                <button type="button" onClick={handleDelete} className={BTN_DANGER_STYLE}>Delete Account</button>
            </div>
            <div className="flex flex-wrap gap-4 justify-end">
                <button 
                    type="button" 
                    onClick={handleToggleStatus} 
                    className={BTN_SECONDARY_STYLE}
                >
                    {account.status === 'closed' ? 'Reopen Account' : 'Close Account'}
                </button>
                <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                <button type="submit" className={BTN_PRIMARY_STYLE}>Save Changes</button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default EditAccountModal;

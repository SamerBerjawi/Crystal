import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Account, AccountType, Currency, InvestmentSubType, PropertyType, Warrant, FuelType, VehicleOwnership, MileageLog, RecurrenceFrequency, OtherAssetSubType, OtherLiabilitySubType } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_STYLES, INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ACCOUNT_ICON_LIST, INVESTMENT_SUB_TYPES, PROPERTY_TYPES, INVESTMENT_SUB_TYPE_STYLES, FUEL_TYPES, VEHICLE_OWNERSHIP_TYPES, FREQUENCIES, CARD_NETWORKS, OTHER_ASSET_SUB_TYPES, OTHER_LIABILITY_SUB_TYPES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';
import IconPicker from './IconPicker';
import { v4 as uuidv4 } from 'uuid';
import { toLocalISOString } from '../utils';
import { toast } from 'sonner';
import Icon from './ui/Icon';

interface EditAccountModalProps {
  onClose: () => void;
  onSave: (account: Account) => void;
  onDelete: (accountId: string) => void;
  account: Account;
  accounts: Account[];
  warrants: Warrant[];
  onToggleStatus: (accountId: string) => void;
}

type ActiveTabType = 'core' | 'specs' | 'extras';

const EditAccountModal: React.FC<EditAccountModalProps> = ({ 
  onClose, 
  onSave, 
  onDelete, 
  account, 
  accounts, 
  warrants, 
  onToggleStatus 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('core');

  // Migrate legacy 'Crypto' type to 'Investment'
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

  // Detailed fields
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

  // Credit card specific
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

  // Trigger smooth drawer entry animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isIconPickerOpen) {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIconPickerOpen]);

  const handleCloseDrawer = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

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
      toast.success('Mileage log added');
    }
  };
  
  const handleDeleteLog = (index: number) => {
    setMileageLogs(prev => prev.filter((_, i) => i !== index));
    toast.info('Mileage log deleted');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter an account name');
      return;
    }
    
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
      name: name.trim(),
      type,
      balance: type === 'Loan' 
        ? -Math.abs(principalAmount !== '' ? parseFloat(principalAmount) : 0) 
        : (type === 'Lending' ? Math.abs(principalAmount !== '' ? parseFloat(principalAmount) : 0) : (isComputedAccount ? account.balance : (balance !== '' ? parseFloat(balance) : 0))),
      currency,
      icon,
      last4: hasCard && last4 ? last4 : undefined,
      financialInstitution: ['Checking', 'Savings', 'Credit Card'].includes(type) && financialInstitution ? financialInstitution.trim() : undefined,
      isPrimary,
      includeInAnalytics,
      accountNumber: accountNumber ? accountNumber.trim() : undefined,
      routingNumber: routingNumber ? routingNumber.trim() : undefined,
      apy: apy !== '' ? parseFloat(apy) : undefined,
      openingDate: openingDate || undefined,
      expirationDate: hasCard && expirationDate ? expirationDate : undefined,
      cardNetwork: hasCard && cardNetwork ? cardNetwork : undefined,
      cardholderName: hasCard && cardholderName ? cardholderName.trim() : undefined,

      ...(type === 'Investment' && { 
        subType,
        symbol: symbol ? symbol.trim().toUpperCase() : undefined,
        expectedRetirementYear: subType === 'Pension Fund' && expectedRetirementYear ? parseInt(expectedRetirementYear, 10) : undefined,
        linkedAccountId: subType === 'Spare Change' ? linkedAccountId : undefined,
      }),
      ...(type === 'Other Assets' && { 
        otherSubType: otherAssetSubType,
        location: location ? location.trim() : undefined,
        assetCondition: assetCondition ? assetCondition.trim() : undefined,
        counterparty: counterparty ? counterparty.trim() : undefined,
      }),
      ...(type === 'Other Liabilities' && { 
        otherSubType: otherLiabilitySubType,
        counterparty: counterparty ? counterparty.trim() : undefined,
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

      make: type === 'Vehicle' ? make.trim() || undefined : undefined,
      model: type === 'Vehicle' ? model.trim() || undefined : undefined,
      year: type === 'Vehicle' && year !== '' ? parseInt(year, 10) : undefined,
      licensePlate: type === 'Vehicle' ? licensePlate.trim() || undefined : undefined,
      registrationCountryCode: type === 'Vehicle' ? registrationCountryCode.trim() || undefined : undefined,
      vin: type === 'Vehicle' ? vin.trim() || undefined : undefined,
      fuelType: type === 'Vehicle' ? fuelType : undefined,
      ownership: type === 'Vehicle' ? vehicleOwnership : undefined,
      purchaseDate: type === 'Vehicle' && vehicleOwnership === 'Owned' && purchaseDate ? purchaseDate : undefined,
      leaseProvider: type === 'Vehicle' && vehicleOwnership === 'Leased' && leaseProvider ? leaseProvider.trim() : undefined,
      leaseStartDate: type === 'Vehicle' && vehicleOwnership === 'Leased' && leaseStartDate ? leaseStartDate : undefined,
      leaseEndDate: type === 'Vehicle' && vehicleOwnership === 'Leased' && leaseEndDate ? leaseEndDate : undefined,
      annualMileageAllowance: type === 'Vehicle' && vehicleOwnership === 'Leased' && annualMileageAllowance !== '' ? parseInt(annualMileageAllowance, 10) : undefined,
      leasePaymentAmount: type === 'Vehicle' && vehicleOwnership === 'Leased' && leasePaymentAmount !== '' ? parseFloat(leasePaymentAmount) : undefined,
      leasePaymentDay: type === 'Vehicle' && vehicleOwnership === 'Leased' && leasePaymentDay !== '' ? parseInt(leasePaymentDay, 10) : undefined,
      leasePaymentAccountId: type === 'Vehicle' && vehicleOwnership === 'Leased' && leasePaymentAccountId ? leasePaymentAccountId : undefined,
      imageUrl: type === 'Vehicle' ? vehicleImage || undefined : undefined,
      mileageLogs: type === 'Vehicle' ? updatedMileageLogs : undefined,

      ...(type === 'Property' && {
        address: address.trim() || undefined,
        propertyType,
        purchasePrice: !isLoanForPropertyLinked && purchasePrice !== '' ? parseFloat(purchasePrice) : undefined,
        principalOwned: !isLoanForPropertyLinked && principalOwned !== '' ? parseFloat(principalOwned) : undefined,
        linkedLoanId: linkedLoanId || undefined,
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
        propertyTaxAmount: propertyTaxAmount !== '' ? parseFloat(propertyTaxAmount) : undefined,
        propertyTaxDate: propertyTaxDate || undefined,
        insuranceProvider: insuranceProvider.trim() || undefined,
        insurancePolicyNumber: insurancePolicyNumber.trim() || undefined,
        insuranceAmount: insuranceAmount !== '' ? parseFloat(insuranceAmount) : undefined,
        insuranceFrequency,
        insurancePaymentDate: insurancePaymentDate || undefined,
        hoaFeeAmount: hoaFeeAmount !== '' ? parseFloat(hoaFeeAmount) : undefined,
        hoaFeeFrequency,
        isRental,
        rentalIncomeAmount: isRental && rentalIncomeAmount !== '' ? parseFloat(rentalIncomeAmount) : undefined,
        rentalIncomeFrequency: isRental ? rentalIncomeFrequency : undefined,
      }),

      ...((type === 'Other Assets' || type === 'Other Liabilities') && { notes: notes.trim() || undefined }),
      ...(type === 'Credit Card' && {
        statementStartDate: statementStartDate !== '' ? parseInt(statementStartDate, 10) : undefined,
        paymentDate: paymentDate !== '' ? parseInt(paymentDate, 10) : undefined,
        settlementAccountId: settlementAccountId || undefined,
        creditLimit: creditLimit !== '' ? parseFloat(creditLimit) : undefined,
      })
    };

    onSave(updatedAccount);
    handleCloseDrawer();
  };

  const handleDelete = () => {
    onDelete(account.id);
    handleCloseDrawer();
  };

  const handleToggleStatus = () => {
    onToggleStatus(account.id);
  };
  
  const labelStyle = "block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-1.5";
  const showBankingDetails = ['Checking', 'Savings', 'Investment', 'Credit Card', 'Lending'].includes(type);

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop Blur Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleCloseDrawer}
      />

      {/* Right-Side Full Height Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div 
          className={`w-screen max-w-full sm:max-w-xl md:max-w-2xl h-screen bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header matching CategoryModal */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIconPickerOpen(true)}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md transition-transform hover:scale-105 bg-primary-500"
                title="Change Icon"
              >
                <Icon name={icon} className="text-2xl" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                    Edit Account
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                    {type}
                  </span>
                  {account.status === 'closed' && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Modify balance, banking credentials & settings
                </p>
              </div>
            </div>
            <button 
              onClick={handleCloseDrawer}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

            {/* Hero Card: Avatar / Icon + Account Name + Type & Liquidity */}
            <div className="px-5 sm:px-6 py-3 space-y-3">
              <div className="p-4 rounded-3xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs space-y-3">
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="relative group shrink-0 cursor-pointer focus:outline-none"
                    title="Change Account Icon"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <Icon name={icon} className={`${iconColorClass} text-2xl group-hover:scale-110 transition-transform`} />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary-500 border-2 border-white dark:border-dark-card rounded-full flex items-center justify-center shadow-xs">
                        <Icon name="edit" className="text-white text-[10px]" />
                      </div>
                    </div>
                  </button>

                  <div className="flex-1 min-w-0">
                    <label htmlFor="drawer-edit-acc-name" className="text-2xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-0.5">
                      Account Identifier
                    </label>
                    <input
                      id="drawer-edit-acc-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-transparent border-none text-xl sm:text-2xl font-black text-gray-900 dark:text-white placeholder-black/20 dark:placeholder-white/20 focus:ring-0 p-0 tracking-tight"
                      placeholder="Account Name"
                      required
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Type & Balance Header Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-black/5 dark:border-white/5">
                  <div>
                    <label className={labelStyle}>Categorical Type</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as AccountType)}
                        className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}
                      >
                        {ALL_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                    </div>
                  </div>

                  {type !== 'Loan' && type !== 'Lending' ? (
                    <div>
                      <label className={labelStyle}>
                        {isComputedAccount ? 'Portfolio Market Value' : ((type === 'Vehicle' || type === 'Property') ? 'Appraisal Value' : 'Current Liquidity')}
                      </label>
                      <div className="relative flex">
                        <input
                          type="number"
                          step="0.01"
                          value={balance}
                          onChange={(e) => setBalance(e.target.value)}
                          className={`${INPUT_BASE_STYLE} !h-10 rounded-r-none border-r-0 font-black !text-sm tabular-nums`}
                          placeholder="0.00"
                          disabled={isComputedAccount}
                        />
                        <div className={`${SELECT_WRAPPER_STYLE} w-24`}>
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as Currency)}
                            className={`${SELECT_STYLE} !h-10 rounded-l-none bg-gray-100/70 dark:bg-white/10 border-l border-black/10 dark:border-white/10 !text-xs font-bold`}
                          >
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className={labelStyle}>Principal Net Capital</label>
                      <div className="relative flex">
                        <input
                          type="number"
                          step="0.01"
                          value={principalAmount}
                          onChange={(e) => {
                            setPrincipalAmount(e.target.value);
                            setLastEditedLoanField('principal');
                          }}
                          className={`${INPUT_BASE_STYLE} !h-10 rounded-r-none border-r-0 font-black !text-sm tabular-nums text-rose-500`}
                          placeholder="0.00"
                        />
                        <div className={`${SELECT_WRAPPER_STYLE} w-24`}>
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as Currency)}
                            className={`${SELECT_STYLE} !h-10 rounded-l-none bg-gray-100/70 dark:bg-white/10 border-l border-black/10 dark:border-white/10 !text-xs font-bold`}
                          >
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="px-5 sm:px-6 flex gap-1 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('core')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'core'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="assignment" className="text-sm" />
                <span>Identity & Core</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('specs')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'specs'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="tune" className="text-sm" />
                <span>Specifications</span>
                <span className="text-2xs font-mono font-bold px-1.5 py-0.2 rounded-full bg-primary-500/10 text-primary-500">
                  {type}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('extras')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'extras'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="credit_card" className="text-sm" />
                <span>Card & Extras</span>
                {hasCard && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                )}
              </button>
            </div>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
            <form id="edit-account-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* TAB 1: IDENTITY & CORE */}
              {activeTab === 'core' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Banking & Institution Core Card */}
                  {(showBankingDetails || ['Checking', 'Savings', 'Credit Card'].includes(type)) && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="account_balance" className="text-sm text-primary-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Banking & Institution Core</span>
                        </div>
                        <span className="text-2xs text-primary-500 font-semibold uppercase">Routing Parameters</span>
                      </div>

                      {['Checking', 'Savings', 'Credit Card'].includes(type) && (
                        <div>
                          <label className={labelStyle}>Primary Financial Institution</label>
                          <div className="relative group">
                            <Icon name="assured_workload" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                            <input
                              type="text"
                              value={financialInstitution}
                              onChange={(e) => setFinancialInstitution(e.target.value)}
                              className={`${INPUT_BASE_STYLE} pl-10 !h-10 text-xs font-bold`}
                              placeholder="e.g. JPMorgan Chase, Barclays, BNP Paribas"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Account / IBAN Number</label>
                          <input
                            type="text"
                            value={accountNumber}
                            onChange={e => setAccountNumber(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-10 text-xs font-mono font-bold tracking-wider`}
                            placeholder="**** **** ****"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className={labelStyle}>Routing / BIC Code</label>
                          <input
                            type="text"
                            value={routingNumber}
                            onChange={e => setRoutingNumber(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-10 text-xs font-mono font-bold tracking-wider`}
                            placeholder="ROUTING / BIC"
                            autoComplete="off"
                          />
                        </div>
                        {['Checking', 'Savings', 'Investment'].includes(type) && (
                          <div>
                            <label className={labelStyle}>Annual Percentage Yield (APY %)</label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                value={apy}
                                onChange={e => setApy(e.target.value)}
                                className={`${INPUT_BASE_STYLE} !h-10 text-xs font-bold text-emerald-500 pr-8`}
                                placeholder="0.00"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-xs">%</span>
                            </div>
                          </div>
                        )}
                        <div>
                          <label className={labelStyle}>Account Onboarding Date</label>
                          <input
                            type="date"
                            value={openingDate}
                            onChange={e => setOpeningDate(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-10 text-xs font-medium`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Systemic Integration & Designations */}
                  <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                    <span className="text-2xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1">
                      Systemic Flags & Preferences
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsPrimary(!isPrimary)}
                      className={`flex justify-between items-center w-full p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isPrimary
                          ? 'bg-primary-500/10 border-primary-500/30'
                          : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-primary-500/20'
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Primary Designation</p>
                        <p className="text-2xs text-gray-400 mt-0.5">Set as the default apex account for this type</p>
                      </div>
                      <div className={`w-9 h-5 rounded-full transition-colors relative ${isPrimary ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white transition-transform ${isPrimary ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeInAnalytics(!includeInAnalytics)}
                      className={`flex justify-between items-center w-full p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        includeInAnalytics
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-emerald-500/20'
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Analytics Integration</p>
                        <p className="text-2xs text-gray-400 mt-0.5">Include in net-worth calculations & cashflow reports</p>
                      </div>
                      <div className={`w-9 h-5 rounded-full transition-colors relative ${includeInAnalytics ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white transition-transform ${includeInAnalytics ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: SPECIFICATIONS (Dynamic based on Account Type) */}
              {activeTab === 'specs' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* INVESTMENT TYPE */}
                  {type === 'Investment' && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="trending_up" className="text-sm text-purple-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Market & Vehicle Class</span>
                        </div>
                        <span className="text-2xs text-purple-500 font-semibold uppercase">Investment Specs</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Investment Vehicle Class</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select
                              value={subType}
                              onChange={e => setSubType(e.target.value as InvestmentSubType)}
                              className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}
                            >
                              {INVESTMENT_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>

                        {['Stock', 'ETF', 'Crypto'].includes(subType) && (
                          <div>
                            <label className={labelStyle}>Ticker Symbol / Asset Identifier</label>
                            <input
                              type="text"
                              value={symbol}
                              onChange={e => setSymbol(e.target.value)}
                              className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-mono font-bold tracking-wider`}
                              placeholder="e.g. AAPL, VWCE, BTC"
                              autoComplete="off"
                            />
                          </div>
                        )}

                        {subType === 'Pension Fund' && (
                          <div>
                            <label className={labelStyle}>Target Retirement Year</label>
                            <input
                              type="number"
                              value={expectedRetirementYear}
                              onChange={e => setExpectedRetirementYear(e.target.value)}
                              className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`}
                              placeholder="2055"
                            />
                          </div>
                        )}

                        {subType === 'Spare Change' && (
                          <div className="col-span-1 sm:col-span-2">
                            <label className={labelStyle}>Source Round-Up Ledger</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select
                                value={linkedAccountId}
                                onChange={e => setLinkedAccountId(e.target.value)}
                                className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}
                              >
                                <option value="">Detached</option>
                                {ALL_ACCOUNT_TYPES.map(t => {
                                  const group = groupedDebitAccounts[t];
                                  if (!group || group.length === 0) return null;
                                  return (
                                    <optgroup key={t} label={t}>
                                      {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </optgroup>
                                  );
                                })}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* VEHICLE TYPE & MILEAGE HISTORY LOGS */}
                  {type === 'Vehicle' && (
                    <div className="space-y-4">
                      <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                          <div className="flex items-center gap-2">
                            <Icon name="directions_car" className="text-sm text-slate-500" />
                            <span className="text-xs font-bold text-gray-900 dark:text-white">Automotive Specifications</span>
                          </div>
                          <span className="text-2xs text-slate-500 font-semibold uppercase">Registry Core</span>
                        </div>

                        {/* Image Upload Box */}
                        <div className="flex flex-col items-center">
                          <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="relative group w-full max-w-sm aspect-video bg-white dark:bg-black/20 rounded-2xl flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-black/10 dark:border-white/10 hover:border-primary-500 transition-all cursor-pointer"
                          >
                            {vehicleImage ? (
                              <>
                                <img src={vehicleImage} alt="Vehicle" className="w-full h-full object-cover p-0 border-0" />
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-white text-2xs font-bold uppercase tracking-wider text-center">
                                  Change Image
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-2 p-4 text-center">
                                <Icon name="add_a_photo" className="text-2xl text-primary-500" />
                                <p className="text-xs font-bold text-gray-900 dark:text-white">Vehicle Photo Upload</p>
                                <p className="text-2xs text-gray-400">Click to attach image</p>
                              </div>
                            )}
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className={labelStyle}>Manufacturer</label>
                            <input type="text" value={make} onChange={e => setMake(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="e.g. Porsche, Tesla" />
                          </div>
                          <div>
                            <label className={labelStyle}>Model / Trim</label>
                            <input type="text" value={model} onChange={e => setModel(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="e.g. 911 GT3, Model 3" />
                          </div>
                          <div>
                            <label className={labelStyle}>Model Year</label>
                            <input type="number" value={year} onChange={e => setYear(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-mono font-bold`} placeholder="2024" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className={labelStyle}>Country Code</label>
                            <input type="text" value={registrationCountryCode} onChange={e => setRegistrationCountryCode(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-mono font-bold text-center`} placeholder="DE, US, FR" />
                          </div>
                          <div>
                            <label className={labelStyle}>License Plate</label>
                            <input type="text" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-mono font-bold text-center`} placeholder="ABC-1234" />
                          </div>
                          <div>
                            <label className={labelStyle}>Chassis VIN</label>
                            <input type="text" value={vin} onChange={e => setVin(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-mono font-bold text-center`} placeholder="17-Digit VIN" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelStyle}>Propulsion Core</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select value={fuelType} onChange={e => setFuelType(e.target.value as FuelType)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                                {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                            </div>
                          </div>
                          <div>
                            <label className={labelStyle}>Odometer Reading (KM)</label>
                            <input type="number" value={currentMileage} onChange={e => setCurrentMileage(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} placeholder="0" />
                          </div>
                        </div>

                        {/* Ownership Switch */}
                        <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                          <label className={labelStyle}>Legal Ownership Status</label>
                          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                            {VEHICLE_OWNERSHIP_TYPES.map(o => (
                              <button 
                                key={o} 
                                type="button" 
                                onClick={() => setVehicleOwnership(o)} 
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  vehicleOwnership === o ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                              >
                                {o}
                              </button>
                            ))}
                          </div>
                        </div>

                        {vehicleOwnership === 'Owned' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className={labelStyle}>Purchase Price</label>
                              <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} />
                            </div>
                            <div>
                              <label className={labelStyle}>Purchase Date</label>
                              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-medium`} />
                            </div>
                          </div>
                        )}

                        {vehicleOwnership === 'Leased' && (
                          <div className="space-y-3 pt-2">
                            <div>
                              <label className={labelStyle}>Lease Provider</label>
                              <input type="text" value={leaseProvider} onChange={e => setLeaseProvider(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="Provider / Leasing Company" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className={labelStyle}>Lease Start</label>
                                <input type="date" value={leaseStartDate} onChange={e => setLeaseStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-medium`} />
                              </div>
                              <div>
                                <label className={labelStyle}>Lease End</label>
                                <input type="date" value={leaseEndDate} onChange={e => setLeaseEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-medium`} />
                              </div>
                              <div>
                                <label className={labelStyle}>Monthly Lease Payment</label>
                                <input type="number" step="0.01" value={leasePaymentAmount} onChange={e => setLeasePaymentAmount(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} />
                              </div>
                              <div>
                                <label className={labelStyle}>Annual KM Allowance</label>
                                <input type="number" value={annualMileageAllowance} onChange={e => setAnnualMileageAllowance(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} placeholder="e.g. 15000" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mileage History Logs Manager Card */}
                      <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className={labelStyle}>Mileage Log History</label>
                          <span className="text-2xs text-primary-500 font-bold">{mileageLogs.length} entries</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={newLogDate}
                            onChange={e => setNewLogDate(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-9 text-xs flex-1`}
                          />
                          <input
                            type="number"
                            placeholder="KM reading"
                            value={newLogReading}
                            onChange={e => setNewLogReading(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-9 text-xs font-bold tabular-nums w-32`}
                          />
                          <button
                            type="button"
                            onClick={handleAddLog}
                            className={`${BTN_PRIMARY_STYLE} !h-9 !px-3 !text-xs`}
                          >
                            <Icon name="add" className="text-xs" />
                            <span>Add</span>
                          </button>
                        </div>

                        {mileageLogs.length > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pt-1">
                            {mileageLogs.map((log, idx) => (
                              <div key={log.id || idx} className="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="text-gray-400">{log.date}</span>
                                  <span className="font-bold text-gray-900 dark:text-white">{log.reading.toLocaleString()} km</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLog(idx)}
                                  className="text-gray-400 hover:text-rose-500 transition-colors p-1"
                                >
                                  <Icon name="delete" className="text-xs" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PROPERTY TYPE */}
                  {type === 'Property' && (
                    <div className="space-y-4">
                      <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                          <div className="flex items-center gap-2">
                            <Icon name="home" className="text-sm text-sky-500" />
                            <span className="text-xs font-bold text-gray-900 dark:text-white">Real Estate Specifications</span>
                          </div>
                          <span className="text-2xs text-sky-500 font-semibold uppercase">Property Core</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelStyle}>Estate Classification</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select value={propertyType} onChange={e => setPropertyType(e.target.value as PropertyType)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                                {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                            </div>
                          </div>
                          <div>
                            <label className={labelStyle}>Acquisition Capital</label>
                            <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} disabled={isLoanForPropertyLinked} />
                          </div>
                        </div>

                        <div>
                          <label className={labelStyle}>Geospatial Address</label>
                          <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-medium`} placeholder="Street, City, Postal Code" />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelStyle}>Internal Area (m²)</label>
                            <input type="number" value={propertySize} onChange={e => setPropertySize(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-center tabular-nums`} />
                          </div>
                          <div>
                            <label className={labelStyle}>Year Built</label>
                            <input type="number" value={yearBuilt} onChange={e => setYearBuilt(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-center`} placeholder="2018" />
                          </div>
                          <div>
                            <label className={labelStyle}>Levels</label>
                            <input type="number" value={floors} onChange={e => setFloors(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-center`} placeholder="2" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelStyle}>Bedrooms</label>
                            <input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-center`} />
                          </div>
                          <div>
                            <label className={labelStyle}>Bathrooms</label>
                            <input type="number" value={bathrooms} onChange={e => setBathrooms(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-center`} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            type="button" 
                            onClick={() => setHasBasement(!hasBasement)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                              hasBasement ? 'bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400' : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-gray-400'
                            }`}
                          >
                            <Icon name={hasBasement ? 'check_box' : 'check_box_outline_blank'} className="text-sm" />
                            <span className="text-xs font-bold">Basement</span>
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setHasAttic(!hasAttic)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                              hasAttic ? 'bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400' : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-gray-400'
                            }`}
                          >
                            <Icon name={hasAttic ? 'check_box' : 'check_box_outline_blank'} className="text-sm" />
                            <span className="text-xs font-bold">Attic</span>
                          </button>
                        </div>

                        {/* Linked Loan & Owned Equity */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-black/5 dark:border-white/5">
                          <div>
                            <label className={labelStyle}>Linked Mortgage Loan</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select value={linkedLoanId} onChange={e => setLinkedLoanId(e.target.value)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                                <option value="">Detached / No Loan</option>
                                {ALL_ACCOUNT_TYPES.map(t => {
                                  const group = groupedLoanAccounts[t];
                                  if (!group || group.length === 0) return null;
                                  return (
                                    <optgroup key={t} label={t}>
                                      {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </optgroup>
                                  );
                                })}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                            </div>
                          </div>
                          <div>
                            <label className={labelStyle}>Owned Equity</label>
                            <input type="number" step="0.01" value={principalOwned} onChange={e => setPrincipalOwned(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} disabled={isLoanForPropertyLinked} />
                          </div>
                        </div>
                      </div>

                      {/* Property Cashflow & Recurring Obligations */}
                      <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                          <div className="flex items-center gap-2">
                            <Icon name="sync_alt" className="text-sm text-emerald-500" />
                            <span className="text-xs font-bold text-gray-900 dark:text-white">Recurring Expenses & Income</span>
                          </div>
                          <span className="text-2xs text-emerald-500 font-semibold uppercase">Cashflow</span>
                        </div>

                        {/* Property Tax */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelStyle}>Annual Property Tax</label>
                            <input type="number" step="0.01" value={propertyTaxAmount} onChange={e => setPropertyTaxAmount(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-rose-500`} placeholder="0.00" />
                          </div>
                          <div>
                            <label className={labelStyle}>Property Tax Due Date</label>
                            <input type="date" value={propertyTaxDate} onChange={e => setPropertyTaxDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-medium`} />
                          </div>
                        </div>

                        {/* HOA Fees */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelStyle}>HOA / Commonhold Fee</label>
                            <input type="number" step="0.01" value={hoaFeeAmount} onChange={e => setHoaFeeAmount(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-rose-500`} placeholder="0.00" />
                          </div>
                          <div>
                            <label className={labelStyle}>HOA Frequency</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select value={hoaFeeFrequency} onChange={e => setHoaFeeFrequency(e.target.value as RecurrenceFrequency)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                            </div>
                          </div>
                        </div>

                        {/* Rental Income Toggle */}
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-3">
                          <button
                            type="button"
                            onClick={() => setIsRental(!isRental)}
                            className="flex items-center justify-between w-full cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon name="real_estate_agent" className="text-base text-emerald-500" />
                              <span className="text-xs font-bold text-gray-900 dark:text-white">Rental Income Stream</span>
                            </div>
                            <div className={`w-9 h-5 rounded-full transition-colors relative ${isRental ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                              <div className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white transition-transform ${isRental ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                          </button>

                          {isRental && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5 animate-fade-in">
                              <div>
                                <label className={labelStyle}>Rent Collected</label>
                                <input type="number" step="0.01" value={rentalIncomeAmount} onChange={e => setRentalIncomeAmount(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-emerald-500`} placeholder="0.00" />
                              </div>
                              <div>
                                <label className={labelStyle}>Rent Collection Frequency</label>
                                <div className={SELECT_WRAPPER_STYLE}>
                                  <select value={rentalIncomeFrequency} onChange={e => setRentalIncomeFrequency(e.target.value as RecurrenceFrequency)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                  </select>
                                  <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LOAN / LENDING */}
                  {(type === 'Loan' || type === 'Lending') && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="request_quote" className="text-sm text-rose-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Financial Obligation Calculation</span>
                        </div>
                        <span className="text-2xs text-rose-500 font-semibold uppercase">Auto-Reconciled</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className={labelStyle}>Total Principal + Int.</label>
                          <input type="number" step="0.01" value={totalAmount} onFocus={() => setLastEditedLoanField('total')} onChange={e => { setTotalAmount(e.target.value); setLastEditedLoanField('total'); }} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-black tabular-nums`} />
                        </div>
                        <div>
                          <label className={labelStyle}>Net Capital (Principal)</label>
                          <input type="number" step="0.01" value={principalAmount} onFocus={() => setLastEditedLoanField('principal')} onChange={e => { setPrincipalAmount(e.target.value); setLastEditedLoanField('principal'); }} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-black tabular-nums`} />
                        </div>
                        <div>
                          <label className={labelStyle}>Accumulated Interest</label>
                          <input type="number" step="0.01" value={interestAmount} onFocus={() => setLastEditedLoanField('interest')} onChange={e => { setInterestAmount(e.target.value); setLastEditedLoanField('interest'); }} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-black tabular-nums`} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                        <div>
                          <label className={labelStyle}>Annual Interest Rate (APR %)</label>
                          <div className="relative">
                            <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-primary-500 pr-8`} placeholder="0.00" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 font-bold text-xs">%</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelStyle}>Term Horizon (Months)</label>
                          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="e.g. 48" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Loan Start Date</label>
                          <input type="date" value={loanStartDate} onChange={e => setLoanStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-medium`} />
                        </div>
                        {type === 'Loan' && (
                          <div>
                            <label className={labelStyle}>Down Payment (Initial Equity)</label>
                            <input type="number" step="0.01" value={downPayment} onChange={e => setDownPayment(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                        <div>
                          <label className={labelStyle}>Monthly Installment</label>
                          <input type="number" step="0.01" value={monthlyPayment} onChange={e => setMonthlyPayment(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold tabular-nums`} placeholder="Calculated if null" />
                        </div>
                        <div>
                          <label className={labelStyle}>Payment Due Day of Month</label>
                          <input type="number" min="1" max="31" value={paymentDayOfMonth} onChange={e => setPaymentDayOfMonth(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="1-31" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                        <div>
                          <label className={labelStyle}>Settlement Account</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select value={linkedAccountId} onChange={e => setLinkedAccountId(e.target.value)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                              <option value="">No Link</option>
                              {ALL_ACCOUNT_TYPES.map(t => {
                                const group = groupedDebitAccounts[t];
                                if (!group || group.length === 0) return null;
                                return (
                                  <optgroup key={t} label={t}>
                                    {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                  </optgroup>
                                );
                              })}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>

                        {type === 'Loan' && (
                          <div>
                            <label className={labelStyle}>Collateral Asset Association</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select value={linkedAssetId} onChange={e => setLinkedAssetId(e.target.value)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                                <option value="">Unsecured</option>
                                {assetAccounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                ))}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CREDIT CARD TYPE */}
                  {type === 'Credit Card' && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="credit_card" className="text-sm text-rose-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Credit Card Logistics</span>
                        </div>
                        <span className="text-2xs text-rose-500 font-semibold uppercase">Billing Architecture</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Statement Cycle Start Day</label>
                          <input type="number" min="1" max="31" value={statementStartDate} onChange={e => setStatementStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-center`} placeholder="1-31" />
                        </div>
                        <div>
                          <label className={labelStyle}>Payment Due Day</label>
                          <input type="number" min="1" max="31" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-center`} placeholder="1-31" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                        <div>
                          <label className={labelStyle}>Settlement Disbursement Ledger</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select value={settlementAccountId} onChange={e => setSettlementAccountId(e.target.value)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                              <option value="">Detached</option>
                              {ALL_ACCOUNT_TYPES.map(t => {
                                const group = groupedDebitAccounts[t];
                                if (!group || group.length === 0) return null;
                                return (
                                  <optgroup key={t} label={t}>
                                    {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                  </optgroup>
                                );
                              })}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>
                        <div>
                          <label className={labelStyle}>Credit Limit</label>
                          <input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-black text-rose-500 tabular-nums`} placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OTHER ASSETS / OTHER LIABILITIES */}
                  {type === 'Other Assets' && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="category" className="text-sm text-lime-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Other Asset Specifications</span>
                        </div>
                        <span className="text-2xs text-lime-500 font-semibold uppercase">Custom Asset</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Sub-Type</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select value={otherAssetSubType} onChange={e => setOtherAssetSubType(e.target.value as OtherAssetSubType)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                              {OTHER_ASSET_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>
                        <div>
                          <label className={labelStyle}>Associated Entity</label>
                          <input type="text" value={counterparty} onChange={e => setCounterparty(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="Owner / Issuer" />
                        </div>
                        <div>
                          <label className={labelStyle}>Storage / Location</label>
                          <input type="text" value={location} onChange={e => setLocation(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="e.g. Vault, Storage" />
                        </div>
                        <div>
                          <label className={labelStyle}>Condition</label>
                          <input type="text" value={assetCondition} onChange={e => setAssetCondition(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="Mint, Good, etc." />
                        </div>
                      </div>
                    </div>
                  )}

                  {type === 'Other Liabilities' && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="receipt" className="text-sm text-pink-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Liability Metrics</span>
                        </div>
                        <span className="text-2xs text-pink-500 font-semibold uppercase">Custom Debt</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Sub-Type</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select value={otherLiabilitySubType} onChange={e => setOtherLiabilitySubType(e.target.value as OtherLiabilitySubType)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                              {OTHER_LIABILITY_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>
                        <div>
                          <label className={labelStyle}>Owed Entity / Creditor</label>
                          <input type="text" value={counterparty} onChange={e => setCounterparty(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold`} placeholder="Creditor Name" />
                        </div>
                        <div>
                          <label className={labelStyle}>Interest Rate (%)</label>
                          <div className="relative">
                            <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-bold text-rose-500 pr-8`} placeholder="0.00" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 font-bold text-xs">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Standard Checking/Savings Quick Info if not already captured */}
                  {['Checking', 'Savings'].includes(type) && (
                    <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                      <Icon name="info" className="text-blue-500 text-base shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1 text-gray-900 dark:text-white">
                        <p className="font-bold">Standard Liquid Account</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          Checking and Savings accounts utilize the core parameters configured in the Identity tab. Card details can be linked in the Card & Extras tab.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CARD & EXTRAS */}
              {activeTab === 'extras' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Physical / Virtual Card Section */}
                  <div className={`p-4.5 rounded-3xl border transition-all duration-300 ${
                    hasCard ? 'bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] border-indigo-500/30' : 'bg-gray-50/70 dark:bg-white/[0.02] border-black/5 dark:border-white/5'
                  }`}>
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setHasCard(!hasCard)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          hasCard ? 'bg-indigo-500 text-white shadow-xs' : 'bg-black/5 dark:bg-white/10 text-gray-400'
                        }`}>
                          <Icon name="credit_card" className="text-base" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold ${hasCard ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                            Physical / Virtual Card Association
                          </h4>
                          <span className="text-2xs text-gray-400">Card details for quick recognition</span>
                        </div>
                      </div>
                      <div className={`w-9 h-5 rounded-full transition-colors relative ${hasCard ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white transition-transform ${hasCard ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </div>

                    {hasCard && (
                      <div className="mt-4 pt-4 border-t border-indigo-500/20 space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelStyle}>Payment Network Rail</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select value={cardNetwork} onChange={e => setCardNetwork(e.target.value)} className={`${SELECT_STYLE} !h-10 !text-xs font-bold`}>
                                <option value="">Select Network</option>
                                {CARD_NETWORKS.map(net => <option key={net} value={net}>{net}</option>)}
                              </select>
                              <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                            </div>
                          </div>
                          <div>
                            <label className={labelStyle}>Last 4 Digits</label>
                            <input
                              type="text"
                              maxLength={4}
                              value={last4}
                              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                              className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-mono font-bold tracking-[0.25em] text-center`}
                              placeholder="0000"
                              autoComplete="off"
                            />
                          </div>
                          <div>
                            <label className={labelStyle}>Expiration Date</label>
                            <input type="text" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-mono font-bold text-center`} placeholder="MM / YY" />
                          </div>
                          <div>
                            <label className={labelStyle}>Cardholder Name</label>
                            <input type="text" value={cardholderName} onChange={e => setCardholderName(e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 !text-xs font-medium`} placeholder="Embossed Name" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Extended Remarks & Directives */}
                  <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                    <label className={labelStyle}>Operational Directives & Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className={`${INPUT_BASE_STYLE} min-h-[96px] p-3 text-xs font-medium resize-none border-dashed bg-white dark:bg-white/[0.02] text-gray-900 dark:text-white`}
                      placeholder="Add any specific account parameters, goals, or operational guidelines..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* 3. Sticky Drawer Footer */}
          <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="h-12 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Icon name="delete" className="text-base" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={handleToggleStatus}
                className={`h-12 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border cursor-pointer ${
                  account.status === 'closed'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                <Icon name={account.status === 'closed' ? 'sync' : 'archive'} className="text-base" />
                <span>{account.status === 'closed' ? 'Reactivate' : 'Archive'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider cursor-pointer`}
              >
                Cancel
              </button>

              <button
                type="submit"
                form="edit-account-form"
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 cursor-pointer`}
              >
                <span>Save Changes</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isIconPickerOpen && (
        <IconPicker 
          onClose={() => setIconPickerOpen(false)} 
          onSelect={setIcon} 
          iconList={ACCOUNT_ICON_LIST} 
        />
      )}
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default EditAccountModal;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { Account, AccountType, Currency, InvestmentSubType, PropertyType, FuelType, VehicleOwnership, RecurrenceFrequency, OtherAssetSubType, OtherLiabilitySubType } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_STYLES, INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ACCOUNT_ICON_LIST, INVESTMENT_SUB_TYPES, PROPERTY_TYPES, INVESTMENT_SUB_TYPE_STYLES, FUEL_TYPES, VEHICLE_OWNERSHIP_TYPES, CHECKBOX_STYLE, FREQUENCIES, CARD_NETWORKS, OTHER_ASSET_SUB_TYPES, OTHER_LIABILITY_SUB_TYPES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';
import IconPicker from './IconPicker';
import { v4 as uuidv4 } from 'uuid';
import { toLocalISOString } from '../utils';

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (account: Omit<Account, 'id'>) => void;
  accounts: Account[];
}

const AddAccountModal: React.FC<AddAccountModalProps> = ({ onClose, onAdd, accounts }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Checking');
  const [balance, setBalance] = useState<string>('0');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [icon, setIcon] = useState(ACCOUNT_TYPE_STYLES['Checking'].icon);
  const [last4, setLast4] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [includeInAnalytics, setIncludeInAnalytics] = useState(true);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [financialInstitution, setFinancialInstitution] = useState('');
  
  // Banking Details
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [apy, setApy] = useState('');
  const [openingDate, setOpeningDate] = useState('');

  // Card Details
  const [hasCard, setHasCard] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [cardNetwork, setCardNetwork] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  // New detailed fields
  const [subType, setSubType] = useState<InvestmentSubType>('Stock');
  const [symbol, setSymbol] = useState('');
  const [otherAssetSubType, setOtherAssetSubType] = useState<OtherAssetSubType>('Other');
  const [otherLiabilitySubType, setOtherLiabilitySubType] = useState<OtherLiabilitySubType>('Other');
  const [expectedRetirementYear, setExpectedRetirementYear] = useState('');
  
  const [totalAmount, setTotalAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [lastEditedLoanField, setLastEditedLoanField] = useState<'total' | 'principal' | 'interest' | null>(null);

  const [duration, setDuration] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanStartDate, setLoanStartDate] = useState(toLocalISOString(new Date()));
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('Detached House');
  const [notes, setNotes] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<string>('');
  const [linkedAssetId, setLinkedAssetId] = useState<string>('');
  
  // Other Asset/Liability Specific
  const [counterparty, setCounterparty] = useState('');
  const [assetCondition, setAssetCondition] = useState('');
  const [location, setLocation] = useState('');

  // Vehicle Specific
  const [licensePlate, setLicensePlate] = useState('');
  const [registrationCountryCode, setRegistrationCountryCode] = useState('');
  const [vin, setVin] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasoline');
  const [vehicleOwnership, setVehicleOwnership] = useState<VehicleOwnership>('Owned');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [leaseProvider, setLeaseProvider] = useState('');
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [annualMileageAllowance, setAnnualMileageAllowance] = useState('');
  const [leasePaymentAmount, setLeasePaymentAmount] = useState('');
  const [leasePaymentDay, setLeasePaymentDay] = useState('');
  const [leasePaymentAccountId, setLeasePaymentAccountId] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [vehicleImage, setVehicleImage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Credit card specific fields from original modal
  const [statementStartDate, setStatementStartDate] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [settlementAccountId, setSettlementAccountId] = useState<string>('');
  const [creditLimit, setCreditLimit] = useState<string>('');
  
  // Property specific
  const [principalOwned, setPrincipalOwned] = useState('');
  const [linkedLoanId, setLinkedLoanId] = useState<string>('');
  const [propertySize, setPropertySize] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [floors, setFloors] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [hasBasement, setHasBasement] = useState(false);
  const [hasAttic, setHasAttic] = useState(false);
  const [indoorParkingSpaces, setIndoorParkingSpaces] = useState('');
  const [outdoorParkingSpaces, setOutdoorParkingSpaces] = useState('');
  const [hasGarden, setHasGarden] = useState(false);
  const [gardenSize, setGardenSize] = useState('');
  const [hasTerrace, setHasTerrace] = useState(false);
  const [terraceSize, setTerraceSize] = useState('');

  // Property Recurring Expenses & Income
  const [propertyTaxAmount, setPropertyTaxAmount] = useState('');
  const [propertyTaxDate, setPropertyTaxDate] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceAmount, setInsuranceAmount] = useState('');
  const [insuranceFrequency, setInsuranceFrequency] = useState<RecurrenceFrequency>('yearly');
  const [insurancePaymentDate, setInsurancePaymentDate] = useState('');
  const [hoaFeeAmount, setHoaFeeAmount] = useState('');
  const [hoaFeeFrequency, setHoaFeeFrequency] = useState<RecurrenceFrequency>('monthly');
  const [isRental, setIsRental] = useState(false);
  const [rentalIncomeAmount, setRentalIncomeAmount] = useState('');
  const [rentalIncomeFrequency, setRentalIncomeFrequency] = useState<RecurrenceFrequency>('monthly');


  useEffect(() => {
    if (type === 'Investment') {
      setIcon(INVESTMENT_SUB_TYPE_STYLES[subType].icon);
    } else if (type === 'Other Assets') {
        setIcon(OTHER_ASSET_SUB_TYPE_STYLES[otherAssetSubType].icon);
    } else if (type === 'Other Liabilities') {
        setIcon(OTHER_LIABILITY_SUB_TYPE_STYLES[otherLiabilitySubType].icon);
    } else {
      setIcon(ACCOUNT_TYPE_STYLES[type].icon);
    }
  }, [type, subType, otherAssetSubType, otherLiabilitySubType]);
  
  // Auto-enable card for Credit Card type
  useEffect(() => {
    if (type === 'Credit Card') {
        setHasCard(true);
    }
  }, [type]);
  
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
    return ACCOUNT_TYPE_STYLES[type]?.color || 'text-gray-500';
  }, [type, subType, otherAssetSubType, otherLiabilitySubType]);

  const groupedDebitAccounts = useMemo(() => {
    const debitAccounts = accounts.filter(acc => acc.type === 'Checking' || acc.type === 'Savings');
    const groups: Record<string, Account[]> = {};
    debitAccounts.forEach(acc => {
        if (!groups[acc.type]) groups[acc.type] = [];
        groups[acc.type].push(acc);
    });
    return groups;
  }, [accounts]);

  const groupedLoanAccounts = useMemo(() => {
    const loanAccounts = accounts.filter(acc => acc.type === 'Loan');
    const groups: Record<string, Account[]> = {};
    loanAccounts.forEach(acc => {
        if (!groups[acc.type]) groups[acc.type] = [];
        groups[acc.type].push(acc);
    });
    return groups;
  }, [accounts]);

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
        setPurchasePrice('');
    }
  }, [linkedLoanId, type, accounts]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAccountData: Omit<Account, 'id'> = {
      name,
      type,
      balance: type === 'Loan' ? -Math.abs(principalAmount !== '' ? parseFloat(principalAmount) : 0) : (type === 'Lending' ? Math.abs(principalAmount !== '' ? parseFloat(principalAmount) : 0) : (balance !== '' ? parseFloat(balance) : 0)),
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
      // Card details
      expirationDate: hasCard && expirationDate ? expirationDate : undefined,
      cardNetwork: hasCard && cardNetwork ? cardNetwork : undefined,
      cardholderName: hasCard && cardholderName ? cardholderName : undefined,
      
      // Conditionally add new fields
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
          // Reuse paymentDate logic for due date if needed, or add new field
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
        linkedAccountId: linkedAccountId || undefined,
        linkedAssetId: linkedAssetId || undefined,
      }),
      ...(type === 'Loan' && { 
        downPayment: downPayment !== '' ? parseFloat(downPayment) : undefined,
      }),
      ...(type === 'Vehicle' && { 
        make: make || undefined,
        model: model || undefined,
        year: year !== '' ? parseInt(year, 10) : undefined,
        purchasePrice: purchasePrice !== '' ? parseFloat(purchasePrice) : undefined,
        licensePlate: licensePlate || undefined,
        registrationCountryCode: registrationCountryCode || undefined,
        vin: vin || undefined,
        fuelType: fuelType || undefined,
        ownership: vehicleOwnership,
        purchaseDate: vehicleOwnership === 'Owned' && purchaseDate ? purchaseDate : undefined,
        leaseProvider: vehicleOwnership === 'Leased' && leaseProvider ? leaseProvider : undefined,
        leaseStartDate: vehicleOwnership === 'Leased' && leaseStartDate ? leaseStartDate : undefined,
        leaseEndDate: vehicleOwnership === 'Leased' && leaseEndDate ? leaseEndDate : undefined,
        annualMileageAllowance: vehicleOwnership === 'Leased' && annualMileageAllowance ? parseInt(annualMileageAllowance, 10) : undefined,
        leasePaymentAmount: vehicleOwnership === 'Leased' && leasePaymentAmount !== '' ? parseFloat(leasePaymentAmount) : undefined,
        leasePaymentDay: vehicleOwnership === 'Leased' && leasePaymentDay !== '' ? parseInt(leasePaymentDay, 10) : undefined,
        leasePaymentAccountId: vehicleOwnership === 'Leased' && leasePaymentAccountId ? leasePaymentAccountId : undefined,
        imageUrl: vehicleImage || undefined,
        mileageLogs: currentMileage ? [{ id: `log-${uuidv4()}`, date: toLocalISOString(new Date()), reading: parseInt(currentMileage, 10) }] : []
      }),
      ...(type === 'Property' && {
        address: address || undefined,
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
      }),
      ...((type === 'Other Assets' || type === 'Other Liabilities') && { notes: notes || undefined }),
      ...(type === 'Credit Card' && {
        statementStartDate: statementStartDate !== '' ? parseInt(statementStartDate, 10) : undefined,
        paymentDate: paymentDate !== '' ? parseInt(paymentDate, 10) : undefined,
        settlementAccountId: settlementAccountId || undefined,
        creditLimit: creditLimit !== '' ? parseFloat(creditLimit) : undefined,
      })
    };
    onAdd(newAccountData);
  };
  
  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
  
  const showBankingDetails = ['Checking', 'Savings', 'Investment', 'Credit Card', 'Lending'].includes(type);

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={ACCOUNT_ICON_LIST} />}
      <Modal onClose={onClose} title="Establish New Account" size="3xl">
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-primary-500/10 blur-[100px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full" />
        </div>

        <form onSubmit={handleSubmit} className="relative z-10 space-y-8 pb-4">
          {/* Identity Section */}
          <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              className="relative group transition-all"
            >
              <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full group-hover:bg-primary-500/30 transition-all opacity-0 group-hover:opacity-100" />
              <div className={`relative flex items-center justify-center w-24 h-24 bg-white dark:bg-dark-card rounded-full shadow-2xl border border-black/5 dark:border-white/5 transition-transform group-hover:scale-105 active:scale-95 z-10`}>
                <span className={`material-symbols-outlined ${iconColorClass} transition-transform group-hover:scale-110`} style={{ fontSize: '44px' }}>
                  {icon}
                </span>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 border-4 border-white dark:border-dark-card rounded-full flex items-center justify-center shadow-lg">
                   <span className="material-symbols-outlined text-white text-xs">edit</span>
                </div>
              </div>
            </button>
            
            <div className="flex-grow w-full space-y-4">
              <div>
                <label htmlFor="account-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-2 block">Ledger Identifier</label>
                <input
                    id="account-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border-none text-4xl sm:text-5xl font-black text-light-text dark:text-dark-text placeholder-black/5 dark:placeholder-white/5 focus:ring-0 p-0 tracking-tight"
                    placeholder="Account Name"
                    required
                    autoFocus
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5">
            <div>
              <label htmlFor="account-type" className={labelStyle}>Categorical Type</label>
              <div className={SELECT_WRAPPER_STYLE}>
                 <select
                    id="account-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className={`${SELECT_STYLE} h-14 font-black`}
                  >
                    {ALL_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
            </div>
            {type !== 'Loan' && type !== 'Lending' && (
                <div>
                  <label htmlFor="account-balance" className={labelStyle}>{ (type === 'Vehicle' || type === 'Property') ? 'Appraisal Value' : 'Current Liquidity'}</label>
                  <div className="relative flex">
                    <input
                      id="account-balance"
                      type="number"
                      step="0.01"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className={`${INPUT_BASE_STYLE} rounded-r-none border-r-0 h-14 font-black !text-lg tabular-nums`}
                      required
                    />
                    <div className={`${SELECT_WRAPPER_STYLE} w-32`}>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as Currency)}
                          className={`${SELECT_STYLE} rounded-l-none bg-gray-50/50 dark:bg-white/5 border-l border-black/10 dark:border-white/10 h-14 font-black`}
                        >
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                  </div>
                </div>
            )}
          </div>
          
           {/* Dynamic fields based on type */}
          <div className="space-y-6">
            
            {/* General Banking Details Group */}
            {(showBankingDetails || ['Checking', 'Savings', 'Credit Card'].includes(type)) && (
                <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">account_balance</span>
                            Banking Core
                        </h4>
                    </div>
                    <div className="space-y-6">
                        {['Checking', 'Savings', 'Credit Card'].includes(type) && (
                            <div>
                                <label htmlFor="financial-institution" className={labelStyle}>Primary Institution</label>
                                <div className="relative group">
                                     <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">assured_workload</span>
                                     <input
                                         id="financial-institution"
                                         type="text"
                                         value={financialInstitution}
                                         onChange={(e) => setFinancialInstitution(e.target.value)}
                                         className={`${INPUT_BASE_STYLE} pl-10 h-14 font-black`}
                                         placeholder="e.g., Chase, Goldman Sachs"
                                     />
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="accountNumber" className={labelStyle}>Account / IBAN</label>
                                <input id="accountNumber" type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} placeholder="**** ****" />
                            </div>
                            <div>
                                <label htmlFor="routingNumber" className={labelStyle}>Routing / BIC</label>
                                <input id="routingNumber" type="text" value={routingNumber} onChange={e => setRoutingNumber(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black tracking-widest`} placeholder="CODE" />
                            </div>
                            {['Checking', 'Savings', 'Investment'].includes(type) && (
                                <div>
                                    <label htmlFor="apy" className={labelStyle}>APY Yield (%)</label>
                                    <div className="relative">
                                         <input id="apy" type="number" step="0.01" value={apy} onChange={e => setApy(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-emerald-500`} placeholder="0.00" />
                                         <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black">%</span>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label htmlFor="openingDate" className={labelStyle}>Onboarding Date</label>
                                <input id="openingDate" type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Card Details Group */}
            {type !== 'Loan' && type !== 'Lending' && type !== 'Vehicle' && type !== 'Property' && (
                <div className={`p-6 rounded-3xl border transition-all duration-300 ${hasCard ? 'bg-white dark:bg-black/20 border-black/5 dark:border-white/5' : 'bg-black/5 dark:bg-white/5 border-transparent opacity-60'}`}>
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setHasCard(!hasCard)}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${hasCard ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                                <span className="material-symbols-outlined">credit_card</span>
                            </div>
                            <div className="flex flex-col">
                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${hasCard ? 'text-indigo-600' : 'text-gray-500'}`}>Physical/Virtual Card</h4>
                                <span className="text-[10px] font-bold text-gray-400">Toggle card logistics</span>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={hasCard} onChange={e => setHasCard(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {hasCard && (
                        <div className="mt-8 space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="cardNetwork" className={labelStyle}>Payment Rail</label>
                                    <div className={SELECT_WRAPPER_STYLE}>
                                        <select id="cardNetwork" value={cardNetwork} onChange={e => setCardNetwork(e.target.value)} className={`${SELECT_STYLE} h-14 font-black`}>
                                            <option value="">Select Network</option>
                                            {CARD_NETWORKS.map(net => <option key={net} value={net}>{net}</option>)}
                                        </select>
                                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="last-4" className={labelStyle}>Last 4 Digits</label>
                                    <input
                                        id="last-4"
                                        type="text"
                                        maxLength={4}
                                        value={last4}
                                        onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                                        className={`${INPUT_BASE_STYLE} h-14 font-black tracking-[0.3em]`}
                                        placeholder="0000"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="expirationDate" className={labelStyle}>Expirations</label>
                                    <input id="expirationDate" type="text" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} placeholder="MM / YY" />
                                </div>
                                <div>
                                    <label htmlFor="cardholderName" className={labelStyle}>Embossed Name</label>
                                    <input id="cardholderName" type="text" value={cardholderName} onChange={e => setCardholderName(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase`} placeholder="Cardholder" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Investment Specific */}
            {type === 'Investment' && (
              <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">trending_up</span>
                        Market Logistics
                    </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="subType" className={labelStyle}>Vehicle Class</label>
                      <div className={SELECT_WRAPPER_STYLE}>
                        <select id="subType" value={subType} onChange={e => setSubType(e.target.value as InvestmentSubType)} className={`${SELECT_STYLE} h-14 font-black`}>
                          {INVESTMENT_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                      </div>
                    </div>
                    {/* Show Symbol input for standard investment types */}
                    {['Stock', 'ETF', 'Crypto'].includes(subType) && (
                        <div>
                             <label htmlFor="symbol" className={labelStyle}>Ticker Symbol</label>
                             <input id="symbol" type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black uppercase tracking-widest`} placeholder="AAPL" />
                        </div>
                    )}
                    {subType === 'Pension Fund' && (
                         <div>
                            <label htmlFor="retirementYear" className={labelStyle}>Retirement Target</label>
                            <input id="retirementYear" type="number" value={expectedRetirementYear} onChange={e => setExpectedRetirementYear(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black`} placeholder="2050" />
                        </div>
                    )}
                     {subType === 'Spare Change' && (
                        <div className="col-span-1 md:col-span-2">
                          <label htmlFor="linkedAccountId" className={labelStyle}>Source Ledger (Round-ups)</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                              <select id="linkedAccountId" value={linkedAccountId} onChange={e => setLinkedAccountId(e.target.value)} className={`${SELECT_STYLE} h-14 font-black`}>
                                  <option value="">Detached</option>
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
                    )}
                </div>
              </div>
            )}

            {/* Other Assets */}
            {type === 'Other Assets' && (
                <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
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
                 <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
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
                <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
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
                <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8">
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

            {(type === 'Other Assets' || type === 'Other Liabilities') && (
              <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5">
                <label htmlFor="notes" className={labelStyle}>Descriptive Annotations</label>
                <textarea id="notes" value={notes} onChange={e=>setNotes(e.target.value)} className={`${INPUT_BASE_STYLE} !h-auto !py-4 font-black text-xs leading-relaxed`} rows={3} placeholder="Supplementary asset/liability intelligence..."></textarea>
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
                      <div><label htmlFor="credit-limit" className={labelStyle}>Authorized Credit Threshold</label><input id="credit-limit" type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className={`${INPUT_BASE_STYLE} h-14 font-black text-rose-500 tabular-nums`} /></div>
                  </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
              <button
                type="button"
                onClick={() => setIsPrimary(!isPrimary)}
                className="flex justify-between items-center w-full group focus:outline-none p-4 rounded-2xl hover:bg-white dark:hover:bg-dark-card transition-all duration-300 shadow-sm border border-transparent hover:border-black/5 dark:hover:border-white/5"
              >
                  <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-light-text dark:text-dark-text group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Primary Designation</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1">Set as the apex default for this category</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <div className={`w-11 h-6 rounded-full transition-colors ${isPrimary ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white transition-transform ${isPrimary ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
              </button>

              <button
                type="button"
                onClick={() => setIncludeInAnalytics(!includeInAnalytics)}
                className="flex justify-between items-center w-full group focus:outline-none p-4 rounded-2xl hover:bg-white dark:hover:bg-dark-card transition-all duration-300 shadow-sm border border-transparent hover:border-black/5 dark:hover:border-white/5"
              >
                  <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-light-text dark:text-dark-text group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Analytical Integration</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1">Include in systemic net-worth & fiscal reporting</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <div className={`w-11 h-6 rounded-full transition-colors ${includeInAnalytics ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white transition-transform ${includeInAnalytics ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
              </button>
          </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Retract</button>
                <button type="submit" className={`${BTN_PRIMARY_STYLE} px-10 gap-2 group animate-glow`}>
                    Initialize Account
                    <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>
            </div>
        </form>
      </Modal>
    </>
  );
};

export default AddAccountModal;

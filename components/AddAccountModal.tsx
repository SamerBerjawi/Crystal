

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { Account, AccountType, Currency, InvestmentSubType, PropertyType, FuelType, VehicleOwnership } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_STYLES, INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ACCOUNT_ICON_LIST, INVESTMENT_SUB_TYPES, PROPERTY_TYPES, INVESTMENT_SUB_TYPE_STYLES, FUEL_TYPES, VEHICLE_OWNERSHIP_TYPES } from '../constants';
import IconPicker from './IconPicker';
import { v4 as uuidv4 } from 'uuid';

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
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  
  // New detailed fields
  const [subType, setSubType] = useState<InvestmentSubType>('Stock');
  const [totalAmount, setTotalAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [lastEditedLoanField, setLastEditedLoanField] = useState<'total' | 'principal' | 'interest' | null>(null);

  const [duration, setDuration] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanStartDate, setLoanStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('House');
  const [notes, setNotes] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<string>('');
  
  // Vehicle Specific
  const [licensePlate, setLicensePlate] = useState('');
  const [vin, setVin] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasoline');
  const [vehicleOwnership, setVehicleOwnership] = useState<VehicleOwnership>('Owned');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [annualMileageAllowance, setAnnualMileageAllowance] = useState('');
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


  useEffect(() => {
    if (type === 'Investment') {
      setIcon(INVESTMENT_SUB_TYPE_STYLES[subType].icon);
    } else {
      setIcon(ACCOUNT_TYPE_STYLES[type].icon);
    }
  }, [type, subType]);
  
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
    return ACCOUNT_TYPE_STYLES[type]?.color || 'text-gray-500';
  }, [type, subType]);

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
      last4: last4 || undefined,
      isPrimary,
      // Conditionally add new fields
      ...(type === 'Investment' && { subType }),
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
        vin: vin || undefined,
        fuelType: fuelType || undefined,
        ownership: vehicleOwnership,
        purchaseDate: vehicleOwnership === 'Owned' && purchaseDate ? purchaseDate : undefined,
        leaseStartDate: vehicleOwnership === 'Leased' && leaseStartDate ? leaseStartDate : undefined,
        leaseEndDate: vehicleOwnership === 'Leased' && leaseEndDate ? leaseEndDate : undefined,
        annualMileageAllowance: vehicleOwnership === 'Leased' && annualMileageAllowance ? parseInt(annualMileageAllowance, 10) : undefined,
        imageUrl: vehicleImage || undefined,
        mileageLogs: currentMileage ? [{ id: `log-${uuidv4()}`, date: new Date().toISOString().split('T')[0], reading: parseInt(currentMileage, 10) }] : []
      }),
      ...(type === 'Property' && {
        address: address || undefined,
        propertyType,
        purchasePrice: !isLoanForPropertyLinked && purchasePrice !== '' ? parseFloat(purchasePrice) : undefined,
        principalOwned: !isLoanForPropertyLinked && principalOwned !== '' ? parseFloat(principalOwned) : undefined,
        linkedLoanId: linkedLoanId || undefined,
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
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  
  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={ACCOUNT_ICON_LIST} />}
      <Modal onClose={onClose} title="Add New Account" size="3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              className={`flex items-center justify-center w-16 h-16 bg-light-bg dark:bg-dark-bg rounded-full shadow-neu-raised-light dark:shadow-neu-raised-dark hover:shadow-neu-inset-light dark:hover:shadow-neu-inset-dark transition-shadow`}
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
                    />
                    <div className={`${SELECT_WRAPPER_STYLE} w-24`}>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as Currency)}
                          className={`${INPUT_BASE_STYLE} rounded-l-none border-l-2 border-transparent`}
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
          <div className="space-y-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
            {type === 'Investment' && (
              <div>
                <label htmlFor="subType" className={labelStyle}>Investment Type</label>
                <div className={SELECT_WRAPPER_STYLE}>
                  <select id="subType" value={subType} onChange={e => setSubType(e.target.value as InvestmentSubType)} className={INPUT_BASE_STYLE}>
                    {INVESTMENT_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div><label htmlFor="plate" className={labelStyle}>License Plate</label><input id="plate" type="text" value={licensePlate} onChange={e=>setLicensePlate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                    <div><label htmlFor="vin" className={labelStyle}>VIN</label><input id="vin" type="text" value={vin} onChange={e=>setVin(e.target.value)} className={INPUT_BASE_STYLE} /></div>
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
                     <div><label htmlFor="mileage" className={labelStyle}>Current Mileage (km)</label><input id="mileage" type="number" value={currentMileage} onChange={e=>setCurrentMileage(e.target.value)} className={INPUT_BASE_STYLE} /></div>
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
                       <div className="grid grid-cols-2 gap-4">
                           <div><label htmlFor="leaseStart" className={labelStyle}>Lease Start</label><input id="leaseStart" type="date" value={leaseStartDate} onChange={e=>setLeaseStartDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                           <div><label htmlFor="leaseEnd" className={labelStyle}>Lease End</label><input id="leaseEnd" type="date" value={leaseEndDate} onChange={e=>setLeaseEndDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                           <div className="col-span-2"><label htmlFor="annualMileageAllowance" className={labelStyle}>Annual Mileage Allowance (km)</label><input id="annualMileageAllowance" type="number" value={annualMileageAllowance} onChange={e=>setAnnualMileageAllowance(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., 15000" /></div>
                       </div>
                   )}
                </div>
            )}
            {type === 'Property' && (
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
                  <div className="grid grid-cols-2 gap-4">
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

          <div>
              <label htmlFor="last-4" className={labelStyle}>Last 4 Digits (Optional)</label>
              <input
                id="last-4"
                type="text"
                maxLength={4}
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                className={INPUT_BASE_STYLE}
              />
          </div>

          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg">
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-medium text-light-text dark:text-dark-text">Primary Account</p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Set as the default account for dashboard filters.</p>
                </div>
                <div 
                  onClick={() => setIsPrimary(!isPrimary)}
                  className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors ${isPrimary ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${isPrimary ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
            <button type="submit" className={BTN_PRIMARY_STYLE}>Add Account</button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AddAccountModal;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { Account, AccountType, Currency, InvestmentSubType, PropertyType, FuelType, VehicleOwnership, RecurrenceFrequency } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_STYLES, INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ACCOUNT_ICON_LIST, INVESTMENT_SUB_TYPES, PROPERTY_TYPES, INVESTMENT_SUB_TYPE_STYLES, FUEL_TYPES, VEHICLE_OWNERSHIP_TYPES, CHECKBOX_STYLE, FREQUENCIES, CARD_NETWORKS } from '../constants';
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
  const [propertyType, setPropertyType] = useState<PropertyType>('Detached House');
  const [notes, setNotes] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<string>('');
  
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
  const
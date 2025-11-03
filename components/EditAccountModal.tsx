import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Account, AccountType, Currency } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES, ACCOUNT_TYPE_STYLES, INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, ACCOUNT_ICON_LIST } from '../constants';
import IconPicker from './IconPicker';

interface EditAccountModalProps {
  onClose: () => void;
  onSave: (account: Account) => void;
  onDelete: (accountId: string) => void;
  account: Account;
  accounts: Account[];
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({ onClose, onSave, onDelete, account, accounts }) => {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [balance, setBalance] = useState<string>(String(account.balance));
  const [currency, setCurrency] = useState<Currency>(account.currency);
  const [icon, setIcon] = useState(account.icon || ACCOUNT_TYPE_STYLES[account.type].icon);
  const [last4, setLast4] = useState(account.last4 || '');
  const [statementStartDate, setStatementStartDate] = useState<string>(String(account.statementStartDate || ''));
  const [paymentDate, setPaymentDate] = useState<string>(String(account.paymentDate || ''));
  const [settlementAccountId, setSettlementAccountId] = useState<string>(account.settlementAccountId || '');
  const [isPrimary, setIsPrimary] = useState(account.isPrimary || false);
  
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);

  const isComputedAccount = type === 'Investment' || type === 'Crypto';

  useEffect(() => {
    // only change icon if it's the default one for the previous type
    if (icon === ACCOUNT_TYPE_STYLES[account.type].icon) {
      setIcon(ACCOUNT_TYPE_STYLES[type].icon);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const checkingAccounts = accounts.filter(acc => acc.type === 'Checking' && acc.id !== account.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAccount: Account = {
      ...account,
      name,
      type,
      // Only update balance if it's not a computed account
      balance: isComputedAccount ? account.balance : parseFloat(balance),
      currency,
      icon,
      last4: last4 || undefined,
      statementStartDate: type === 'Credit Card' && statementStartDate ? parseInt(statementStartDate) : undefined,
      paymentDate: type === 'Credit Card' && paymentDate ? parseInt(paymentDate) : undefined,
      settlementAccountId: type === 'Credit Card' && settlementAccountId ? settlementAccountId : undefined,
      isPrimary,
    };
    onSave(updatedAccount);
  };
  
  const handleDelete = () => {
    if(window.confirm(`Are you sure you want to delete the account "${account.name}"? This action cannot be undone.`)) {
        onDelete(account.id);
    }
  }
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={ACCOUNT_ICON_LIST} />}
      <Modal onClose={onClose} title={`Edit ${account.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              className="flex items-center justify-center w-16 h-16 bg-light-bg dark:bg-dark-bg rounded-full shadow-neu-raised-light dark:shadow-neu-raised-dark hover:shadow-neu-inset-light dark:hover:shadow-neu-inset-dark transition-shadow"
            >
              <span className={`material-symbols-outlined ${ACCOUNT_TYPE_STYLES[type].color}`} style={{ fontSize: '40px' }}>
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
            <div>
              <label htmlFor="account-balance" className={labelStyle}>Current Balance</label>
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

          {type === 'Credit Card' && (
            <div className="space-y-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
                <h4 className="font-semibold text-light-text dark:text-dark-text">Credit Card Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="statement-start" className={labelStyle}>Statement Day</label>
                        <input id="statement-start" type="number" min="1" max="31" value={statementStartDate} onChange={(e) => setStatementStartDate(e.target.value)} className={INPUT_BASE_STYLE} />
                    </div>
                     <div>
                        <label htmlFor="payment-date" className={labelStyle}>Payment Day</label>
                        <input id="payment-date" type="number" min="1" max="31" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={INPUT_BASE_STYLE} />
                    </div>
                </div>
                <div>
                    <label htmlFor="settlement-account" className={labelStyle}>Settlement Account</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                         <select id="settlement-account" value={settlementAccountId} onChange={(e) => setSettlementAccountId(e.target.value)} className={INPUT_BASE_STYLE}>
                            <option value="">Select an account</option>
                            {checkingAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                </div>
            </div>
          )}

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


          <div className="flex justify-between items-center pt-4">
            <button type="button" onClick={handleDelete} className={BTN_DANGER_STYLE}>Delete Account</button>
            <div className="flex gap-4">
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
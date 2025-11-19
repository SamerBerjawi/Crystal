
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Account, RemoteAccount } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, ALL_ACCOUNT_TYPES } from '../constants';
import { formatCurrency } from '../utils';

interface EnableBankingLinkAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  remoteAccounts: RemoteAccount[];
  existingAccounts: Account[];
  onLinkAndSync: (links: Record<string, string>) => void;
}

const EnableBankingLinkAccountsModal: React.FC<EnableBankingLinkAccountsModalProps> = ({ isOpen, onClose, remoteAccounts, existingAccounts, onLinkAndSync }) => {
  const [links, setLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setLinks(
        remoteAccounts.reduce((acc, ra) => {
          acc[ra.id] = 'CREATE_NEW';
          return acc;
        }, {} as Record<string, string>)
      );
    }
  }, [isOpen, remoteAccounts]);

  const groupedExistingAccounts = useMemo(() => {
    const unlinked = existingAccounts.filter(acc => !acc.enableBankingId);
    const groups: Record<string, Account[]> = {};
    unlinked.forEach(acc => {
        if (!groups[acc.type]) groups[acc.type] = [];
        groups[acc.type].push(acc);
    });
    return groups;
  }, [existingAccounts]);

  if (!isOpen) {
    return null;
  }

  const handleLinkChange = (remoteAccountId: string, delphiAccountId: string) => {
    setLinks(prev => ({ ...prev, [remoteAccountId]: delphiAccountId }));
  };

  const handleSubmit = () => {
    onLinkAndSync(links);
  };

  return (
    <Modal onClose={onClose} title="Link Found Accounts">
      <div className="space-y-4">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          We found {remoteAccounts.length} account(s) at the selected institution. Please link them to your Delphi accounts or create new ones.
        </p>
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
          {remoteAccounts.map(remoteAcc => (
            <div key={remoteAcc.id} className="p-4 rounded-lg bg-light-bg dark:bg-dark-bg">
              <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-light-text dark:text-dark-text">{remoteAcc.name} ({remoteAcc.institution})</p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">•••• {remoteAcc.last4} &bull; {remoteAcc.type}</p>
                  </div>
                  <p className="font-semibold text-light-text dark:text-dark-text">{formatCurrency(remoteAcc.balance, remoteAcc.currency)}</p>
              </div>
              <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2">
                 <span className="material-symbols-outlined text-xl text-primary-500">link</span>
                 <div className={SELECT_WRAPPER_STYLE}>
                    <select
                        value={links[remoteAcc.id] || 'CREATE_NEW'}
                        onChange={(e) => handleLinkChange(remoteAcc.id, e.target.value)}
                        className={INPUT_BASE_STYLE}
                    >
                        <option value="CREATE_NEW">Create New Account in Delphi</option>
                        {ALL_ACCOUNT_TYPES.map(type => {
                            const group = groupedExistingAccounts[type];
                            if (!group || group.length === 0) return null;
                            return (
                                <optgroup key={type} label={`Link to Existing ${type}`}>
                                    {group.map(existingAcc => (
                                        <option key={existingAcc.id} value={existingAcc.id}>
                                            {existingAcc.name} ({formatCurrency(existingAcc.balance, existingAcc.currency)})
                                        </option>
                                    ))}
                                </optgroup>
                            );
                        })}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-black/10 dark:border-white/10">
        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} className={BTN_PRIMARY_STYLE}>
          Link & Sync Accounts
        </button>
      </div>
    </Modal>
  );
};

export default EnableBankingLinkAccountsModal;

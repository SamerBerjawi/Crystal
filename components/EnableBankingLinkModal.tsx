import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import { Account, EnableBankingConnection } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE } from '../constants';

interface EnableBankingLinkModalProps {
  accounts: Account[];
  targetAccount?: Account | null;
  onClose: () => void;
  onSave: (account: Account, connection: EnableBankingConnection) => void;
  defaultCountry?: string;
  configurationReady: boolean;
}

const EnableBankingLinkModal: React.FC<EnableBankingLinkModalProps> = ({
  accounts,
  targetAccount,
  onClose,
  onSave,
  defaultCountry,
  configurationReady,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(targetAccount?.id || accounts[0]?.id || '');
  const [aspspName, setAspspName] = useState(targetAccount?.financialInstitution || '');
  const [countryCode, setCountryCode] = useState(defaultCountry || '');
  const [accountUid, setAccountUid] = useState(targetAccount?.enableBanking?.accountUid || '');
  const [sessionId, setSessionId] = useState(targetAccount?.enableBanking?.sessionId || '');
  const [authorizationId, setAuthorizationId] = useState(targetAccount?.enableBanking?.authorizationId || '');
  const [status, setStatus] = useState<EnableBankingConnection['status']>(targetAccount?.enableBanking?.status || 'pending');

  const selectedAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const payload: EnableBankingConnection = {
      aspspName: aspspName || selectedAccount.financialInstitution || selectedAccount.name,
      countryCode,
      accountUid: accountUid || undefined,
      sessionId: sessionId || undefined,
      authorizationId: authorizationId || undefined,
      status: configurationReady ? status : 'pending',
      lastSyncedAt: targetAccount?.enableBanking?.lastSyncedAt,
    };

    onSave(selectedAccount, payload);
  };

  return (
    <Modal title="Link with Enable Banking" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!configurationReady && (
          <div className="p-3 rounded-lg bg-amber-100 text-amber-800 text-sm">
            Provide your Enable Banking credentials in Preferences to start real synchronisation. We'll keep the link ready so you
            can sync as soon as configuration is complete.
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Account</label>
          <div className={SELECT_WRAPPER_STYLE}>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className={INPUT_BASE_STYLE}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Bank name</label>
            <input
              value={aspspName}
              onChange={e => setAspspName(e.target.value)}
              placeholder="Nordea, Revolut, ..."
              className={INPUT_BASE_STYLE}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Country code</label>
            <input
              value={countryCode}
              onChange={e => setCountryCode(e.target.value.toUpperCase())}
              placeholder="FI"
              className={INPUT_BASE_STYLE}
              maxLength={2}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Enable Banking account UID</label>
            <input
              value={accountUid}
              onChange={e => setAccountUid(e.target.value)}
              placeholder="07cc67f4-45d6-494b-adac-..."
              className={INPUT_BASE_STYLE}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Session ID</label>
            <input
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              placeholder="Returned from /sessions"
              className={INPUT_BASE_STYLE}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Authorization ID (optional)</label>
            <input
              value={authorizationId}
              onChange={e => setAuthorizationId(e.target.value)}
              placeholder="Returned from /auth"
              className={INPUT_BASE_STYLE}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Connection status</label>
            <div className={SELECT_WRAPPER_STYLE}>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as EnableBankingConnection['status'])}
                className={INPUT_BASE_STYLE}
              >
                <option value="pending">Pending</option>
                <option value="connected">Connected</option>
                <option value="error">Error</option>
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </div>
        </div>

        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
          After initiating <code className="font-mono text-xs">POST /auth</code> with your bank choice, paste the returned authorization
          and session values here. We will mark the account as connected and enable one-click sync for balances and transactions.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} px-4`}>Cancel</button>
          <button type="submit" className={`${BTN_PRIMARY_STYLE} px-4`}>Save link</button>
        </div>
      </form>
    </Modal>
  );
};

export default EnableBankingLinkModal;

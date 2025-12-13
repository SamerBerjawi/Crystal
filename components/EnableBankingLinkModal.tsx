import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { Account, AppPreferences, EnableBankingAspsp, EnableBankingConnection, EnableBankingSessionAccount } from '../types';
import {
  BTN_PRIMARY_STYLE,
  BTN_SECONDARY_STYLE,
  INPUT_BASE_STYLE,
  SELECT_ARROW_STYLE,
  SELECT_WRAPPER_STYLE,
} from '../constants';
import {
  deriveSyncFromDate,
  ENABLE_BANKING_REDIRECT_PATH,
  exchangeEnableBankingCode,
  fetchEnableBankingAspsps,
  startEnableBankingAuthorization,
} from '../utils/enableBanking';

interface EnableBankingLinkModalProps {
  accounts: Account[];
  targetAccount?: Account | null;
  onClose: () => void;
  onSave: (account: Account, connection: EnableBankingConnection) => void;
  defaultCountry?: string;
  configurationReady: boolean;
  preferences?: AppPreferences;
  initialAuthorizationCode?: string;
  expectedAuthState?: string | null;
  returnedAuthState?: string | null;
  onAuthorizationStarted?: (state: string, accountId: string) => void;
  onRedirectHandled?: () => void;
}

const EnableBankingLinkModal: React.FC<EnableBankingLinkModalProps> = ({
  accounts,
  targetAccount,
  onClose,
  onSave,
  defaultCountry,
  configurationReady,
  preferences,
  initialAuthorizationCode,
  expectedAuthState,
  returnedAuthState,
  onAuthorizationStarted,
  onRedirectHandled,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(targetAccount?.id || accounts[0]?.id || '');
  const [aspspName, setAspspName] = useState(targetAccount?.financialInstitution || '');
  const [countryCode, setCountryCode] = useState(defaultCountry || '');
  const [banks, setBanks] = useState<EnableBankingAspsp[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [accountUid, setAccountUid] = useState(targetAccount?.enableBanking?.accountUid || '');
  const [sessionId, setSessionId] = useState(targetAccount?.enableBanking?.sessionId || '');
  const [authorizationId, setAuthorizationId] = useState(targetAccount?.enableBanking?.authorizationId || '');
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [authorizationState, setAuthorizationState] = useState<string | null>(null);
  const [availableRemoteAccounts, setAvailableRemoteAccounts] = useState<EnableBankingSessionAccount[]>([]);
  const [selectedRemoteAccountUid, setSelectedRemoteAccountUid] = useState('');
  const [syncWindowDays, setSyncWindowDays] = useState(90);
  const [status, setStatus] = useState<EnableBankingConnection['status']>(targetAccount?.enableBanking?.status || 'pending');
  const [autoExchanged, setAutoExchanged] = useState(false);

  const selectedAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);

  useEffect(() => {
    if (targetAccount?.id) {
      setSelectedAccountId(targetAccount.id);
    }
  }, [targetAccount]);

  useEffect(() => {
    if (expectedAuthState) {
      setAuthorizationState(expectedAuthState);
    }
  }, [expectedAuthState]);

  useEffect(() => {
    if (!configurationReady || !preferences) return;
    if (!countryCode && defaultCountry) {
      setCountryCode(defaultCountry);
    }

    const loadBanks = async () => {
      try {
        setBanksLoading(true);
        setBanksError(null);
        const aspsps = await fetchEnableBankingAspsps(preferences, countryCode || defaultCountry);
        setBanks(aspsps);
        if (aspsps.length > 0 && !aspspName) {
          setAspspName(aspsps[0].name);
        }
      } catch (err: any) {
        setBanksError(err?.message || 'Unable to load banks for your country.');
      } finally {
        setBanksLoading(false);
      }
    };

    loadBanks();
  }, [configurationReady, preferences, countryCode, defaultCountry, aspspName]);

  useEffect(() => {
    if (availableRemoteAccounts.length > 0) {
      const chosenUid = selectedRemoteAccountUid || availableRemoteAccounts[0].uid;
      setSelectedRemoteAccountUid(chosenUid);
      setAccountUid(chosenUid);
    }
  }, [availableRemoteAccounts, selectedRemoteAccountUid]);

  useEffect(() => {
    if (!configurationReady) {
      setStatus('pending');
      return;
    }
    if (sessionId) {
      setStatus('connected');
    }
  }, [configurationReady, sessionId]);

  const handleStartAuthorization = async () => {
    if (!preferences || !aspspName || !countryCode) return;

    try {
      setFlowError(null);
      setAuthorizationUrl(null);
      const defaultRedirectUrl =
        typeof window !== 'undefined' ? `${window.location.origin}${ENABLE_BANKING_REDIRECT_PATH}` : undefined;
      const authResponse = await startEnableBankingAuthorization(preferences, aspspName, countryCode, defaultRedirectUrl);
      setAuthorizationUrl(authResponse.url);
      setAuthorizationState(authResponse.state);
      if (onAuthorizationStarted) {
        onAuthorizationStarted(authResponse.state, selectedAccountId);
      }
      if (authResponse.authorizationId) {
        setAuthorizationId(authResponse.authorizationId);
      }
      setStatus('pending');
      if (typeof window !== 'undefined') {
        window.open(authResponse.url, '_blank', 'noopener');
      }
    } catch (err: any) {
      setFlowError(err?.message || 'Unable to start authorization.');
      setStatus('error');
    }
  };

  const handleExchangeCode = async (codeOverride?: string) => {
    const codeToUse = codeOverride || authorizationCode;
    if (!preferences || !codeToUse) return;
    if (expectedAuthState && returnedAuthState && expectedAuthState !== returnedAuthState) {
      setFlowError('Return state did not match the started authorization. Please try again.');
      setStatus('error');
      return;
    }
    if (expectedAuthState && authorizationState && expectedAuthState !== authorizationState) {
      setFlowError('Return state did not match the started authorization. Please try again.');
      setStatus('error');
      return;
    }
    try {
      setFlowError(null);
      const session = await exchangeEnableBankingCode(preferences, codeToUse.trim());
      setSessionId(session.sessionId);
      setAvailableRemoteAccounts(session.accounts);
      setStatus('connected');
      if (onRedirectHandled) onRedirectHandled();
    } catch (err: any) {
      setFlowError(err?.message || 'Unable to finalize session with this code.');
      setStatus('error');
    }
  };

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
      syncFromDate: deriveSyncFromDate(syncWindowDays),
    };

    onSave(selectedAccount, payload);
  };

  useEffect(() => {
    if (!initialAuthorizationCode || autoExchanged || !configurationReady || !preferences) return;
    setAuthorizationCode(initialAuthorizationCode);
    setAutoExchanged(true);
    handleExchangeCode(initialAuthorizationCode);
  }, [initialAuthorizationCode, autoExchanged, configurationReady, preferences]);

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
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Bank</label>
            {banksLoading ? (
              <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary py-2">Loading banks…</div>
            ) : banks.length > 0 ? (
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={aspspName}
                  onChange={e => setAspspName(e.target.value)}
                  className={INPUT_BASE_STYLE}
                >
                  {banks.map(bank => (
                    <option key={`${bank.country}-${bank.name}`} value={bank.name}>
                      {bank.name} ({bank.country})
                    </option>
                  ))}
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
            ) : (
              <input
                value={aspspName}
                onChange={e => setAspspName(e.target.value)}
                placeholder="Nordea, Revolut, ..."
                className={INPUT_BASE_STYLE}
                required
              />
            )}
            {banksError && <p className="text-xs text-red-600 dark:text-red-400">{banksError}</p>}
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
            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Used to pre-filter banks and authorise with Enable Banking.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
          <span className="text-xs font-semibold uppercase tracking-widest">Connection</span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold ${
              status === 'connected'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                : status === 'pending'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
            }`}
          >
            {status === 'connected' ? 'Connected' : status === 'pending' ? 'Pending auth' : 'Needs attention'}
          </span>
          {sessionId && <span className="text-xs">Session: {sessionId}</span>}
        </div>

        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 space-y-3 bg-light-card/40 dark:bg-dark-card/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-light-text dark:text-dark-text">1. Fetch authorization URL</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">We call <code className="font-mono text-xs">/auth</code> for you.</p>
            </div>
            <button
              type="button"
              onClick={handleStartAuthorization}
              className={`${BTN_SECONDARY_STYLE} px-3`}
              disabled={!configurationReady}
            >
              Get link
            </button>
          </div>
          {authorizationUrl && (
            <div className="p-3 rounded-lg bg-light-surface/60 dark:bg-white/5 text-sm">
              <p className="font-semibold text-light-text dark:text-dark-text">Redirect your user to:</p>
              <a href={authorizationUrl} className="text-primary-600 dark:text-primary-300 break-all" target="_blank" rel="noreferrer">
                {authorizationUrl}
              </a>
              {authorizationId && (
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Authorization ID: {authorizationId}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Authorization code</label>
              <input
                value={authorizationCode}
                onChange={e => setAuthorizationCode(e.target.value)}
                placeholder="Paste ?code= value after redirect"
                className={INPUT_BASE_STYLE}
                disabled={!configurationReady}
              />
              <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Paste the ?code from the redirect (we auto-fill it when you return) and we'll exchange it with <code className="font-mono text-xs">/sessions</code> to pull your accounts automatically.</p>
            </div>
            <button
              type="button"
              onClick={handleExchangeCode}
              className={`${BTN_PRIMARY_STYLE} px-4 h-11`}
              disabled={!authorizationCode || !configurationReady}
            >
              Finalize session
            </button>
          </div>
          {availableRemoteAccounts.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Select bank account to link</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={selectedRemoteAccountUid}
                  onChange={e => { setSelectedRemoteAccountUid(e.target.value); setAccountUid(e.target.value); }}
                  className={INPUT_BASE_STYLE}
                >
                  {availableRemoteAccounts.map(acc => (
                    <option key={acc.uid} value={acc.uid}>
                      {acc.name || acc.account_id?.iban || 'Account'}
                      {acc.currency ? ` • ${acc.currency}` : ''}
                    </option>
                  ))}
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
              </div>
              <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">We pre-fill UID and session ID from the API response.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Enable Banking account UID</label>
            <input
              value={accountUid}
              onChange={e => setAccountUid(e.target.value)}
              placeholder="07cc67f4-45d6-494b-adac-..."
              className={INPUT_BASE_STYLE}
              readOnly={availableRemoteAccounts.length > 0}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Session ID</label>
            <input
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              placeholder="Returned from /sessions"
              className={INPUT_BASE_STYLE}
              readOnly={availableRemoteAccounts.length > 0}
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
              readOnly={Boolean(authorizationUrl)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Sync past activity</label>
            <div className={SELECT_WRAPPER_STYLE}>
              <select
                value={syncWindowDays}
                onChange={e => setSyncWindowDays(Number(e.target.value))}
                className={INPUT_BASE_STYLE}
              >
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days (max)</option>
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">We cap imports to 3 months per your preference.</p>
          </div>
        </div>

        {flowError && (
          <div className="p-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 text-sm">{flowError}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} px-4`}>Cancel</button>
          <button type="submit" className={`${BTN_PRIMARY_STYLE} px-4`}>Save link</button>
        </div>
      </form>
    </Modal>
  );
};

export default EnableBankingLinkModal;

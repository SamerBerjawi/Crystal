import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type {
  Account,
  AppPreferences,
  Currency,
  EnableBankingAccount,
  EnableBankingConnection,
  EnableBankingLinkPayload,
  EnableBankingSyncOptions,
  FinancialData,
  Page,
  Transaction,
  User,
} from '../types';
import { toLocalDateTimeString } from '../utils';
import { parseApiError } from '../utils/apiError';
import { mapWithConcurrency } from '../utils/concurrency';
import { getConsentExpiry, describeConsentExpiry } from '../utils/consentExpiry';
import { persistPendingConnection, removePendingConnection } from '../utils/enableBankingStorage';
import {
  computeSyncDateFrom,
  extractProviderAccountIdentifiers,
  mapEnableBankingTransaction,
  getLegacyEnableBankingTransactionId,
  matchExistingProviderAccount,
  matchKnownBrand,
  resolveEnableBankingBalance,
} from '../utils/enableBankingMapper';
import { normalizeMerchantKey } from '../utils/brandfetch';
import { syncFill } from '../utils/lockedFields';
import { clearDeleted, deletedIdsByAccount } from '../utils/deletedSync';

interface UseEnableBankingSyncParams {
  isAuthenticated: boolean;
  isDataLoaded: boolean;
  isDemoMode: boolean;
  user: User | null;
  demoUser: User | null;
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  transactionsRef: React.MutableRefObject<Transaction[]>;
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  enableBankingConnections: EnableBankingConnection[];
  setEnableBankingConnections: React.Dispatch<React.SetStateAction<EnableBankingConnection[]>>;
  authorizedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  savePartialDataWithRetry: (data: Partial<FinancialData>, options?: { attempts?: number }) => Promise<boolean>;
  handleSaveAccount: (accountData: Omit<Account, 'id'> & { id?: string }) => void;
  handleSaveTransaction: (
    transactionDataArray: (Omit<Transaction, 'id'> & { id?: string })[],
    transactionIdsToDelete?: string[],
    options?: { autoSpareChange?: boolean; skipRules?: boolean; applyRules?: boolean; isNew?: boolean; fromSync?: boolean; resyncable?: boolean }
  ) => void;
  setCurrentPage: (page: Page, tab?: string | null) => void;
}

export function useEnableBankingSync({
  isAuthenticated,
  isDataLoaded,
  isDemoMode,
  user,
  demoUser,
  accounts,
  setAccounts,
  transactionsRef,
  preferences,
  setPreferences,
  enableBankingConnections,
  setEnableBankingConnections,
  authorizedFetch,
  savePartialDataWithRetry,
  handleSaveAccount,
  handleSaveTransaction,
  setCurrentPage,
}: UseEnableBankingSyncParams) {
  const [isSyncingBanks, setIsSyncingBanks] = useState(false);
  const syncingConnectionIdsRef = useRef<Set<string>>(new Set());
  /** connectionId -> epoch ms until which the bank asked us to stop (ASPSP_RATE_LIMIT_EXCEEDED); in memory only. */
  const bankRateLimitedUntilRef = useRef<Map<string, number>>(new Map());
  /** `${connectionId}:${level}` pairs already announced this session, so each warning shows once. */
  const consentWarnedRef = useRef<Set<string>>(new Set());

  // Warn once per session as each bank consent nears its end (14 days, 7 days, last day, expired).
  useEffect(() => {
    if (!isDataLoaded || isDemoMode) return;
    for (const connection of enableBankingConnections) {
      if (!connection.sessionId) continue;
      const expiry = getConsentExpiry(connection.sessionExpiresAt);
      if (!expiry) continue;
      const key = `${connection.id}:${expiry.level}`;
      if (consentWarnedRef.current.has(key)) continue;
      consentWarnedRef.current.add(key);
      const show = expiry.level === 'expired' || expiry.level === 'last-day' ? toast.error : toast.warning;
      show(describeConsentExpiry(connection.selectedBank || 'Your bank', expiry), {
        duration: 10000,
        action: { label: 'Open connections', onClick: () => setCurrentPage('Integrations') },
      });
    }
  }, [enableBankingConnections, isDataLoaded, isDemoMode, setCurrentPage]);

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await authorizedFetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!response.ok) { const text = await response.text(); throw new Error(text || response.statusText); }
    return response;
  }, [authorizedFetch]);

  const handleFetchEnableBankingBanks = useCallback(async (payload: { applicationId: string; countryCode: string; clientCertificate: string; }) => {
    if (!isAuthenticated) throw new Error('You must be signed in to load banks.');
    const response = await fetchWithAuth('/api/enable-banking/aspsps', { method: 'POST', body: JSON.stringify({ applicationId: payload.applicationId.trim(), countryCode: payload.countryCode.trim().toUpperCase(), clientCertificate: payload.clientCertificate.trim(), }), })
      .catch(error => { throw new Error(parseApiError(error, 'Unable to load banks.').message); });
    const data = await response.json();
    const items: any[] = Array.isArray(data) ? data : data?.aspsps || [];
    if (items.length === 0) throw new Error('No banks returned.');
    return items.map((item: any, index: number) => ({
      id: item.id || item.aspsp_id || item.bank_id || item.name || `aspsp-${index}`,
      name: item.name || item.full_name || item.fullName || 'Bank',
      country: item.country || payload.countryCode,
      logo: typeof item.logo === 'string' ? item.logo : undefined,
      psuTypes: Array.isArray(item.psu_types || item.psuTypes) ? (item.psu_types || item.psuTypes) : undefined,
      maximumConsentValidity: Number.isFinite(Number(item.maximum_consent_validity ?? item.maximumConsentValidity))
        ? Number(item.maximum_consent_validity ?? item.maximumConsentValidity)
        : undefined,
      beta: item.beta === true,
      requiredPsuHeaders: Array.isArray(item.required_psu_headers) ? item.required_psu_headers.filter((h: unknown): h is string => typeof h === 'string') : undefined,
      authMethods: Array.isArray(item.auth_methods)
        ? item.auth_methods
            .filter((method: any) => method && typeof method.name === 'string')
            .map((method: any) => ({
              name: method.name as string,
              title: typeof method.title === 'string' ? method.title : method.name,
              psuType: typeof method.psu_type === 'string' ? method.psu_type : undefined,
              approach: typeof method.approach === 'string' ? method.approach : undefined,
              hidden: method.hidden_method === true,
              credentials: Array.isArray(method.credentials)
                ? method.credentials
                    .filter((c: any) => c && typeof c.name === 'string')
                    .map((c: any) => ({ name: c.name as string, title: typeof c.title === 'string' ? c.title : c.name, required: c.required === true, description: typeof c.description === 'string' ? c.description : undefined }))
                : [],
            }))
        : undefined,
    }));
  }, [fetchWithAuth, isAuthenticated]);

  const handleCreateEnableBankingConnection = useCallback(async (payload: { applicationId: string; countryCode: string; clientCertificate: string; selectedBank: string; connectionId?: string; authMethod?: string; credentials?: Record<string, string>; }) => {
    if (!isAuthenticated) return;

    let selectedBankId = '';
    let selectedBankName = '';
    let bankLogoUrl: string | undefined;
    let psuType: 'personal' | 'business' | undefined;
    let maximumConsentValidity: number | undefined;
    let requiredPsuHeaders: string[] | undefined;
    try {
      const bankData = JSON.parse(payload.selectedBank);
      selectedBankId = bankData.id;
      selectedBankName = bankData.name;
      if (typeof bankData.logo === 'string') bankLogoUrl = bankData.logo;
      if (bankData.psuType === 'personal' || bankData.psuType === 'business') psuType = bankData.psuType;
      if (Number.isFinite(Number(bankData.maximumConsentValidity))) maximumConsentValidity = Number(bankData.maximumConsentValidity);
      if (Array.isArray(bankData.requiredPsuHeaders)) requiredPsuHeaders = bankData.requiredPsuHeaders.filter((h: unknown): h is string => typeof h === 'string');
    } catch {
      selectedBankName = payload.selectedBank;
    }

    const connectionId = payload.connectionId || `eb-${uuidv4()}`;
    const existingConnection = payload.connectionId ? enableBankingConnections.find(conn => conn.id === payload.connectionId) : undefined;
    const baseConnection: EnableBankingConnection = {
      ...(existingConnection && { ...existingConnection }),
      id: connectionId,
      applicationId: (payload.applicationId || '').trim(),
      countryCode: (payload.countryCode || '').trim().toUpperCase(),
      status: 'pending',
      selectedBank: selectedBankName || existingConnection?.selectedBank,
      selectedBankId: selectedBankId || existingConnection?.selectedBankId,
      bankLogoUrl: bankLogoUrl || existingConnection?.bankLogoUrl,
      psuType: psuType || existingConnection?.psuType || 'personal',
      authMethod: payload.authMethod || existingConnection?.authMethod || undefined,
      maximumConsentValidity: maximumConsentValidity ?? existingConnection?.maximumConsentValidity,
      requiredPsuHeaders: requiredPsuHeaders ?? existingConnection?.requiredPsuHeaders,
      accounts: existingConnection?.accounts || [],
    };
    let nextConnections: EnableBankingConnection[] = [];
    setEnableBankingConnections(prev => { nextConnections = existingConnection ? prev.map(conn => (conn.id === connectionId ? baseConnection : conn)) : [...prev, baseConnection]; return nextConnections; });
    persistPendingConnection(baseConnection);
    fetchWithAuth('/api/enable-banking/pending', {
      method: 'POST',
      body: JSON.stringify({ connection: baseConnection }),
    }).catch(error => {
      console.warn('Failed to persist pending Enable Banking connection to server', error);
    });
    if (!isDemoMode && isDataLoaded) { void savePartialDataWithRetry({ enableBankingConnections: nextConnections }); }
    try {
      const response = await fetchWithAuth('/api/enable-banking/authorize', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: baseConnection.applicationId,
          clientCertificate: (payload.clientCertificate || '').trim() || undefined,
          countryCode: baseConnection.countryCode,
          aspspName: baseConnection.selectedBank,
          aspspId: baseConnection.selectedBankId,
          psuType: baseConnection.psuType,
          authMethod: baseConnection.authMethod,
          credentials: baseConnection.authMethod ? payload.credentials : undefined,
          maximumConsentValidity: baseConnection.maximumConsentValidity,
          state: connectionId,
        }),
      });
      const data = await response.json();
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, authorizationId: data.authorizationId, lastError: undefined, } : conn));
      if (data.authorizationUrl) { window.location.href = data.authorizationUrl; }
    } catch (error: any) {
      const { message } = parseApiError(error, 'Unable to start authorization');
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, status: 'requires_update', lastError: message, } : conn));
      toast.error('Could not start the bank connection', { description: message.length > 200 ? `${message.slice(0, 197)}…` : message });
    }
  }, [enableBankingConnections, fetchWithAuth, isDataLoaded, isDemoMode, savePartialDataWithRetry, isAuthenticated, setEnableBankingConnections]);

  const handleSyncEnableBankingConnection = useCallback(async (connectionId: string, connectionOverride?: EnableBankingConnection, syncOptions?: EnableBankingSyncOptions) => {
    if (!isAuthenticated) return;
    const connection = connectionOverride || enableBankingConnections.find(c => c.id === connectionId);
    if (!connection?.sessionId) return;
    if (syncingConnectionIdsRef.current.has(connectionId)) return;
    syncingConnectionIdsRef.current.add(connectionId);
    let newTransactionCount = 0;
    let updatedTransactionCount = 0;
    const truncatedAccountNames: string[] = [];
    try {
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? { ...conn, lastError: undefined } : conn));
      const session = await fetchWithAuth('/api/enable-banking/session/fetch', { method: 'POST', body: JSON.stringify({ sessionId: connection.sessionId, applicationId: connection.applicationId, requiredPsuHeaders: connection.requiredPsuHeaders }), }).then(res => res.json());
      const accountsFromSession: any[] = session?.accounts || [];
      const updatedAccounts: EnableBankingAccount[] = [];
      const importedTransactions: Transaction[] = [];
      const shouldSyncTransactions = (syncOptions?.transactionMode || 'full') !== 'none';
      const shouldUpdateLinkedAccountBalances = syncOptions?.updateBalance ?? true;
      const linkedAccountBalanceUpdates = new Map<string, { balance: number; currency: Currency }>();

      const currentTransactions = transactionsRef.current;
      const existingMerchantNames = Array.from(
        new Set([
          ...Object.keys(preferences.merchantRules || {}),
          ...currentTransactions.map(t => t.merchant).filter((m): m is string => Boolean(m && m.trim())),
        ])
      );
      const linkedIbanToAccountName: Record<string, string> = {};
      for (const acc of accounts) {
        if (acc.accountNumber) {
          const clean = acc.accountNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (clean) linkedIbanToAccountName[clean] = acc.name;
        }
      }
      for (const conn of enableBankingConnections) {
        for (const ebAcc of conn.accounts || []) {
          if (ebAcc.accountNumber) {
            const clean = ebAcc.accountNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const linkedCrystal = ebAcc.linkedAccountId ? accounts.find(a => a.id === ebAcc.linkedAccountId) : undefined;
            if (clean) linkedIbanToAccountName[clean] = linkedCrystal?.name || ebAcc.name;
          }
        }
      }

      const userIdentities = [
        user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        demoUser ? `${demoUser.firstName} ${demoUser.lastName}`.trim() : undefined,
      ].filter((v): v is string => Boolean(v));

      const existingTxById = new Map<string, Transaction>(currentTransactions.map(tx => [tx.id, tx]));

      const prefetchedAccounts = await mapWithConcurrency(
        accountsFromSession, 2,
        async (account: any) => {
          const initialIds = extractProviderAccountIdentifiers(account);
          if (!initialIds.uid) {
            console.warn('Enable Banking account missing provider account id. Skipping.', account);
            return null;
          }
          const providerAccountId = initialIds.uid;
          const preMatchedAccount = matchExistingProviderAccount(connection.accounts || [], initialIds);
          const needsDetailsFetch = !preMatchedAccount || (!preMatchedAccount.accountNumber && !initialIds.accountNumber);
          const [details, balances] = await Promise.all([
            needsDetailsFetch
              ? fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/details`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, sessionId: connection.sessionId, requiredPsuHeaders: connection.requiredPsuHeaders }) }).then(res => res.json()).catch(() => null)
              : Promise.resolve(null),
            fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/balances`, { method: 'POST', body: JSON.stringify({ applicationId: connection.applicationId, sessionId: connection.sessionId, requiredPsuHeaders: connection.requiredPsuHeaders }) }).then(res => res.json()),
          ]);
          return { account, providerAccountId, preMatchedAccount, details, balances };
        }
      );

      for (const prefetched of prefetchedAccounts) {
        if (!prefetched) continue;
        const { account, providerAccountId, preMatchedAccount, details, balances } = prefetched;
        const identifiers = extractProviderAccountIdentifiers(account, details);
        const existingLinkedAccount = matchExistingProviderAccount(connection.accounts || [], identifiers) || preMatchedAccount;
        const resolvedBalance = resolveEnableBankingBalance(balances);
        const currency = (account?.currency || details?.currency || resolvedBalance.currency || existingLinkedAccount?.currency || 'EUR') as Currency;
        const linkedAccountId = existingLinkedAccount?.linkedAccountId;
        const accountName = details?.name || details?.product || account?.name || account?.product || existingLinkedAccount?.name || 'Bank account';

        if (identifiers.accountNumber) {
          const cleanOwn = identifiers.accountNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const linkedCrystal = linkedAccountId ? accounts.find(a => a.id === linkedAccountId) : undefined;
          if (cleanOwn) linkedIbanToAccountName[cleanOwn] = linkedCrystal?.name || accountName;
        }

        updatedAccounts.push({
          id: providerAccountId,
          identificationHash: identifiers.identificationHash || existingLinkedAccount?.identificationHash,
          accountNumber: identifiers.accountNumber || existingLinkedAccount?.accountNumber,
          cashAccountType: (typeof account?.cash_account_type === 'string' && account.cash_account_type) || (typeof details?.cash_account_type === 'string' && details.cash_account_type) || existingLinkedAccount?.cashAccountType || undefined,
          name: accountName,
          bankName: connection.selectedBank || 'Enable Banking',
          currency,
          balance: resolvedBalance.amount,
          linkedAccountId,
          syncStartDate: existingLinkedAccount?.syncStartDate,
          deletedTransactionIds: existingLinkedAccount?.deletedTransactionIds,
          lastSyncedAt: toLocalDateTimeString(new Date()),
        });

        if (shouldUpdateLinkedAccountBalances && linkedAccountId && Number.isFinite(resolvedBalance.amount)) {
          linkedAccountBalanceUpdates.set(linkedAccountId, {
            balance: resolvedBalance.amount,
            currency,
          });
        }

        const accountTargeted = !syncOptions?.targetAccountIds?.length
          || syncOptions.targetAccountIds.includes(providerAccountId)
          || (existingLinkedAccount?.id ? syncOptions.targetAccountIds.includes(existingLinkedAccount.id) : false);
        if (!shouldSyncTransactions || !linkedAccountId || !accountTargeted) {
          continue;
        }

        const dateFrom = computeSyncDateFrom({
          transactionMode: syncOptions?.transactionMode,
          syncStartDate: syncOptions?.syncStartDate,
          accountSyncStartDate: existingLinkedAccount?.syncStartDate,
          accountLastSyncedAt: existingLinkedAccount?.lastSyncedAt,
        });
        const strategy = syncOptions?.transactionMode === 'incremental' ? 'default' : 'longest';

        let continuationKey: string | undefined;
        const seenPageKeys = new Set<string>();
        let pageCapReached = true;
        for (let page = 0; page < 100; page += 1) {
          const txResponse = await fetchWithAuth(`/api/enable-banking/accounts/${encodeURIComponent(providerAccountId)}/transactions`, {
            method: 'POST',
            body: JSON.stringify({
              applicationId: connection.applicationId,
              sessionId: connection.sessionId,
              requiredPsuHeaders: connection.requiredPsuHeaders,
              dateFrom,
              continuationKey,
              strategy,
            }),
          }).then(res => res.json());

          const bookedTransactions = txResponse?.transactions?.booked || txResponse?.booked || txResponse?.transactions || [];
          bookedTransactions.forEach((providerTx: any) => {
            const mappedTx = mapEnableBankingTransaction(providerTx, {
              linkedAccountId,
              providerAccountId,
              currency,
              connectionId,
              accountDisplayName: accountName,
              ownerName: details?.owner_name || details?.ownerName || account?.owner_name,
              userIdentities,
              existingMerchantNames,
              linkedIbanToAccountName,
              ownAccountNumbers: identifiers.accountNumber ? [identifiers.accountNumber] : [],
            });
            if (mappedTx) {
              const legacyId = getLegacyEnableBankingTransactionId(providerTx, connectionId, providerAccountId);
              const legacyExisting = legacyId ? existingTxById.get(legacyId) : undefined;
              importedTransactions.push(legacyExisting ? { ...mappedTx, id: legacyExisting.id, sureId: legacyExisting.sureId ?? mappedTx.sureId } : mappedTx);
            }
          });

          const nextContinuationKey = txResponse?.continuation_key || txResponse?.continuationKey;
          if (!nextContinuationKey || seenPageKeys.has(nextContinuationKey)) { pageCapReached = false; break; }
          seenPageKeys.add(nextContinuationKey);
          continuationKey = nextContinuationKey;
        }

        if (pageCapReached) {
          truncatedAccountNames.push(updatedAccounts[updatedAccounts.length - 1].name);
          updatedAccounts[updatedAccounts.length - 1] = {
            ...updatedAccounts[updatedAccounts.length - 1],
            lastSyncedAt: existingLinkedAccount?.lastSyncedAt,
          };
        } else {
          updatedAccounts[updatedAccounts.length - 1] = {
            ...updatedAccounts[updatedAccounts.length - 1],
            lastSyncedAt: toLocalDateTimeString(new Date()),
          };
        }
      }

      if (importedTransactions.length > 0) {
        const latestTransactions = transactionsRef.current;
        const existingTxMapCountId = new Map<string, Transaction>(latestTransactions.map(tx => [tx.id, tx]));
        const existingTxMapSureId = new Map<string, Transaction>(
          latestTransactions.filter(tx => tx.importId?.startsWith(`enable-banking-${connectionId}-`) && tx.sureId).map(tx => [tx.sureId as string, tx])
        );
        const fingerprintOf = (tx: Transaction) => `${tx.accountId}|${tx.date}|${tx.amount}|${(tx.description || '').trim().toLowerCase()}|${(tx.merchant || '').trim().toLowerCase()}`;
        const existingByFingerprint = new Map<string, Transaction[]>();
        for (const tx of latestTransactions) {
          if (!tx.importId?.startsWith(`enable-banking-${connectionId}-`)) continue;
          const key = fingerprintOf(tx);
          const list = existingByFingerprint.get(key);
          if (list) list.push(tx); else existingByFingerprint.set(key, [tx]);
        }

        const deletedByAccount = deletedIdsByAccount(connection);
        const deduped: Transaction[] = [];
        const toUpdate: Transaction[] = [];
        const occurrencesOfFallbackId = new Map<string, number>();

        for (let candidate of importedTransactions) {
          const hasBankIdentifier = !!candidate.sureId && !candidate.sureId.startsWith('fallback-');
          if (!hasBankIdentifier) {
            const seen = occurrencesOfFallbackId.get(candidate.id) || 0;
            occurrencesOfFallbackId.set(candidate.id, seen + 1);
            if (seen > 0) candidate = { ...candidate, id: `${candidate.id}-${seen}`, sureId: candidate.sureId ? `${candidate.sureId}-${seen}` : candidate.sureId };
          }
          const tx = candidate;

          let existing = existingTxMapCountId.get(tx.id) || (tx.sureId ? existingTxMapSureId.get(tx.sureId) : undefined);
          if (!existing && !hasBankIdentifier) {
            const matches = existingByFingerprint.get(fingerprintOf(tx));
            existing = matches?.shift();
          }

          if (existing) {
            const filled = syncFill(existing, tx);
            if (filled) toUpdate.push(filled);
          } else if (tx.sureId && deletedByAccount.get(tx.accountId)?.has(tx.sureId)) {
            continue;
          } else {
            deduped.push(tx);
            existingTxMapCountId.set(tx.id, tx);
            if (tx.sureId) existingTxMapSureId.set(tx.sureId, tx);
          }
        }
        newTransactionCount = deduped.length;
        updatedTransactionCount = toUpdate.length;

        const brandUpdates: Record<string, string> = {};
        for (const tx of [...deduped, ...toUpdate]) {
          if (!tx.merchant) continue;
          const known = matchKnownBrand(tx.merchant);
          if (!known?.domain) continue;
          const logoKey = normalizeMerchantKey(tx.merchant);
          if (logoKey && !preferences.merchantRules?.[logoKey]?.logo) {
            brandUpdates[logoKey] = known.domain;
          }
        }
        if (Object.keys(brandUpdates).length > 0) {
          setPreferences(prev => {
            const nextRules = { ...(prev.merchantRules || {}) };
            for (const [logoKey, domain] of Object.entries(brandUpdates)) {
              if (!nextRules[logoKey]?.logo) {
                nextRules[logoKey] = { ...(nextRules[logoKey] || {}), logo: domain };
              }
            }
            return { ...prev, merchantRules: nextRules };
          });
        }

        if (deduped.length > 0) {
          handleSaveTransaction(deduped, [], { autoSpareChange: true, isNew: true });
        }

        if (toUpdate.length > 0) {
          handleSaveTransaction(toUpdate, [], { fromSync: true });
        }
      }

      if (linkedAccountBalanceUpdates.size > 0) {
        setAccounts(prev => prev.map(acc => {
          const update = linkedAccountBalanceUpdates.get(acc.id);
          if (!update) return acc;
          return {
            ...acc,
            balance: update.balance,
            currency: update.currency,
          };
        }));
      }

      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        status: 'ready',
        sessionExpiresAt: session?.access?.valid_until || conn.sessionExpiresAt,
        accounts: updatedAccounts.map(account => ({
          ...account,
          deletedTransactionIds: matchExistingProviderAccount(conn.accounts || [], {
            uid: account.id,
            identificationHash: account.identificationHash,
            accountNumber: account.accountNumber,
          })?.deletedTransactionIds ?? account.deletedTransactionIds,
        })),
        lastSyncedAt: toLocalDateTimeString(new Date()),
      } : conn));
      const bankName = connection.selectedBank || 'your bank';
      if (truncatedAccountNames.length > 0) {
        toast.warning(`${bankName}: sync incomplete`, { description: `Very long history for ${truncatedAccountNames.join(', ')}. Sync again to fetch the rest.` });
      } else if (!syncOptions?.silent) {
        toast.success(`${bankName} synced`, {
          description: `${newTransactionCount} new transaction${newTransactionCount === 1 ? '' : 's'}${updatedTransactionCount ? `, ${updatedTransactionCount} updated` : ''}.`,
        });
      }
    } catch (error: any) {
      const parsedError = parseApiError(error, 'Sync failed');
      const cleanMessage = parsedError.message;
      const requiresReauth = parsedError.requiresReauth ?? false;
      if (parsedError.errorCode === 'ASPSP_RATE_LIMIT_EXCEEDED') {
        const waitSeconds = parsedError.retryAfterSeconds ?? 6 * 60 * 60;
        bankRateLimitedUntilRef.current.set(connectionId, Date.now() + waitSeconds * 1000);
      }
      setEnableBankingConnections(prev => prev.map(conn => conn.id === connectionId ? {
        ...conn,
        status: requiresReauth ? 'requires_update' : conn.status,
        lastError: cleanMessage,
      } : conn));
      toast.error(`${connection.selectedBank || 'Bank'} sync failed`, { description: cleanMessage.length > 160 ? cleanMessage.slice(0, 157) + '…' : cleanMessage });
    } finally {
      syncingConnectionIdsRef.current.delete(connectionId);
    }
  }, [accounts, enableBankingConnections, fetchWithAuth, handleSaveTransaction, isAuthenticated, preferences.merchantRules, setAccounts, setEnableBankingConnections, setPreferences, transactionsRef, user, demoUser]);

  const handleSyncAllEnableBankingConnections = useCallback(async () => {
    const now = Date.now();
    const activeConnections = enableBankingConnections.filter(c => c.sessionId && c.status !== 'pending' && (bankRateLimitedUntilRef.current.get(c.id) ?? 0) <= now);
    const skippedForRateLimit = enableBankingConnections.filter(c => c.sessionId && c.status !== 'pending' && (bankRateLimitedUntilRef.current.get(c.id) ?? 0) > now);
    if (activeConnections.length === 0 && skippedForRateLimit.length > 0) {
      toast.info('Banks are rate limited', { description: `${skippedForRateLimit.map(c => c.selectedBank || 'A bank').join(', ')} limit${skippedForRateLimit.length === 1 ? 's' : ''} automatic requests. Try again in a few hours.` });
      return;
    }
    if (activeConnections.length === 0) {
      toast.info('No connected banks to sync yet', { description: 'Add a bank under Settings → Connections.' });
      return;
    }

    setIsSyncingBanks(true);
    try {
      for (const connection of activeConnections) {
        await handleSyncEnableBankingConnection(connection.id, connection, { transactionMode: 'incremental', silent: true });
      }
      toast.success(`Synced ${activeConnections.length} bank connection${activeConnections.length === 1 ? '' : 's'}`);
    } finally {
      setIsSyncingBanks(false);
    }
  }, [enableBankingConnections, handleSyncEnableBankingConnection]);

  const handleResetDeletedBankTransactions = useCallback((connectionId: string) => {
    setEnableBankingConnections(prev => clearDeleted(prev, connectionId));
    toast.success('Deleted transactions reset. The next sync can bring them back.');
  }, [setEnableBankingConnections]);

  const handleDeleteEnableBankingConnection = useCallback((connectionId: string) => {
    const existing = enableBankingConnections.find(conn => conn.id === connectionId);
    if (existing?.sessionId) {
      fetchWithAuth(`/api/enable-banking/session/${encodeURIComponent(existing.sessionId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ applicationId: existing.applicationId, requiredPsuHeaders: existing.requiredPsuHeaders }),
      }).catch(() => { /* best-effort upstream consent revocation */ });
    }
    setEnableBankingConnections(prev => prev.filter(conn => conn.id !== connectionId));
    removePendingConnection(connectionId);
  }, [enableBankingConnections, fetchWithAuth, setEnableBankingConnections]);

  const handleLinkEnableBankingAccount = useCallback((connectionId: string, providerAccountId: string, payload: EnableBankingLinkPayload) => {
    const connection = enableBankingConnections.find(conn => conn.id === connectionId);
    const providerAccount = connection?.accounts.find(a => a.id === providerAccountId);
    let finalLinkedAccountId: string | undefined = 'linkedAccountId' in payload ? payload.linkedAccountId : undefined;
    if ('newAccount' in payload) {
      const generatedId = `acc-${uuidv4()}`;
      handleSaveAccount({
        ...payload.newAccount,
        id: generatedId,
        accountNumber: providerAccount?.accountNumber || payload.newAccount.accountNumber,
        financialInstitution: connection?.selectedBank || providerAccount?.bankName || payload.newAccount.financialInstitution,
      });
      finalLinkedAccountId = generatedId;
    }
    if (!finalLinkedAccountId) return;
    setEnableBankingConnections(prev => prev.map(conn => {
      if (conn.id !== connectionId) return conn;
      return { ...conn, accounts: conn.accounts.map(a => a.id === providerAccountId ? { ...a, linkedAccountId: finalLinkedAccountId, syncStartDate: payload.syncStartDate } : a) };
    }));
  }, [enableBankingConnections, handleSaveAccount, setEnableBankingConnections]);

  const linkedEnableBankingAccountIds = useMemo(
    () => new Set(enableBankingConnections.flatMap(c => (c.accounts || []).map(a => a.linkedAccountId).filter(Boolean))),
    [enableBankingConnections]
  );

  const enableBankingLinkMap = useMemo(() => {
    const map = new Map<string, { connection: EnableBankingConnection; account: EnableBankingAccount }>();
    enableBankingConnections.forEach(c => (c.accounts || []).forEach(a => { if (a.linkedAccountId) map.set(a.linkedAccountId, { connection: c, account: a }); }));
    return map;
  }, [enableBankingConnections]);

  return {
    isSyncingBanks,
    handleFetchEnableBankingBanks,
    handleCreateEnableBankingConnection,
    handleSyncEnableBankingConnection,
    handleSyncAllEnableBankingConnections,
    handleResetDeletedBankTransactions,
    handleDeleteEnableBankingConnection,
    handleLinkEnableBankingAccount,
    linkedEnableBankingAccountIds,
    enableBankingLinkMap,
  };
}

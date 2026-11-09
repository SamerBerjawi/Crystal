import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Textarea, TextInput } from './ui/Fields';
import { ConfirmDialog } from './ui/Overlays';
import { Banner } from './ui/States';
import { parseApiError } from '../utils/apiError';
import { fetchCredentialStatus, fetchRedirectUrl, type RedirectUrlSource } from '../utils/enableBankingStorage';
import { pemProblem } from '../utils/pem';

/** Any country works: the call only proves Enable Banking accepts the application ID and key. */
const VERIFY_COUNTRY = 'FI';

interface EnableBankingCredentialsPanelProps {
  /** Called after the stored application changes, so other parts of the page can refresh. */
  onChanged: () => void;
}

/** The Enable Banking application ID and private key. The key is stored encrypted on the server, never in the browser. */
const EnableBankingCredentialsPanel: React.FC<EnableBankingCredentialsPanelProps> = ({ onChanged }) => {
  const [status, setStatus] = useState<{ configured: boolean; applicationId: string } | null>(null);
  const [callback, setCallback] = useState<{ redirectUrl: string | null; configured: boolean; source: RedirectUrlSource } | null>(null);
  const [callbackDraft, setCallbackDraft] = useState('');
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [callbackBusy, setCallbackBusy] = useState(false);
  const [isEditing, setEditing] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRemoving, setRemoving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCredentialStatus().then(next => {
      if (cancelled) return;
      setStatus(next);
      setApplicationId(next.applicationId);
      setEditing(!next.configured);
    });
    fetchRedirectUrl().then(next => { if (!cancelled) { setCallback(next); setCallbackDraft(next.source === 'saved' ? next.redirectUrl ?? '' : ''); } });
    return () => { cancelled = true; };
  }, []);

  const request = async (path: string, init: RequestInit) => {
    const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
    if (!response.ok) throw new Error(await response.text());
    return response;
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20_000) { setError('That file is too large to be a private key.'); return; }
    setPrivateKey(await file.text());
    setError(null);
  };

  const save = async () => {
    const id = applicationId.trim();
    const key = privateKey.trim();
    setError(null);
    setNotice(null);
    if (!id) { setError('Enter the application ID shown in the Enable Banking control panel.'); return; }
    const changedApplication = !status?.configured || id !== status.applicationId;
    if (!key && !changedApplication) { setEditing(false); return; }
    const problem = pemProblem(key);
    if (problem) { setError(problem); return; }

    setBusy(true);
    try {
      // The server keeps the key only once Enable Banking has accepted it.
      await request('/api/enable-banking/aspsps', { method: 'POST', body: JSON.stringify({ applicationId: id, countryCode: VERIFY_COUNTRY, clientCertificate: key }) });
      setStatus({ configured: true, applicationId: id });
      setPrivateKey('');
      setEditing(false);
      setNotice('Enable Banking accepted the application ID and key. They are saved, encrypted, on the server.');
      onChanged();
    } catch (err) {
      setError(parseApiError(err, 'Could not verify the application ID and key.').message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setRemoving(false);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await request('/api/enable-banking/credentials', { method: 'DELETE' });
      setStatus({ configured: false, applicationId: '' });
      setApplicationId('');
      setPrivateKey('');
      setEditing(true);
      setNotice('The saved application ID and key were removed.');
      onChanged();
    } catch (err) {
      setError(parseApiError(err, 'Could not remove the saved key.').message);
    } finally {
      setBusy(false);
    }
  };

  /** Saves the callback URL typed here, or clears it (null) to go back to the address Crystal is opened at. */
  const saveCallback = async (value: string | null) => {
    setCallbackBusy(true);
    setCallbackError(null);
    try {
      const response = await request('/api/enable-banking/redirect-url', { method: 'PUT', body: JSON.stringify({ redirectUrl: value }) });
      const body = await response.json();
      setCallback({ redirectUrl: body.redirectUrl ?? null, configured: Boolean(body.configured), source: body.source === 'saved' ? 'saved' : 'request' });
      setCallbackDraft(body.source === 'saved' ? body.redirectUrl ?? '' : '');
      onChanged();
    } catch (err) {
      setCallbackError(parseApiError(err, 'Could not save the callback URL.').message);
    } finally {
      setCallbackBusy(false);
    }
  };

  if (!status) {
    return <p className="type-caption text-muted">Loading credentials…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="type-body-strong text-ink">Application and private key</h3>
        <Badge tone={status.configured ? 'positive' : 'attention'}>{status.configured ? 'Saved' : 'Not set up'}</Badge>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="info">{notice}</Banner>}

      {isEditing ? (
        <div className="space-y-4">
          <TextInput label="Application ID" autoComplete="off" value={applicationId} onChange={setApplicationId} help="Shown for your application in the Enable Banking control panel." />
          <Textarea
            label="Private key (.pem)"
            rows={5}
            autoComplete="off"
            value={privateKey}
            onChange={setPrivateKey}
            placeholder={status.configured ? 'A key is saved. Paste a new one only to replace it.' : '-----BEGIN PRIVATE KEY-----'}
            help="The private key you generated, not the certificate you uploaded to Enable Banking. Stored encrypted on the server."
          />
          <input ref={fileInput} type="file" accept=".pem,.key,.txt" className="sr-only" tabIndex={-1} aria-hidden onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
          <div className="flex flex-wrap gap-2">
            <Button isBusy={isBusy} onPress={save}>Verify and save</Button>
            <Button variant="secondary" isDisabled={isBusy} onPress={() => fileInput.current?.click()}>Choose .pem file</Button>
            {status.configured && <Button variant="ghost" isDisabled={isBusy} onPress={() => { setEditing(false); setPrivateKey(''); setApplicationId(status.applicationId); setError(null); }}>Cancel</Button>}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="type-caption text-muted">Application ID</p>
            <p className="type-body truncate text-ink">{status.applicationId || 'Unknown'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onPress={() => { setEditing(true); setNotice(null); }}>Change</Button>
            <Button variant="ghost" size="sm" isDisabled={isBusy} onPress={() => setRemoving(true)}>Remove</Button>
          </div>
        </div>
      )}

      {callback && (
        <div className="space-y-3 border-t border-line pt-4">
          <div>
            <p className="type-body-strong text-ink">Callback URL</p>
            <p className="type-caption text-muted">Register this exact URL in your Enable Banking application. The bank sends you back to it after you approve access.</p>
          </div>
          {callbackError && <Banner tone="error">{callbackError}</Banner>}
          {callback.source === 'env' ? (
            <>
              <p className="type-body break-all text-ink">{callback.redirectUrl}</p>
              <p className="type-caption text-muted">Set by ENABLE_BANKING_REDIRECT_URL on the server, so it can’t be changed here.</p>
            </>
          ) : (
            <>
              <TextInput
                label="Callback URL"
                autoComplete="off"
                value={callbackDraft}
                onChange={setCallbackDraft}
                placeholder={callback.source === 'request' ? callback.redirectUrl ?? 'https://crystal.example.com/enable-banking/callback' : 'https://crystal.example.com/enable-banking/callback'}
                help={callback.source === 'request'
                  ? 'Empty: built from the address you opened Crystal at, shown above as the placeholder. Enter the registered URL to fix it.'
                  : 'Saved. Clear it to go back to the address you opened Crystal at.'}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" isBusy={callbackBusy} isDisabled={!callbackDraft.trim() || callbackDraft.trim() === (callback.source === 'saved' ? callback.redirectUrl : '')} onPress={() => saveCallback(callbackDraft.trim())}>Save callback URL</Button>
                {callback.source === 'saved' && <Button size="sm" variant="ghost" isDisabled={callbackBusy} onPress={() => saveCallback(null)}>Use automatic</Button>}
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={isRemoving}
        onClose={() => setRemoving(false)}
        onConfirm={remove}
        title="Remove the saved application and key?"
        message="Connected banks stop syncing until you enter them again. Your accounts and transactions stay."
        confirmLabel="Remove"
        isDestructive
      />
    </div>
  );
};

export default EnableBankingCredentialsPanel;

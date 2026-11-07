import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Textarea, TextInput } from './ui/Fields';
import { ConfirmDialog } from './ui/Overlays';
import { Banner } from './ui/States';
import { parseApiError } from '../utils/apiError';
import { fetchCredentialStatus, fetchRedirectUrl } from '../utils/enableBankingStorage';
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
  const [callback, setCallback] = useState<{ redirectUrl: string | null; configured: boolean } | null>(null);
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
    fetchRedirectUrl().then(next => { if (!cancelled) setCallback(next); });
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

  if (!status) return null;

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

      {callback?.redirectUrl && (
        <div className="border-t border-line pt-4">
          <p className="type-caption text-muted">Callback URL to register in your Enable Banking application</p>
          <p className="type-body break-all text-ink">{callback.redirectUrl}</p>
          <p className="type-caption mt-1 text-muted">
            {callback.configured
              ? 'Set by ENABLE_BANKING_REDIRECT_URL on the server.'
              : 'Built from the address you opened Crystal at. Set ENABLE_BANKING_REDIRECT_URL on the server to fix it to the URL you registered.'}
          </p>
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

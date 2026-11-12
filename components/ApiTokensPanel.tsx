import React, { useEffect, useState } from 'react';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Switch, TextInput } from './ui/Fields';
import { Select } from './ui/Pickers';
import { Banner } from './ui/States';
import { parseApiError } from '../utils/apiError';

type Scope = 'summary' | 'transactions' | 'investments' | 'planning';

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'summary', label: 'Summary: net worth, accounts, budgets' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'investments', label: 'Investments' },
  { id: 'planning', label: 'Planning: goals, bills, recurring' },
];

const EXPIRY: { id: string; label: string }[] = [
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '365', label: '1 year' },
  { id: 'never', label: 'Never' },
];

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error(await response.text());
  return response;
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);

const statusOf = (token: ApiToken): { tone: 'positive' | 'neutral' | 'negative'; label: string } => {
  if (token.revokedAt) return { tone: 'neutral', label: 'Revoked' };
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) return { tone: 'negative', label: 'Expired' };
  return { tone: 'positive', label: 'Active' };
};

/** Read-only tokens for tools outside Crystal. Each one is limited to the scopes you pick, can expire, and can be revoked. */
const ApiTokensPanel: React.FC = () => {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<Scope[]>(['summary']);
  const [expiry, setExpiry] = useState('90');
  const [fresh, setFresh] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => request('/api/tokens').then(r => r.json()).then((body: { tokens: ApiToken[] }) => setTokens(body.tokens));

  useEffect(() => { load().catch(() => setUnavailable(true)); }, []);

  if (unavailable) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <p className="type-caption text-muted">API tokens need an authenticated server connection and are unavailable in demo mode.</p>
        <Badge tone="neutral">Sign in required</Badge>
      </div>
    );
  }
  if (!tokens) return <p className="type-caption text-muted py-1">Loading tokens…</p>;

  const toggle = (scope: Scope, on: boolean) => setScopes(on ? [...scopes, scope] : scopes.filter(s => s !== scope));

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await request('/api/tokens', { method: 'POST', body: JSON.stringify({ name: name.trim(), scopes, expiresInDays: expiry === 'never' ? null : Number(expiry) }) });
      const body = await response.json();
      setFresh(body.token);
      setName('');
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not create the token.').message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await request(`/api/tokens/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not revoke the token.').message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="type-body text-muted">Let a script or an AI tool read your data without your password. Tokens are read-only and limited to the scopes you pick. Revoke one and it stops working at once.</p>

      {error && <Banner tone="error">{error}</Banner>}
      {fresh && (
        <Banner tone="attention">
          <div className="space-y-2">
            <p>Copy this token now. It is not shown again.</p>
            <code className="block break-all rounded-lg bg-solid px-3 py-2 type-caption text-ink select-all">{fresh}</code>
            <div className="flex gap-2">
              <Button variant="ghost" onPress={() => { void navigator.clipboard?.writeText(fresh); }}>Copy</Button>
              <Button variant="ghost" onPress={() => setFresh(null)}>I have copied it</Button>
            </div>
          </div>
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="Name" value={name} onChange={setName} placeholder="Claude, a script…" autoComplete="off" />
        <Select label="Expires" value={expiry} onChange={setExpiry} options={EXPIRY} />
      </div>
      <div className="space-y-2">
        <h4 className="type-label text-muted">Can read</h4>
        {SCOPES.map(scope => <Switch key={scope.id} isSelected={scopes.includes(scope.id)} onChange={on => toggle(scope.id, on)}>{scope.label}</Switch>)}
      </div>
      <Button onPress={create} isDisabled={isBusy || !name.trim() || scopes.length === 0}>Create token</Button>

      {tokens.length > 0 && (
        <ul className="divide-y divide-line">
          {tokens.map(token => {
            const status = statusOf(token);
            return (
              <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="type-body-strong text-ink">{token.name}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="type-caption text-muted">
                    {token.prefix}… · {token.scopes.join(', ')} · {token.lastUsedAt ? `used ${day(token.lastUsedAt)}` : 'never used'}{token.expiresAt && !token.revokedAt ? ` · expires ${day(token.expiresAt)}` : ''}
                  </p>
                </div>
                {!token.revokedAt && <Button variant="ghost" onPress={() => revoke(token.id)} isDisabled={isBusy}>Revoke</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ApiTokensPanel;

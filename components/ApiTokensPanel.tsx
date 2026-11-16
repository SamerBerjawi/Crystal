import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Switch, TextInput } from './ui/Fields';
import { ConfirmDialog } from './ui/Overlays';
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
  const [pendingRevoke, setPendingRevoke] = useState<ApiToken | null>(null);

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
      toast.success('Token revoked');
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not revoke the token.').message);
    } finally {
      setBusy(false);
      setPendingRevoke(null);
    }
  };

  const copyText = (text: string, message: string) => {
    if (!navigator.clipboard) {
      toast.error('Clipboard is not available in this browser');
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => toast.success(message),
      () => toast.error('Could not copy to clipboard'),
    );
  };

  const activeTokens = tokens.filter(t => statusOf(t).label === 'Active');
  const inactiveTokens = tokens.filter(t => statusOf(t).label !== 'Active');
  const origin = window.location.origin;
  const placeholderToken = fresh || '<YOUR_TOKEN>';
  const mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        crystal: {
          type: 'http',
          url: `${origin}/api/mcp`,
          headers: { Authorization: `Bearer ${placeholderToken}` },
        },
      },
    },
    null,
    2,
  );
  const curlSnippet = `curl -s -H "Authorization: Bearer ${placeholderToken}" "${origin}/api/v1/summary"`;

  const renderTokenRow = (token: ApiToken) => {
    const status = statusOf(token);
    return (
      <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-body-strong text-ink">{token.name}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="type-caption text-muted">
            {token.prefix}… · {token.scopes.join(', ')} · {token.lastUsedAt ? `used ${day(token.lastUsedAt)}` : 'never used'}
            {token.expiresAt && !token.revokedAt ? ` · expires ${day(token.expiresAt)}` : ''}
            {token.revokedAt ? ` · revoked ${day(token.revokedAt)}` : ''}
          </p>
        </div>
        {!token.revokedAt && (
          <Button variant="ghost" size="sm" onPress={() => setPendingRevoke(token)} isDisabled={isBusy}>Revoke</Button>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <p className="type-body text-muted">
        Let a script or an AI tool read your data without your password. Tokens are read-only, scoped to the data you pick, and stop working immediately when revoked.
      </p>

      {error && <Banner tone="error">{error}</Banner>}
      {fresh && (
        <Banner tone="attention">
          <div className="space-y-2">
            <p>Copy this token now. It is not shown again.</p>
            <code className="block break-all rounded-[var(--radius-md)] border border-line bg-solid px-3 py-2 type-caption text-ink select-all">{fresh}</code>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon="copy-01" onPress={() => copyText(fresh, 'Token copied to clipboard')}>Copy token</Button>
              <Button variant="ghost" size="sm" onPress={() => setFresh(null)}>I have copied it</Button>
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

      {activeTokens.length > 0 && (
        <div className="space-y-1">
          <h4 className="type-label text-muted">Active tokens ({activeTokens.length})</h4>
          <ul className="divide-y divide-line">
            {activeTokens.map(renderTokenRow)}
          </ul>
        </div>
      )}

      {inactiveTokens.length > 0 && (
        <details className="rounded-[var(--radius-lg)] border border-line bg-inset px-4 py-3">
          <summary className="cursor-pointer select-none type-caption font-medium text-muted">
            Revoked & expired tokens ({inactiveTokens.length})
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {inactiveTokens.map(renderTokenRow)}
          </ul>
        </details>
      )}

      <details className="rounded-[var(--radius-lg)] border border-line bg-inset px-4 py-3">
        <summary className="cursor-pointer select-none type-caption font-medium text-ink">
          Connect an MCP client or script
        </summary>
        <div className="mt-3 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="type-caption text-muted">MCP client config (<code className="select-all">{origin}/api/mcp</code>)</span>
              <Button variant="ghost" size="sm" icon="copy-01" onPress={() => copyText(mcpConfigSnippet, 'MCP config copied')}>Copy</Button>
            </div>
            <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-solid p-3 type-caption text-ink">{mcpConfigSnippet}</pre>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="type-caption text-muted">REST API quick check</span>
              <Button variant="ghost" size="sm" icon="copy-01" onPress={() => copyText(curlSnippet, 'cURL command copied')}>Copy</Button>
            </div>
            <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-solid p-3 type-caption text-ink">{curlSnippet}</pre>
          </div>
        </div>
      </details>

      <ConfirmDialog
        isOpen={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        onConfirm={() => { if (pendingRevoke) void revoke(pendingRevoke.id); }}
        title="Revoke API token?"
        message={pendingRevoke ? `"${pendingRevoke.name}" (${pendingRevoke.prefix}…) will stop working immediately and cannot be restored.` : ''}
        confirmLabel="Revoke token"
        isDestructive
      />
    </div>
  );
};

export default ApiTokensPanel;

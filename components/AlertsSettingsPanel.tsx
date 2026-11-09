import React, { useEffect, useState } from 'react';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Switch, TextInput } from './ui/Fields';
import { Select } from './ui/Pickers';
import { Banner } from './ui/States';
import { parseApiError } from '../utils/apiError';

type ChannelKind = 'ntfy' | 'gotify' | 'webhook';

interface AlertRules {
  consent: boolean;
  budget: boolean;
  budgetThreshold: number;
  duplicate: boolean;
  lowBalance: boolean;
  lowBalanceFloor: number;
  lowBalanceDays: number;
  priceHike: boolean;
}

interface AlertSettings {
  enabled: boolean;
  channel: { kind: ChannelKind; url: string; topic: string; hasToken: boolean } | null;
  rules: AlertRules;
  privateUrlsAllowed: boolean;
}

const KINDS: { id: ChannelKind; label: string; description: string }[] = [
  { id: 'ntfy', label: 'ntfy', description: 'A topic on ntfy.sh or your own ntfy server' },
  { id: 'gotify', label: 'Gotify', description: 'Your own Gotify server' },
  { id: 'webhook', label: 'Webhook', description: 'Crystal posts JSON to an address you choose' },
];

const RULE_ROWS: { key: 'consent' | 'budget' | 'duplicate' | 'lowBalance' | 'priceHike'; label: string }[] = [
  { key: 'lowBalance', label: 'A checking account is about to run low' },
  { key: 'budget', label: 'A monthly budget is nearly used up' },
  { key: 'duplicate', label: 'The same payment is charged twice' },
  { key: 'priceHike', label: 'A recurring payment costs more than expected' },
  { key: 'consent', label: 'A bank connection is about to expire' },
];

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error(await response.text());
  return response;
};

const toNumber = (text: string, fallback: number) => {
  const value = parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) ? value : fallback;
};

/** Sends alerts from the server, so they arrive when Crystal is closed. The access token is stored encrypted there. */
const AlertsSettingsPanel: React.FC = () => {
  const [saved, setSaved] = useState<AlertSettings | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [kind, setKind] = useState<ChannelKind>('ntfy');
  const [url, setUrl] = useState('https://ntfy.sh');
  const [topic, setTopic] = useState('');
  const [token, setToken] = useState('');
  const [rules, setRules] = useState<AlertRules | null>(null);
  const [percent, setPercent] = useState('80');
  const [floor, setFloor] = useState('0');
  const [days, setDays] = useState('7');
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = (next: AlertSettings) => {
    setSaved(next);
    setEnabled(next.enabled);
    if (next.channel) { setKind(next.channel.kind); setUrl(next.channel.url); setTopic(next.channel.topic); }
    setToken('');
    setRules(next.rules);
    setPercent(String(Math.round(next.rules.budgetThreshold * 100)));
    setFloor(String(next.rules.lowBalanceFloor));
    setDays(String(next.rules.lowBalanceDays));
  };

  useEffect(() => {
    let cancelled = false;
    request('/api/alerts')
      .then(response => response.json())
      .then((next: AlertSettings) => { if (!cancelled) apply(next); })
      .catch(() => { if (!cancelled) setUnavailable(true); });
    return () => { cancelled = true; };
  }, []);

  if (unavailable) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div>
          <p className="type-caption text-muted">Push notifications require an authenticated server connection and are unavailable in demo mode.</p>
        </div>
        <Badge tone="neutral">Sign in required</Badge>
      </div>
    );
  }

  if (!saved || !rules) {
    return <p className="type-caption text-muted py-1">Loading alert settings…</p>;
  }

  const needsTopic = kind === 'ntfy';
  const tokenLabel = kind === 'gotify' ? 'Application token' : kind === 'ntfy' ? 'Access token (optional)' : 'Bearer token (optional)';
  const channelChanged = !saved.channel || saved.channel.kind !== kind || saved.channel.url !== url.trim() || saved.channel.topic !== topic.trim() || token !== '';
  const isDirty = enabled !== saved.enabled || channelChanged
    || JSON.stringify(rules) !== JSON.stringify(saved.rules)
    || toNumber(percent, 80) / 100 !== saved.rules.budgetThreshold || toNumber(floor, 0) !== saved.rules.lowBalanceFloor || Math.round(toNumber(days, 7)) !== saved.rules.lowBalanceDays;

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await request('/api/alerts', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          channel: url.trim() ? { kind, url: url.trim(), topic: topic.trim(), ...(token ? { token } : {}) } : null,
          rules: {
            ...rules,
            budgetThreshold: Math.min(99, Math.max(50, toNumber(percent, 80))) / 100,
            lowBalanceFloor: toNumber(floor, 0),
            lowBalanceDays: Math.min(30, Math.max(1, Math.round(toNumber(days, 7)))),
          },
        }),
      });
      apply(await response.json());
      setNotice('Alert settings saved.');
    } catch (err) {
      setError(parseApiError(err, 'Could not save the alert settings.').message);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await request('/api/alerts/test', { method: 'POST' });
      setNotice('Test sent. Check that it arrived.');
    } catch (err) {
      setError(parseApiError(err, 'Could not send the test.').message);
    } finally {
      setBusy(false);
    }
  };

  const setRule = (key: typeof RULE_ROWS[number]['key'], value: boolean) => setRules({ ...rules, [key]: value });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="type-body-strong text-ink">Alerts from the server</h3>
        <Badge tone={saved.enabled ? 'positive' : 'neutral'}>{saved.enabled ? 'On' : 'Off'}</Badge>
      </div>
      <p className="type-body text-muted">Get a message on your phone when something needs attention, even with Crystal closed. The server checks your data every half hour and sends each alert once.</p>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="info">{notice}</Banner>}

      <Switch isSelected={enabled} onChange={setEnabled}>Send alerts</Switch>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select label="Send with" value={kind} onChange={id => { setKind(id as ChannelKind); if (id === 'ntfy' && !url.trim()) setUrl('https://ntfy.sh'); }} options={KINDS.map(({ id, label, description }) => ({ id, label, description }))} />
        <TextInput label={kind === 'webhook' ? 'Webhook address' : 'Server address'} autoComplete="off" value={url} onChange={setUrl} help={saved.privateUrlsAllowed ? 'Addresses on your own network are allowed.' : 'A public address. Addresses on your own network need ALERTS_ALLOW_PRIVATE_URLS=true on the server.'} />
        {needsTopic && <TextInput label="Topic" autoComplete="off" value={topic} onChange={setTopic} help="Pick something hard to guess: anyone who knows a public ntfy topic can read it." />}
        <TextInput label={tokenLabel} type="password" autoComplete="new-password" value={token} onChange={setToken} placeholder={saved.channel?.hasToken ? 'Saved. Type to replace it.' : ''} help="Stored encrypted on the server and never shown again." />
      </div>

      <div className="space-y-2">
        <h4 className="type-label text-muted">Tell me when</h4>
        {RULE_ROWS.map(row => <Switch key={row.key} isSelected={rules[row.key]} onChange={value => setRule(row.key, value)}>{row.label}</Switch>)}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextInput label="Budget warning at (%)" inputMode="numeric" value={percent} onChange={setPercent} help="Between 50 and 99. You also hear when a budget is used up." />
        <TextInput label="Low balance below" inputMode="decimal" value={floor} onChange={setFloor} help="In the account's own currency." />
        <TextInput label="Look ahead (days)" inputMode="numeric" value={days} onChange={setDays} help="Scheduled payments within this many days." />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onPress={save} isDisabled={isBusy || !isDirty}>Save</Button>
        <Button variant="ghost" onPress={sendTest} isDisabled={isBusy || isDirty || !saved.channel}>Send a test</Button>
      </div>
    </div>
  );
};

export default AlertsSettingsPanel;

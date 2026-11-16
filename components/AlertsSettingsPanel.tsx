import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Switch, TextInput } from './ui/Fields';
import Icon from './ui/Icon';
import { Select } from './ui/Pickers';
import { Banner } from './ui/States';
import { explainUnavailable, parseApiError, type Unavailable } from '../utils/apiError';

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
  weekly: boolean;
}

interface ActiveAlertPreview {
  key: string;
  kind: string;
  title: string;
  message: string;
  priority: 'default' | 'high';
}

interface AlertSettings {
  enabled: boolean;
  channel: { kind: ChannelKind; url: string; topic: string; hasToken: boolean } | null;
  rules: AlertRules;
  privateUrlsAllowed: boolean;
  activeAlerts?: ActiveAlertPreview[];
}

const KINDS: { id: ChannelKind; label: string; description: string }[] = [
  { id: 'ntfy', label: 'ntfy', description: 'A topic on ntfy.sh or your own ntfy server' },
  { id: 'gotify', label: 'Gotify', description: 'Your own Gotify server' },
  { id: 'webhook', label: 'Webhook', description: 'Crystal posts JSON to an address you choose' },
];

const RULE_ROWS: { key: 'consent' | 'budget' | 'duplicate' | 'lowBalance' | 'priceHike' | 'weekly'; label: string }[] = [
  { key: 'lowBalance', label: 'A checking account is about to run low' },
  { key: 'budget', label: 'A monthly budget is nearly used up' },
  { key: 'duplicate', label: 'The same payment is charged twice' },
  { key: 'priceHike', label: 'A recurring payment costs more than expected' },
  { key: 'consent', label: 'A bank connection is about to expire' },
  { key: 'weekly', label: 'A recap of your week, on Monday' },
];

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) {
    // Keep the status: it is what tells the demo, an older server and a stopped one apart.
    const failure = new Error(await response.text()) as Error & { status?: number };
    failure.status = response.status;
    throw failure;
  }
  return response;
};

const toNumber = (text: string, fallback: number) => {
  const value = parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) ? value : fallback;
};

/** Sends alerts from the server, so they arrive when Crystal is closed. The access token is stored encrypted there. */
const AlertsSettingsPanel: React.FC = () => {
  const [saved, setSaved] = useState<AlertSettings | null>(null);
  const [problem, setProblem] = useState<Unavailable | null>(null);
  const alive = useRef(true);
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

  const load = useCallback(async () => {
    setProblem(null);
    try {
      const next = await (await request('/api/alerts')).json();
      if (alive.current) apply(next);
    } catch (err) {
      if (alive.current) setProblem(explainUnavailable(err, 'Alerts'));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  // Never a blank box: say why this cannot be set up here.
  if (problem) {
    return (
      <Banner tone="attention" actionLabel="Try again" onAction={() => void load()}>
        <span className="type-body-strong">{problem.title}.</span> {problem.detail}
      </Banner>
    );
  }
  if (!saved || !rules) return <p className="type-caption text-muted" role="status">Checking alerts...</p>;

  const needsTopic = kind === 'ntfy';
  const tokenLabel = kind === 'gotify' ? 'Application token' : kind === 'ntfy' ? 'Access token (optional)' : 'Bearer token (optional)';
  const channelChanged = !saved.channel || saved.channel.kind !== kind || saved.channel.url !== url.trim() || saved.channel.topic !== topic.trim() || token !== '';
  const isDirty = enabled !== saved.enabled || channelChanged
    || JSON.stringify(rules) !== JSON.stringify(saved.rules)
    || toNumber(percent, 80) / 100 !== saved.rules.budgetThreshold || toNumber(floor, 0) !== saved.rules.lowBalanceFloor || Math.round(toNumber(days, 7)) !== saved.rules.lowBalanceDays;

  const buildPayload = () => ({
    enabled,
    channel: url.trim() ? { kind, url: url.trim(), topic: topic.trim(), ...(token ? { token } : {}) } : null,
    rules: {
      ...rules,
      budgetThreshold: Math.min(99, Math.max(50, toNumber(percent, 80))) / 100,
      lowBalanceFloor: toNumber(floor, 0),
      lowBalanceDays: Math.min(30, Math.max(1, Math.round(toNumber(days, 7)))),
    },
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await request('/api/alerts', {
        method: 'PUT',
        body: JSON.stringify(buildPayload()),
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
      if (isDirty) {
        const savedResp = await request('/api/alerts', {
          method: 'PUT',
          body: JSON.stringify(buildPayload()),
        });
        apply(await savedResp.json());
      }
      await request('/api/alerts/test', { method: 'POST' });
      setNotice(isDirty ? 'Settings saved and test alert sent.' : 'Test sent. Check that it arrived.');
    } catch (err) {
      setError(parseApiError(err, 'Could not send the test.').message);
    } finally {
      setBusy(false);
    }
  };

  const setRule = (key: typeof RULE_ROWS[number]['key'], value: boolean) => setRules({ ...rules, [key]: value });
  const activeAlerts = saved.activeAlerts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-body-strong text-ink">Alerts from the server</h3>
            <Badge tone={saved.enabled ? 'positive' : 'neutral'}>{saved.enabled ? 'On' : 'Off'}</Badge>
          </div>
          <p className="type-body mt-1 text-muted">
            Get a message on your phone when something needs attention, even with Crystal closed. The server checks your data every half hour and sends each alert once.
          </p>
        </div>
        <Switch isSelected={enabled} onChange={setEnabled}>Send alerts</Switch>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="info">{notice}</Banner>}

      <section className="space-y-4 rounded-[var(--radius-lg)] border border-line bg-inset p-4">
        <h4 className="type-label text-muted">Delivery channel</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select label="Send with" value={kind} onChange={id => { setKind(id as ChannelKind); if (id === 'ntfy' && !url.trim()) setUrl('https://ntfy.sh'); }} options={KINDS.map(({ id, label, description }) => ({ id, label, description }))} />
          <TextInput label={kind === 'webhook' ? 'Webhook address' : 'Server address'} autoComplete="off" value={url} onChange={setUrl} help={saved.privateUrlsAllowed ? 'Addresses on your own network are allowed.' : 'A public address. Addresses on your own network need ALERTS_ALLOW_PRIVATE_URLS=true on the server.'} />
          {needsTopic && <TextInput label="Topic" autoComplete="off" value={topic} onChange={setTopic} help="Pick something hard to guess: anyone who knows a public ntfy topic can read it." />}
          <TextInput label={tokenLabel} type="password" autoComplete="new-password" value={token} onChange={setToken} placeholder={saved.channel?.hasToken ? 'Saved. Type to replace it.' : ''} help="Stored encrypted on the server and never shown again." />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="type-label text-muted">Alert rules & thresholds</h4>
        <div className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-solid">
          {RULE_ROWS.map(row => (
            <div key={row.key} className="space-y-3 px-4 py-3">
              <Switch isSelected={rules[row.key]} onChange={value => setRule(row.key, value)}>{row.label}</Switch>
              {row.key === 'lowBalance' && rules.lowBalance && (
                <div className="grid grid-cols-1 gap-3 pl-1 pt-1 md:grid-cols-2">
                  <TextInput label="Low balance below" inputMode="decimal" value={floor} onChange={setFloor} help="In each checking account's own currency." />
                  <TextInput label="Look ahead (days)" inputMode="numeric" value={days} onChange={setDays} help="Scheduled bills and recurring items within 1–30 days." />
                </div>
              )}
              {row.key === 'budget' && rules.budget && (
                <div className="max-w-xs pl-1 pt-1">
                  <TextInput label="Budget warning at (%)" inputMode="numeric" value={percent} onChange={setPercent} help="Between 50 and 99. Also alerts again at 100%." />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {Array.isArray(activeAlerts) && (
        <section className="space-y-2.5 rounded-[var(--radius-lg)] border border-line bg-inset p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="type-label text-muted">Active alerts right now</h4>
            <Badge tone={activeAlerts.length > 0 ? 'attention' : 'neutral'}>{activeAlerts.length}</Badge>
          </div>
          {activeAlerts.length === 0 ? (
            <p className="flex items-center gap-2 type-caption text-muted">
              <Icon name="checkmark-circle-02" size={16} className="text-money-in" />
              <span>Nothing currently triggers these rules against your saved financial data.</span>
            </p>
          ) : (
            <ul className="space-y-2">
              {activeAlerts.map(alert => (
                <li key={alert.key} className="rounded-[var(--radius-md)] border border-line bg-solid px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={alert.priority === 'high' ? 'negative' : 'attention'}>
                      {alert.priority === 'high' ? 'Urgent' : 'Notice'}
                    </Badge>
                    <span className="type-body-strong text-ink">{alert.title}</span>
                  </div>
                  <p className="type-caption mt-1 text-muted">{alert.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onPress={save} isDisabled={isBusy || !isDirty}>Save settings</Button>
        <Button variant="secondary" onPress={sendTest} isDisabled={isBusy || !url.trim()}>
          {isDirty ? 'Save & send test' : 'Send a test'}
        </Button>
      </div>
    </div>
  );
};

export default AlertsSettingsPanel;

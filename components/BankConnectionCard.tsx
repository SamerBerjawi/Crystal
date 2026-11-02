import React from 'react';
import { Account, EnableBankingAccount, EnableBankingConnection } from '../types';
import { BrandMark } from './ServiceCard';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu } from './ui/Menu';
import { Amount } from './ui/Money';
import { Banner } from './ui/States';

const STATUS: Record<EnableBankingConnection['status'], { label: string; tone: 'neutral' | 'attention' | 'positive' | 'negative' }> = {
  disconnected: { label: 'Disconnected', tone: 'neutral' },
  pending: { label: 'Waiting for approval', tone: 'attention' },
  ready: { label: 'Connected', tone: 'positive' },
  requires_update: { label: 'Needs reconnecting', tone: 'negative' },
};

const shortDate = (value: string) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });

interface BankConnectionCardProps {
  connection: EnableBankingConnection;
  accounts: Account[];
  onSync: (account?: EnableBankingAccount) => void;
  onReconnect: () => void;
  onDelete: () => void;
  onLink: (account: EnableBankingAccount) => void;
}

const BankConnectionCard: React.FC<BankConnectionCardProps> = ({ connection, accounts, onSync, onReconnect, onDelete, onLink }) => {
  const status = STATUS[connection.status] ?? STATUS.disconnected;
  const name = connection.selectedBank || 'Bank';
  const needsReconnect = connection.status === 'requires_update' || !connection.sessionId;
  const facts = [
    connection.lastSyncedAt ? `Synced ${shortDate(connection.lastSyncedAt)}` : 'Never synced',
    connection.sessionExpiresAt && `Access ends ${shortDate(connection.sessionExpiresAt)}`,
  ].filter(Boolean);

  return (
    <article className="surface-card min-w-0 rounded-[var(--radius-xl)] p-5">
      <header className="flex flex-wrap items-center gap-3">
        <BrandMark name={name} />
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-body-strong truncate text-ink">{name}</h3>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="type-caption mt-0.5 text-muted">{facts.join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2">
          {needsReconnect && <Button size="sm" onPress={onReconnect}>Reconnect</Button>}
          <Button size="sm" variant="secondary" icon="sync" onPress={() => onSync()}>Sync all</Button>
          <Menu
            title={name}
            trigger={<IconButton icon="more_horiz" label={`More for ${name}`} />}
            items={[{ id: 'delete', label: 'Delete connection', icon: 'delete', isDestructive: true, onAction: onDelete }]}
          />
        </div>
      </header>

      {connection.lastError && <Banner tone="error" className="mt-4">The last sync failed: {connection.lastError.slice(0, 200)}</Banner>}

      {connection.accounts.length === 0 ? (
        <p className="type-body mt-4 text-muted">No accounts yet. Sync to fetch them from your bank.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {connection.accounts.map(account => {
            const linked = accounts.find(item => item.id === account.linkedAccountId);
            const lastFour = account.accountNumber?.slice(-4);
            return (
              <li key={account.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1 basis-44">
                  <p className="type-body truncate text-ink">{account.name}{lastFour ? ` ·· ${lastFour}` : ''}</p>
                  {linked
                    ? <p className="type-caption truncate text-muted">Linked to {linked.name}</p>
                    : <Badge tone="attention" className="mt-1">Not linked</Badge>}
                </div>
                <Amount value={account.balance} currency={account.currency} className="type-figure-row text-ink" />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant={linked ? 'ghost' : 'primary'} onPress={() => onLink(account)}>{linked ? 'Edit link' : 'Link'}</Button>
                  <IconButton icon="sync" label={`Sync ${account.name}`} onPress={() => onSync(account)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
};

export default BankConnectionCard;

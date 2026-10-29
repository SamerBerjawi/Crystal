import React, { useMemo, useState } from 'react';
import { formatShortDate } from '../../../../utils/dateFormat';
import { cn } from '../../../../lib/utils';
import type { Account } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import {
  parseBatchMileageInput,
  validateMileageReading,
} from '../../../../utils/accountDetailModel';
import { toLocalISOString } from '../../../../utils';
import { NvIcon } from '../../NvIcon';
import { toast } from '../../toast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Money,
  ProgressBar,
  SegmentedTabs,
} from '../../ui';
import { LicensePlateNew } from '../parts';

/*
 * Archetype 5: Physical Asset & Lease View (`Property`, `Vehicle`).
 * Includes:
 * - Property Equity, LTV, Linked Mortgage & Operating Cashflow / Rental Yield (`BUG-10` fixed)
 * - Vehicle Lease Pro-Rata Mileage Pace (`BUG-11` baseline mileage subtracted)
 * - Vehicle Total Cost of Ownership (`TCO / km`)
 * - Monotonically validated Odometer Mileage Log + Batch Importer
 */

type MileageInputMode = 'single' | 'batch';

export const PhysicalAssetArchetype: React.FC<{
  data: AccountDetailData;
  onOpenValuation: () => void;
  onEditAccount: () => void;
  onNavigateToAccount?: (account: Account) => void;
  /** Overview tab, or the Valuations (& logs) tab. */
  section?: 'overview' | 'valuations';
}> = ({ data, onOpenValuation, onEditAccount, onNavigateToAccount, section = 'overview' }) => {
  const {
    account,
    propertyMetrics,
    propertyCashflow,
    vehicleMetrics,
    vehicleTco,
    enrichedMileageLogs,
    linkedLoan,
    addMileageLogs,
    deleteMileageLog,
  } = data;

  const [mileageMode, setMileageMode] = useState<MileageInputMode>('single');
  const [logDate, setLogDate] = useState(() => toLocalISOString(new Date()));
  const [readingStr, setReadingStr] = useState('');
  const [batchText, setBatchText] = useState('');

  const parsedBatch = useMemo(
    () => (batchText.trim() ? parseBatchMileageInput(batchText) : []),
    [batchText]
  );

  if (!account) return null;

  /* ── Case A: Property Account ─────────────────────────────────────────── */
  if (account.type === 'Property' && section === 'valuations') {
    return <ValuationHistoryCard data={data} onAdd={onOpenValuation} />;
  }

  if (account.type === 'Property' && propertyMetrics && propertyCashflow) {
    const equitySharePct =
      propertyMetrics.currentValue > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round((propertyMetrics.netEquity / propertyMetrics.currentValue) * 100)
            )
          )
        : 100;

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
          {/* Left 6 Cols: Equity vs Mortgage & Valuation History */}
          <Card className="flex flex-col h-full space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  Capital structure & equity
                </h2>
                <p className="text-xs text-nv-muted">
                  {account.propertyType || 'Property'}
                  {account.address ? ` · ${account.address}` : ''}
                </p>
              </div>
              <Button variant="secondary" size="sm" icon="investments" onClick={onOpenValuation}>
                Appraise value
              </Button>
            </div>

            <ProgressBar
              value={equitySharePct}
              tone="green"
              label="Net equity share of market value"
            />

            <div className="grid grid-cols-2 gap-3 rounded-nv-sub bg-nv-surface p-4 text-xs">
              <div>
                <p className="text-nv-muted">Current market valuation</p>
                <div className="mt-0.5">
                  <Money amount={propertyMetrics.currentValue} currency={account.currency} />
                </div>
              </div>
              <div>
                <p className="text-nv-muted">Purchase price</p>
                <div className="mt-0.5">
                  <Money amount={propertyMetrics.purchasePrice} currency={account.currency} />
                </div>
              </div>
              <div>
                <p className="text-nv-muted">Net equity owned</p>
                <div className="mt-0.5">
                  <Money
                    amount={propertyMetrics.netEquity}
                    currency={account.currency}
                    tone="income"
                  />
                </div>
              </div>
              <div>
                <p className="text-nv-muted">
                  Price per m² {account.propertySize ? `(${account.propertySize} m²)` : ''}
                </p>
                <div className="mt-0.5">
                  {propertyMetrics.pricePerSqMeter > 0 ? (
                    <Money
                      amount={propertyMetrics.pricePerSqMeter}
                      currency={account.currency}
                    />
                  ) : (
                    <span className="text-nv-muted">—</span>
                  )}
                </div>
              </div>
            </div>

            {linkedLoan && (
              <button
                type="button"
                onClick={() => onNavigateToAccount?.(linkedLoan)}
                className="flex w-full items-center justify-between rounded-nv-sub bg-nv-surface p-4 text-left transition-colors hover:bg-nv-inset"
              >
                <div className="flex items-center gap-3">
                  <NvIcon name="invoice" size={20} className="text-nv-violet-text" />
                  <div>
                    <p className="text-xs text-nv-muted">
                      Linked Mortgage · LTV {propertyMetrics.ltv.toFixed(1)}%
                    </p>
                    <p className="text-sm font-semibold text-nv-ink">{linkedLoan.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-nv-muted">Remaining principal</p>
                  <Money amount={propertyMetrics.loanBalance} currency={account.currency} />
                </div>
              </button>
            )}
          </Card>

          {/* Right 6 Cols: Operating Cashflow & Rental Yield */}
          <Card className="flex flex-col h-full space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  Holding cashflow & rental yield
                </h2>
              </div>
              {propertyCashflow.grossRentalYieldPct > 0 && (
                <Badge tone="green">
                  {propertyCashflow.grossRentalYieldPct}% Gross · {propertyCashflow.netRentalYieldPct}% Net
                </Badge>
              )}
            </div>

            <div className="space-y-2.5 rounded-nv-sub bg-nv-surface p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Monthly rental income</span>
                <Money
                  amount={propertyCashflow.monthlyRentalIncome}
                  currency={account.currency}
                  tone="income"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Annual property tax</span>
                <Money
                  amount={-propertyCashflow.annualPropertyTax}
                  currency={account.currency}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Annual property insurance</span>
                <Money
                  amount={-propertyCashflow.annualInsurance}
                  currency={account.currency}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Monthly HOA / syndicate</span>
                <Money amount={-propertyCashflow.monthlyHoa} currency={account.currency} />
              </div>
              <div className="h-px bg-nv-line" />
              <div className="flex items-center justify-between font-semibold">
                <span className="text-nv-ink">Net monthly holding cashflow</span>
                <Money
                  amount={propertyCashflow.monthlyNetCashflow}
                  currency={account.currency}
                  signed
                  tone={propertyCashflow.monthlyNetCashflow >= 0 ? 'income' : 'ink'}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-nv-muted">
                <span>Net annual holding cashflow</span>
                <Money
                  amount={propertyCashflow.annualNetCashflow}
                  currency={account.currency}
                  signed
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="secondary" icon="edit" onClick={onEditAccount}>
                Configure property economics
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  /* ── Case B: Vehicle Account (Owned or Leased) ────────────────────────── */
  if (account.type === 'Vehicle' && vehicleMetrics && vehicleTco) {
    const isLeased = account.ownership === 'Leased';
    const leaseStats = vehicleMetrics.leaseStats;
    const ownedStats = vehicleMetrics.ownedStats;

    const handleAddSingleMileage = () => {
      const reading = parseInt(readingStr, 10);
      const validation = validateMileageReading(
        account.mileageLogs || [],
        logDate,
        reading
      );
      if (!validation.valid) {
        toast.error(validation.error || 'Invalid odometer reading');
        return;
      }
      const res = addMileageLogs([{ date: logDate, reading }]);
      if (res?.undo) {
        toast.undo(`Logged ${reading.toLocaleString()} km on ${formatShortDate(logDate)}`, res.undo);
      }
      setReadingStr('');
    };

    const handleImportBatch = () => {
      const validRows = parsedBatch.filter((r) => r.valid);
      if (validRows.length === 0) {
        toast.error('No valid YYYY-MM-DD + reading lines found');
        return;
      }
      const res = addMileageLogs(validRows.map((r) => ({ date: r.date, reading: r.reading })));
      if (!res) return;
      if (res.conflicts.length > 0) {
        // Keep the rejected lines in the box so they can be fixed and imported again.
        setBatchText(res.conflicts.map((c) => `${c.date} ${c.reading}`).join('\n'));
        toast.error(
          `${res.conflicts.length} reading${res.conflicts.length > 1 ? 's' : ''} skipped: ${res.conflicts[0].error}`
        );
        if (res.undo) toast.undo(`Imported ${res.added} odometer readings`, res.undo);
        return;
      }
      if (res.undo) {
        toast.undo(`Imported ${res.added} odometer readings`, res.undo);
      }
      setBatchText('');
      setMileageMode('single');
    };

    const chronologicalLogsDesc = [...enrichedMileageLogs].reverse();

    return (
      <div className="space-y-5">
        {section === 'valuations' && !isLeased && <ValuationHistoryCard data={data} onAdd={onOpenValuation} />}
        {section === 'overview' && (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
          {/* Left 6 Cols: Lease Pace Tracker OR Owned Equity & Depreciation */}
          <Card className="flex flex-col h-full space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  {isLeased ? 'Lease contract & mileage pace' : 'Vehicle valuation & equity'}
                </h2>
                <p className="text-xs text-nv-muted">
                  {[account.year, account.make, account.model].filter(Boolean).join(' ') ||
                    account.name}
                </p>
              </div>
              {account.licensePlate && (
                <LicensePlateNew
                  plate={account.licensePlate}
                  countryCode={account.registrationCountryCode}
                />
              )}
            </div>

            {isLeased && leaseStats ? (
              <div className="space-y-4">
                <div className="space-y-1.5 rounded-nv-sub bg-nv-surface p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-nv-ink">
                      Lease Term Elapsed ({leaseStats.daysRemaining}d remaining)
                    </span>
                    <Badge
                      tone={
                        leaseStats.mileageStatus === 'Over Budget' ? 'orange' : 'green'
                      }
                    >
                      {leaseStats.mileageStatus}
                    </Badge>
                  </div>
                  <ProgressBar
                    value={leaseStats.timeProgress}
                    tone="violet"
                    label="Lease term progress"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-nv-sub bg-nv-surface p-4 text-xs">
                  <div>
                    <p className="text-nv-muted">Driven during lease</p>
                    <p className="nv-tabular mt-0.5 text-base font-semibold text-nv-ink">
                      {Math.round(leaseStats.leaseDrivenMileage).toLocaleString()} km
                    </p>
                  </div>
                  <div>
                    <p className="text-nv-muted">Pro-rata expected today</p>
                    <p className="nv-tabular mt-0.5 text-base font-semibold text-nv-ink">
                      {Math.round(leaseStats.proRataExpectedMileage).toLocaleString()} km
                    </p>
                  </div>
                  <div>
                    <p className="text-nv-muted">Total contract allowance</p>
                    <p className="nv-tabular mt-0.5 text-base font-semibold text-nv-ink">
                      {Math.round(leaseStats.totalMileageAllowance).toLocaleString()} km
                    </p>
                  </div>
                  <div>
                    <p className="text-nv-muted">Pace variance</p>
                    <p
                      className={cn(
                        'nv-tabular mt-0.5 text-base font-semibold',
                        leaseStats.mileageDiff > 0 ? 'text-nv-orange-text' : 'text-nv-green-text'
                      )}
                    >
                      {leaseStats.mileageDiff > 0 ? '+' : ''}
                      {Math.round(leaseStats.mileageDiff).toLocaleString()} km
                    </p>
                  </div>
                </div>
              </div>
            ) : ownedStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-nv-sub bg-nv-surface p-4 text-xs">
                  <div>
                    <p className="text-nv-muted">Current market value</p>
                    <div className="mt-0.5">
                      <Money amount={ownedStats.currentValue} currency={account.currency} />
                    </div>
                  </div>
                  <div>
                    <p className="text-nv-muted">Purchase price</p>
                    <div className="mt-0.5">
                      <Money amount={ownedStats.purchasePrice} currency={account.currency} />
                    </div>
                  </div>
                  <div>
                    <p className="text-nv-muted">Depreciation / change</p>
                    <div className="mt-0.5">
                      <Money
                        amount={ownedStats.depreciation}
                        currency={account.currency}
                        signed
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-nv-muted">Net vehicle equity</p>
                    <div className="mt-0.5">
                      <Money
                        amount={ownedStats.netEquity}
                        currency={account.currency}
                        tone="income"
                      />
                    </div>
                  </div>
                </div>

                {linkedLoan && (
                  <button
                    type="button"
                    onClick={() => onNavigateToAccount?.(linkedLoan)}
                    className="flex w-full items-center justify-between rounded-nv-sub bg-nv-surface p-4 text-left transition-colors hover:bg-nv-inset"
                  >
                    <div className="flex items-center gap-3">
                      <NvIcon name="invoice" size={18} className="text-nv-violet-text" />
                      <div>
                        <p className="text-xs text-nv-muted">Linked auto loan</p>
                        <p className="text-sm font-semibold text-nv-ink">{linkedLoan.name}</p>
                      </div>
                    </div>
                    <Money amount={ownedStats.loanBalance} currency={account.currency} />
                  </button>
                )}
              </div>
            ) : null}
          </Card>

          {/* Right 6 Cols: Total Cost of Ownership (TCO / km) */}
          <Card className="flex flex-col h-full space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  Total cost of ownership (TCO)
                </h2>
              </div>
              {vehicleTco.costPerKm !== null && (
                <Badge tone="violet">
                  <Money amount={vehicleTco.costPerKm} currency={account.currency} /> / km
                </Badge>
              )}
            </div>

            <div className="space-y-2.5 rounded-nv-sub bg-nv-surface p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Fuel & EV charging</span>
                <Money amount={vehicleTco.fuelSpend} currency={account.currency} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Maintenance, tires & service</span>
                <Money amount={vehicleTco.maintenanceSpend} currency={account.currency} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Insurance, tax & registration</span>
                <Money amount={vehicleTco.insuranceTaxSpend} currency={account.currency} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Capital depreciation</span>
                <Money amount={vehicleTco.depreciation} currency={account.currency} />
              </div>
              <div className="h-px bg-nv-line" />
              <div className="flex items-center justify-between font-semibold">
                <span className="text-nv-ink">All-in total cost of ownership</span>
                <Money
                  amount={vehicleTco.totalCostOfOwnership}
                  currency={account.currency}
                />
              </div>
            </div>
          </Card>
        </div>
        )}

        {/* Odometer Mileage Log & Batch Importer */}
        {section === 'valuations' && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                Odometer Mileage Log ({enrichedMileageLogs.length})
              </h2>
            </div>
            <SegmentedTabs<MileageInputMode>
              label="Mileage entry mode"
              size="sm"
              value={mileageMode}
              onChange={setMileageMode}
              items={[
                { id: 'single', label: 'Single reading' },
                { id: 'batch', label: 'Batch import' },
              ]}
            />
          </div>

          {mileageMode === 'single' ? (
            <div className="flex flex-wrap items-end gap-3 rounded-nv-sub bg-nv-surface p-4">
              <div className="min-w-40 flex-1">
                <label className="mb-1 block text-xs font-medium text-nv-muted">
                  Reading date
                </label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="h-10 w-full rounded-nv-control border border-nv-line bg-nv-inset px-3 text-sm text-nv-ink outline-none focus:border-nv-violet"
                />
              </div>
              <div className="min-w-44 flex-1">
                <label className="mb-1 block text-xs font-medium text-nv-muted">
                  Odometer reading (km)
                </label>
                <input
                  type="number"
                  value={readingStr}
                  onChange={(e) => setReadingStr(e.target.value)}
                  placeholder="e.g. 24500"
                  className="h-10 w-full rounded-nv-control border border-nv-line bg-nv-inset px-3 text-sm text-nv-ink outline-none focus:border-nv-violet"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                icon="add"
                onClick={handleAddSingleMileage}
                disabled={!readingStr.trim()}
              >
                Log odometer
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">
                Paste one reading per line in <code>YYYY-MM-DD, reading</code> format (e.g.{' '}
                <code>2026-03-01, 14200</code>)
              </p>
              <textarea
                rows={4}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={'2026-01-15, 12000\n2026-02-15, 13450'}
                className="w-full rounded-nv-control border border-nv-line bg-nv-inset p-3 font-mono text-xs text-nv-ink outline-none focus:border-nv-violet"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-nv-muted">
                  {parsedBatch.filter((r) => r.valid).length} valid / {parsedBatch.length} lines
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleImportBatch}
                  disabled={parsedBatch.filter((r) => r.valid).length === 0}
                >
                  Import readings
                </Button>
              </div>
            </div>
          )}

          {chronologicalLogsDesc.length === 0 ? (
            <EmptyState
              icon="pin"
              title="No odometer readings yet"
              body="Log your initial and current odometer readings to track km/day pace and cost per km."
            />
          ) : (
            <div className="divide-y divide-nv-line rounded-nv-sub bg-nv-surface px-4">
              {chronologicalLogsDesc.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <span className="nv-tabular font-semibold text-nv-ink">
                      {log.reading.toLocaleString()} km
                    </span>
                    <span className="ml-2 text-xs text-nv-muted">on {formatShortDate(log.date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.deltaKm > 0 && (
                      <span className="nv-tabular text-xs text-nv-muted">
                        +{log.deltaKm.toLocaleString()} km ({log.kmPerDay} km/d)
                      </span>
                    )}
                    <IconButton
                      icon="delete"
                      label={`Delete reading on ${formatShortDate(log.date)}`}
                      size={44}
                      tone="plain"
                      onClick={() => {
                        const res = deleteMileageLog(log.id);
                        if (res?.undo) {
                          toast.undo(`Deleted reading from ${formatShortDate(log.date)}`, res.undo);
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        )}
      </div>
    );
  }

  return null;
};

/* ── Valuation history (Valuations tab, property and owned vehicles) ─────── */

const ValuationHistoryCard: React.FC<{ data: AccountDetailData; onAdd: () => void }> = ({ data, onAdd }) => {
  const { account, deleteValuation } = data;
  const entries = useMemo(
    () => [...(account?.priceHistory || [])].sort((a, b) => b.date.localeCompare(a.date)),
    [account?.priceHistory]
  );
  if (!account) return null;
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-nv-ink">Valuation history</h2>
        <Button variant="primary" size="sm" icon="add" onClick={onAdd}>
          Add valuation
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-nv-sub bg-nv-surface p-4 text-sm text-nv-muted">No valuations yet.</p>
      ) : (
        <div className="divide-y divide-nv-line rounded-nv-sub bg-nv-surface px-4">
          {entries.map((entry, i) => {
            const previous = entries[i + 1];
            const change = previous ? entry.price - previous.price : null;
            return (
              <div key={entry.date} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-nv-ink">{formatShortDate(entry.date)}</p>
                  {change !== null && (
                    <p className="text-xs text-nv-muted">
                      <Money amount={change} currency={account.currency} signed tone={change >= 0 ? 'income' : 'ink'} /> vs previous
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Money amount={entry.price} currency={account.currency} />
                  <IconButton
                    icon="delete"
                    label={`Delete valuation from ${formatShortDate(entry.date)}`}
                    size={44}
                    tone="plain"
                    onClick={() => {
                      const res = deleteValuation(entry.date);
                      if (res?.undo) toast.undo(`Removed valuation on ${formatShortDate(entry.date)}`, res.undo);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

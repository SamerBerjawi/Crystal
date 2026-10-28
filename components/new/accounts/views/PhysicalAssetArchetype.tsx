import React, { useMemo, useState } from 'react';
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
}> = ({ data, onOpenValuation, onEditAccount, onNavigateToAccount }) => {
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left 6 Cols: Equity vs Mortgage & Valuation History */}
          <Card className="space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  Capital Structure & Equity
                </h2>
                <p className="text-xs text-nv-muted">
                  {account.propertyType || 'Property'}
                  {account.address ? ` · ${account.address}` : ''}
                </p>
              </div>
              <Button variant="secondary" size="sm" icon="investments" onClick={onOpenValuation}>
                Appraise Value
              </Button>
            </div>

            <ProgressBar
              value={equitySharePct}
              tone="green"
              label="Net equity share of market value"
            />

            <div className="grid grid-cols-2 gap-3 rounded-nv-sub bg-nv-surface p-4 text-xs">
              <div>
                <p className="text-nv-muted">Current Market Valuation</p>
                <div className="mt-0.5">
                  <Money amount={propertyMetrics.currentValue} currency={account.currency} />
                </div>
              </div>
              <div>
                <p className="text-nv-muted">Purchase Price</p>
                <div className="mt-0.5">
                  <Money amount={propertyMetrics.purchasePrice} currency={account.currency} />
                </div>
              </div>
              <div>
                <p className="text-nv-muted">Net Equity Owned</p>
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
                  <p className="text-[11px] text-nv-muted">Remaining Principal</p>
                  <Money amount={propertyMetrics.loanBalance} currency={account.currency} />
                </div>
              </button>
            )}
          </Card>

          {/* Right 6 Cols: Operating Cashflow & Rental Yield */}
          <Card className="space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  Holding Cashflow & Rental Yield
                </h2>
                <p className="text-xs text-nv-muted">
                  Recurring rental income vs property tax, insurance & HOA costs
                </p>
              </div>
              {propertyCashflow.grossRentalYieldPct > 0 && (
                <Badge tone="green">
                  {propertyCashflow.grossRentalYieldPct}% Gross · {propertyCashflow.netRentalYieldPct}% Net
                </Badge>
              )}
            </div>

            <div className="space-y-2.5 rounded-nv-sub bg-nv-surface p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Monthly Rental Income</span>
                <Money
                  amount={propertyCashflow.monthlyRentalIncome}
                  currency={account.currency}
                  tone="income"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Annual Property Tax</span>
                <Money
                  amount={-propertyCashflow.annualPropertyTax}
                  currency={account.currency}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Annual Property Insurance</span>
                <Money
                  amount={-propertyCashflow.annualInsurance}
                  currency={account.currency}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Monthly HOA / Syndicate</span>
                <Money amount={-propertyCashflow.monthlyHoa} currency={account.currency} />
              </div>
              <div className="h-px bg-nv-line" />
              <div className="flex items-center justify-between font-semibold">
                <span className="text-nv-ink">Net Monthly Holding Cashflow</span>
                <Money
                  amount={propertyCashflow.monthlyNetCashflow}
                  currency={account.currency}
                  signed
                  tone={propertyCashflow.monthlyNetCashflow >= 0 ? 'income' : 'ink'}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-nv-muted">
                <span>Net Annual Holding Cashflow</span>
                <Money
                  amount={propertyCashflow.annualNetCashflow}
                  currency={account.currency}
                  signed
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="secondary" icon="edit" onClick={onEditAccount}>
                Configure Property Economics
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
        toast.undo(`Logged ${reading.toLocaleString()} km on ${logDate}`, res.undo);
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
      if (res?.undo) {
        toast.undo(`Imported ${validRows.length} odometer readings`, res.undo);
      }
      setBatchText('');
      setMileageMode('single');
    };

    const chronologicalLogsDesc = [...enrichedMileageLogs].reverse();

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left 6 Cols: Lease Pace Tracker OR Owned Equity & Depreciation */}
          <Card className="space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  {isLeased ? 'Lease Contract & Mileage Pace' : 'Vehicle Valuation & Equity'}
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
                    <p className="text-nv-muted">Driven During Lease</p>
                    <p className="nv-tabular mt-0.5 text-base font-semibold text-nv-ink">
                      {Math.round(leaseStats.leaseDrivenMileage).toLocaleString()} km
                    </p>
                  </div>
                  <div>
                    <p className="text-nv-muted">Pro-Rata Expected Today</p>
                    <p className="nv-tabular mt-0.5 text-base font-semibold text-nv-ink">
                      {Math.round(leaseStats.proRataExpectedMileage).toLocaleString()} km
                    </p>
                  </div>
                  <div>
                    <p className="text-nv-muted">Total Contract Allowance</p>
                    <p className="nv-tabular mt-0.5 text-base font-semibold text-nv-ink">
                      {Math.round(leaseStats.totalMileageAllowance).toLocaleString()} km
                    </p>
                  </div>
                  <div>
                    <p className="text-nv-muted">Pace Variance</p>
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
                    <p className="text-nv-muted">Current Market Value</p>
                    <div className="mt-0.5">
                      <Money amount={ownedStats.currentValue} currency={account.currency} />
                    </div>
                  </div>
                  <div>
                    <p className="text-nv-muted">Purchase Price</p>
                    <div className="mt-0.5">
                      <Money amount={ownedStats.purchasePrice} currency={account.currency} />
                    </div>
                  </div>
                  <div>
                    <p className="text-nv-muted">Depreciation / Change</p>
                    <div className="mt-0.5">
                      <Money
                        amount={ownedStats.depreciation}
                        currency={account.currency}
                        signed
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-nv-muted">Net Vehicle Equity</p>
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
                        <p className="text-xs text-nv-muted">Linked Auto Loan</p>
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
          <Card className="space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  Total Cost of Ownership (TCO)
                </h2>
                <p className="text-xs text-nv-muted">
                  Operating expenses + depreciation across {vehicleTco.distanceTrackedKm.toLocaleString()} tracked km
                </p>
              </div>
              {vehicleTco.costPerKm !== null && (
                <Badge tone="violet">
                  <Money amount={vehicleTco.costPerKm} currency={account.currency} /> / km
                </Badge>
              )}
            </div>

            <div className="space-y-2.5 rounded-nv-sub bg-nv-surface p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Fuel & EV Charging</span>
                <Money amount={vehicleTco.fuelSpend} currency={account.currency} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Maintenance, Tires & Service</span>
                <Money amount={vehicleTco.maintenanceSpend} currency={account.currency} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Insurance, Tax & Registration</span>
                <Money amount={vehicleTco.insuranceTaxSpend} currency={account.currency} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-nv-muted">Capital Depreciation</span>
                <Money amount={vehicleTco.depreciation} currency={account.currency} />
              </div>
              <div className="h-px bg-nv-line" />
              <div className="flex items-center justify-between font-semibold">
                <span className="text-nv-ink">All-In Total Cost of Ownership</span>
                <Money
                  amount={vehicleTco.totalCostOfOwnership}
                  currency={account.currency}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Odometer Mileage Log & Batch Importer */}
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                Odometer Mileage Log ({enrichedMileageLogs.length})
              </h2>
              <p className="text-xs text-nv-muted">
                Chronologically validated odometer readings with daily pace (km/day)
              </p>
            </div>
            <SegmentedTabs<MileageInputMode>
              label="Mileage entry mode"
              size="sm"
              value={mileageMode}
              onChange={setMileageMode}
              items={[
                { id: 'single', label: 'Single Reading' },
                { id: 'batch', label: 'Batch Import' },
              ]}
            />
          </div>

          {mileageMode === 'single' ? (
            <div className="flex flex-wrap items-end gap-3 rounded-nv-sub bg-nv-surface p-4">
              <div className="min-w-40 flex-1">
                <label className="mb-1 block text-xs font-medium text-nv-muted">
                  Reading Date
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
                  Odometer Reading (km)
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
                variant="cta"
                size="sm"
                icon="add"
                onClick={handleAddSingleMileage}
                disabled={!readingStr.trim()}
              >
                Log Odometer
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
                  variant="cta"
                  size="sm"
                  onClick={handleImportBatch}
                  disabled={parsedBatch.filter((r) => r.valid).length === 0}
                >
                  Import Readings
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
                    <span className="ml-2 text-xs text-nv-muted">on {log.date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.deltaKm > 0 && (
                      <span className="nv-tabular text-xs text-nv-muted">
                        +{log.deltaKm.toLocaleString()} km ({log.kmPerDay} km/d)
                      </span>
                    )}
                    <IconButton
                      icon="delete"
                      label={`Delete reading on ${log.date}`}
                      size={32}
                      tone="plain"
                      onClick={() => {
                        const res = deleteMileageLog(log.id);
                        if (res?.undo) {
                          toast.undo(`Deleted reading from ${log.date}`, res.undo);
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return null;
};

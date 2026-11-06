import React, { useMemo } from 'react';
import type { Account, Transaction } from '../../types';
import { calculateTrendLine, convertCurrency, flattenCategories, generateAmortizationSchedule, parseLocalDate, safeAdd, safeRound } from '../../utils';
import { computePropertyAccountMetrics, computeVehicleAccountMetrics } from '../../utils/accountDetailModel';
import { loansForAsset } from '../../utils/accountLinks';
import { isoDay, isoMonth, monthsBetween, rentRoll, splitByLabel, toggleVacantMonth, valueTrendPerYear, yearlyOwnershipCosts, type RentMonth } from '../../utils/accountPagesModel';
import { CAR_MAKE_DOMAINS, LicensePlate } from '../LicensePlate';
import VehicleMileageChart from '../VehicleMileageChart';
import { Button, IconButton } from '../ui/Actions';
import { Badge, Row } from '../ui/Display';
import { Amount } from '../ui/Money';
import { StatGauge } from '../ui/StatGauge';
import { EmptyState } from '../ui/States';
import { usePreferencesSelector } from '../../contexts/DomainProviders';
import { buildEffectiveMerchantLogoOverrides, getMerchantLogoUrl } from '../../utils/brandfetch';
import { cn } from '../../lib/utils';
import AccountShell from './AccountShell';
import { Bars, Donut, Figures, Section, ShareBar, TimeSeries } from './charts';
import { activityTab, closureBanner, day, detailsTab, Grid2, money, pct, shortDay, valuationActions, type AccountPanelProps } from './pageKit';
import { useAccountPage } from './useAccountPage';

/** A value known on given days, as a step series by month from the first known day to today. */
const monthlyValueSeries = (points: { date: string; value: number }[], today = new Date()) => {
  const sorted = [...points].filter(point => point.date).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];
  const first = parseLocalDate(sorted[0].date);
  const months = monthsBetween(first, today) + 1;
  const rows: { date: Date; value: number }[] = [];
  for (let index = 0; index <= months; index++) {
    const date = index === months ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : new Date(first.getFullYear(), first.getMonth() + index, 1);
    const iso = isoDay(date);
    const known = sorted.filter(point => point.date <= iso).at(-1);
    if (known) rows.push({ date, value: known.value });
  }
  return rows;
};

/** Money tied to this asset with the transaction's "For a property or vehicle" field, in the asset's currency. */
const useAssetMoney = (account: Account, transactions: Transaction[], rates: Record<string, number> | undefined, categories: AccountPanelProps['categories']) =>
  useMemo(() => {
    const flat = flattenCategories(categories);
    const label = (value: string) => {
      const match = flat.find(item => item.id === value || item.name.toLowerCase() === (value || '').toLowerCase());
      const parent = match?.parentId ? flat.find(item => item.id === match.parentId) : undefined;
      return (parent ?? match)?.name ?? (value || 'Other');
    };
    const linked = transactions.filter(tx => tx.assetId === account.id && !tx.isSplitParent && !tx.isCombinedParent);
    const toOwn = (tx: Transaction) => convertCurrency(tx.amount, tx.currency || account.currency, account.currency, rates);
    const income = linked.filter(tx => toOwn(tx) > 0).map(tx => ({ date: tx.date, amount: toOwn(tx) }));
    const costs = linked.filter(tx => toOwn(tx) < 0).map(tx => ({ date: tx.date, amount: toOwn(tx), label: label(tx.category), tx }));
    const yearAgo = isoDay(new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()));
    const costs12 = costs.filter(item => item.date > yearAgo);
    return {
      linked,
      income,
      costs,
      costsTotal: costs.reduce((sum, item) => safeAdd(sum, -item.amount), 0),
      costs12Total: costs12.reduce((sum, item) => safeAdd(sum, -item.amount), 0),
      costsByCategory: splitByLabel(costs12.map(item => ({ label: item.label, amount: item.amount })), 6),
      incomeTotal: income.reduce((sum, item) => safeAdd(sum, item.amount), 0),
    };
  }, [account.id, account.currency, transactions, rates, categories]);

/** Twelve months of rent: received against expected, and a switch per month to mark it empty. */
const RentRollTable: React.FC<{ account: Account; months: RentMonth[]; onToggle?: (month: string) => void }> = ({ account, months, onToggle }) => (
  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
    {months.map(month => {
      const status = month.vacant ? 'Empty' : month.received + 0.5 >= month.expected && month.expected > 0 ? 'Paid' : month.received > 0 ? 'Part paid' : month.month === isoMonth(new Date()) ? 'Due' : 'Missing';
      return (
        <li key={month.month} className={cn('rounded-[var(--radius-md)] border border-line p-3', month.vacant && 'bg-inset')}>
          <div className="flex items-center justify-between gap-2">
            <span className="type-body-strong text-ink">{month.name} {month.month.slice(2, 4)}</span>
            <Badge tone={status === 'Paid' ? 'positive' : status === 'Empty' ? 'neutral' : status === 'Due' ? 'attention' : 'negative'}>{status}</Badge>
          </div>
          <p className="type-caption mt-1 text-muted"><Amount value={month.received} currency={account.currency} /> of <Amount value={month.expected} currency={account.currency} /></p>
          {onToggle && (
            <button type="button" onClick={() => onToggle(month.month)} className="type-caption mt-1 cursor-pointer font-bold text-primary hover:underline">
              {month.vacant ? 'Mark as let' : 'Mark as empty'}
            </button>
          )}
        </li>
      );
    })}
  </ul>
);

/** Property: value against the mortgage, equity and LTV, the cost of owning it and, for a rental, the rent roll. */
export const PropertyLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const isClosed = account.status === 'closed';
  const metrics = computePropertyAccountMetrics(account, page.accounts, props.transactions, props.loanOverrides, { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments });
  const loans = useMemo(() => loansForAsset(account, page.accounts), [account, page.accounts]);
  const loan = loans[0];
  const assetMoney = useAssetMoney(account, page.transactions, page.conversionRates, props.categories);
  const roll = useMemo(() => rentRoll(account, assetMoney.income, 12), [account, assetMoney.income]);
  // A stored cost that also has payments marked for this property counts once, at what was paid.
  const paidLabels = new Set(assetMoney.costsByCategory.map(item => item.label.toLowerCase()));
  const storedCosts = yearlyOwnershipCosts(account).filter(item => !paidLabels.has(item.label.toLowerCase()));
  const storedYearly = storedCosts.reduce((sum, item) => sum + item.yearly, 0);
  const value = metrics.currentMarketValue;
  const monthlyRent = account.rentalIncomeAmount ? roll.expected / Math.max(1, roll.months.length - roll.vacantCount) : 0;
  const grossYield = value > 0 && account.isRental ? ((monthlyRent * 12) / value) * 100 : 0;
  const yearAgo = isoDay(new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()));
  const rent12 = assetMoney.income.filter(item => item.date > yearAgo).reduce((sum, item) => sum + item.amount, 0);
  const netYield = value > 0 && account.isRental ? ((rent12 - storedYearly - assetMoney.costs12Total) / value) * 100 : 0;

  const loanSchedule = useMemo(() => (loan ? generateAmortizationSchedule(loan, props.transactions, props.loanOverrides[loan.id] || {}) : []), [loan, props.transactions, props.loanOverrides]);
  const interestPaid = loanSchedule.filter(item => item.status === 'Paid').reduce((sum, item) => sum + item.interest, 0);

  const valueChart = useMemo(() => {
    const known = [
      ...(account.purchaseDate && (account.purchasePrice || metrics.purchasePrice) ? [{ date: account.purchaseDate, value: account.purchasePrice || metrics.purchasePrice }] : []),
      ...(account.priceHistory || []).map(item => ({ date: item.date, value: item.price })),
    ];
    if (known.length === 0) known.push({ date: isoDay(new Date()), value });
    const steps = monthlyValueSeries(known);
    if (steps.length) steps[steps.length - 1].value = value;
    const rows = steps.map(step => {
      const iso = isoDay(step.date);
      let debt: number | undefined;
      if (loan && loanSchedule.length) {
        const start = loan.loanStartDate || loanSchedule[0].date;
        if (iso >= start) {
          const before = loanSchedule.filter(item => item.date <= iso).at(-1);
          debt = convertCurrency(before ? before.outstandingBalance : loan.principalAmount || 0, loan.currency, account.currency, page.conversionRates);
        }
      }
      return { date: step.date, value: step.value, debt, equity: debt !== undefined ? safeRound(step.value - debt, 2) : step.value };
    });
    return rows;
  }, [account.purchaseDate, account.purchasePrice, account.priceHistory, metrics.purchasePrice, value, loan, loanSchedule, account.currency, page.conversionRates]);

  const returnFigures = {
    gains: value + assetMoney.incomeTotal,
    costs: metrics.purchasePrice + assetMoney.costsTotal + convertCurrency(interestPaid, loan?.currency ?? account.currency, account.currency, page.conversionRates),
  };
  const features = [
    account.hasBasement && 'Basement',
    account.hasAttic && 'Attic',
    account.hasGarden && `Garden${account.gardenSize ? `, ${account.gardenSize} m²` : ''}`,
    account.hasTerrace && `Terrace${account.terraceSize ? `, ${account.terraceSize} m²` : ''}`,
    account.indoorParkingSpaces && `Indoor parking, ${account.indoorParkingSpaces}`,
    account.outdoorParkingSpaces && `Outdoor parking, ${account.outdoorParkingSpaces}`,
  ].filter(Boolean);
  const toggleMonth = props.onSaveAccount && !isClosed ? (month: string) => props.onSaveAccount!({ ...account, vacantMonths: toggleVacantMonth(account.vacantMonths, month) }) : undefined;
  const ltv = metrics.ltv || (value > 0 ? (metrics.outstandingLoanBalance / value) * 100 : 0);

  return (
    <AccountShell
      account={account}
      context={`${account.propertyType || 'Property'}${account.isRental ? ', rental' : ''}${account.address ? `, ${account.address}` : ''}`}
      value={value}
      valueLabel="Estimated value"
      heroNote={<><Amount value={metrics.appreciation} currency={account.currency} /> ({metrics.appreciationPercent >= 0 ? '+' : '−'}{Math.abs(metrics.appreciationPercent).toFixed(1)}%) since you bought it</>}
      banner={closureBanner(account, 'Sold or closed:', page.accounts, props.onOpenAccount)}
      kpis={[
        { label: 'Equity', value: money(metrics.marketEquity, account) },
        { label: 'Mortgage', value: loan ? money(metrics.outstandingLoanBalance, account) : 'None' },
        { label: 'Loan to value', value: loan ? pct(ltv, 1) : '—', visual: loan ? <ShareBar value={ltv} label="Loan to value" onHero /> : undefined },
        account.isRental ? { label: 'Occupancy', value: pct(roll.occupancy), context: `Gross yield ${pct(grossYield, 1)}` } : { label: 'Price per m²', value: metrics.pricePerSqMeter ? money(metrics.pricePerSqMeter, account) : '—' },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={!isClosed ? { id: 'value', label: 'Update value', icon: 'pencil-edit-02', onPress: props.onUpdateValuation } : undefined}
      actions={valuationActions(props, 'Record sale')}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <Section title="Value and mortgage" subtitle={loan ? 'The gap between the two lines is your equity' : 'From the purchase price and your valuations'}>
                <TimeSeries
                  data={valueChart}
                  series={[
                    { key: 'value', label: 'Value', color: 'var(--chart-1)' },
                    ...(loan ? [{ key: 'debt', label: 'Mortgage', color: 'var(--chart-4)' }, { key: 'equity', label: 'Equity', color: 'var(--money-in)', dashed: true, width: 1.5 }] : []),
                  ]}
                  currency={account.currency}
                  markers={account.purchaseDate ? [{ date: parseLocalDate(account.purchaseDate), title: 'Bought', color: 'var(--muted)' }] : undefined}
                />
              </Section>
              <Grid2>
                <Section title="Mortgage" subtitle={loan ? undefined : 'Link a loan to this property in its Edit form'}>
                  {loan ? (
                    <div className="flex items-center gap-5">
                      <StatGauge fill={ltv} tone={ltv > 90 ? 'loss' : ltv > 75 ? 'amber' : 'pine'} display={pct(ltv)} caption="loan to value" label="Loan to value" size={120} />
                      <div className="min-w-0 flex-1 space-y-3">
                        <Figures items={[
                          { label: 'Owed', value: money(metrics.outstandingLoanBalance, account) },
                          { label: 'Rate', value: loan.interestRate != null ? `${loan.interestRate}%` : '—' },
                          { label: 'Each month', value: loan.monthlyPayment ? money(loan.monthlyPayment, loan) : '—' },
                        ]} />
                        <Button variant="secondary" size="sm" icon="arrow-right-01" onPress={() => props.onOpenAccount(loan.id)}>Open {loan.name}</Button>
                      </div>
                    </div>
                  ) : <p className="type-body text-muted">No mortgage linked. Owned outright, or not linked yet.</p>}
                </Section>
                <Section title="Cost of owning" subtitle="Stored yearly costs, plus payments marked for this property in the last 12 months">
                  {storedYearly + assetMoney.costs12Total > 0 ? (
                    <Donut
                      centerLabel="A year"
                      currency={account.currency}
                      items={[
                        ...storedCosts.map(item => ({ label: item.label, value: item.yearly })),
                        ...assetMoney.costsByCategory.map(item => ({ label: item.label, value: item.value })),
                      ]}
                    />
                  ) : <p className="type-body text-muted">No costs yet. Add property tax, insurance or fees in Edit, or mark a payment for this property in its transaction.</p>}
                  {(account.propertyTaxDate || account.insurancePaymentDate) && (
                    <p className="type-caption mt-3 text-muted">
                      {account.propertyTaxDate && <>Property tax due {shortDay(account.propertyTaxDate)}. </>}
                      {account.insurancePaymentDate && <>Insurance due {shortDay(account.insurancePaymentDate)}{account.insuranceProvider ? ` with ${account.insuranceProvider}` : ''}.</>}
                    </p>
                  )}
                </Section>
              </Grid2>
              {account.isRental && (
                <Section
                  title="Rent roll"
                  subtitle="Rent received is income marked for this property. Mark a month empty when no one lived there"
                  action={<span className="type-caption text-right text-muted">Occupancy<br /><span className="type-figure-row text-ink">{pct(roll.occupancy)}</span></span>}
                >
                  <Figures className="mb-4" items={[
                    { label: 'Received, 12 months', value: money(roll.received, account) },
                    { label: 'Expected', value: money(roll.expected, account), note: `${roll.vacantCount} empty ${roll.vacantCount === 1 ? 'month' : 'months'}` },
                    { label: 'Net yield', value: pct(netYield, 1), note: `Gross ${pct(grossYield, 1)}` },
                  ]} />
                  <Bars data={roll.months as unknown as Record<string, unknown>[]} bars={[{ key: 'expected', label: 'Expected', color: 'var(--line-strong)' }, { key: 'received', label: 'Received', color: 'var(--money-in)' }]} currency={account.currency} height="h-[200px]" />
                  <div className="mt-4"><RentRollTable account={account} months={[...roll.months].reverse()} onToggle={toggleMonth} /></div>
                </Section>
              )}
              <Section title="Return" subtitle="What it's worth plus rent received, against what it has cost">
                <Figures items={[
                  { label: 'Value and rent', value: money(returnFigures.gains, account) },
                  { label: 'Price, costs, interest', value: money(returnFigures.costs, account) },
                  { label: 'Net', value: money(returnFigures.gains - returnFigures.costs, account, 'flow') },
                ]} />
              </Section>
            </>
          ),
        },
        {
          id: 'valuations',
          label: 'Valuations',
          content: (account.priceHistory?.length ?? 0) > 0 ? (
            <Section title="Valuations">
              <ul className="divide-y divide-line">
                {[...(account.priceHistory || [])].reverse().map(item => <li key={item.date}><Row title={day(item.date)} trailing={money(item.price, account)} /></li>)}
              </ul>
            </Section>
          ) : <EmptyState icon="chart-line-data-01" title="No valuations yet" description="Add one to start the value line." actionLabel={isClosed ? undefined : 'Update value'} onAction={props.onUpdateValuation} />,
        },
        { ...activityTab(props), content: <>{activityTab(props).content}{assetMoney.linked.length > 0 && <p className="type-caption text-muted">{assetMoney.linked.length} payments elsewhere are marked for this property and count in its costs and rent.</p>}</> },
        detailsTab([
          { label: 'Address', value: account.address, copy: account.address },
          { label: 'Type', value: account.propertyType },
          { label: 'Size', value: account.propertySize ? `${account.propertySize} m²` : undefined },
          { label: 'Year built', value: account.yearBuilt },
          { label: 'Floors', value: account.floors },
          { label: 'Bedrooms and bathrooms', value: account.bedrooms || account.bathrooms ? `${account.bedrooms || 0} and ${account.bathrooms || 0}` : undefined },
          { label: 'Features', value: features.join(', ') },
          { label: 'Bought', value: day(account.purchaseDate) },
          { label: 'Price paid', value: metrics.purchasePrice ? money(metrics.purchasePrice, account) : undefined },
          { label: 'Rent', value: account.isRental && account.rentalIncomeAmount ? <>{money(account.rentalIncomeAmount, account)} {account.rentalIncomeFrequency || 'monthly'}</> : undefined },
          { label: 'Insurer', value: account.insuranceProvider },
          { label: 'Policy', value: account.insurancePolicyNumber, copy: account.insurancePolicyNumber },
          { label: 'Currency', value: account.currency },
        ]),
      ]}
    />
  );
};

/** Vehicles: value and its trend, mileage against the lease, running costs per km, and any car loan. */
export const VehicleLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const isClosed = account.status === 'closed';
  const isLeased = account.ownership === 'Leased';
  const metrics = useMemo(
    () => computeVehicleAccountMetrics(account, page.accounts, props.transactions, props.loanOverrides, { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, page.accounts, props.transactions, props.loanOverrides, page.conversionRates, props.showBalanceAdjustments]
  );
  const assetMoney = useAssetMoney(account, page.transactions, page.conversionRates, props.categories);
  const loan = loansForAsset(account, page.accounts)[0];
  const purchasePrice = account.purchasePrice || 0;
  const trend = valueTrendPerYear([
    ...(account.purchaseDate && purchasePrice ? [{ date: account.purchaseDate, price: purchasePrice }] : []),
    ...(account.priceHistory || []),
  ]);
  const ownedFor = account.purchaseDate ? Math.max(1, monthsBetween(parseLocalDate(account.purchaseDate), new Date())) : 0;
  const depreciation = purchasePrice ? purchasePrice - account.balance : 0;
  const perYearPct = purchasePrice && ownedFor ? (depreciation / purchasePrice / (ownedFor / 12)) * 100 : 0;
  const logs = metrics.sortedMileageLogs;
  const firstLog = logs[0];
  const kmDriven = firstLog ? metrics.currentMileage - firstLog.reading : 0;
  const costTotal = assetMoney.costsTotal + (purchasePrice ? Math.max(0, depreciation) : 0);
  const costPerKm = kmDriven > 0 ? costTotal / kmDriven : null;
  const kmPerMonth = firstLog && logs.length > 1 ? kmDriven / Math.max(1, monthsBetween(parseLocalDate(firstLog.date), parseLocalDate(logs[logs.length - 1].date))) : null;

  const valueChart = useMemo(() => {
    const known = [
      ...(account.purchaseDate && purchasePrice ? [{ date: account.purchaseDate, price: purchasePrice }] : []),
      ...(account.priceHistory || []),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const trendLine = calculateTrendLine(known, 'price');
    const rows: Record<string, unknown>[] = known.map((item, index) => ({ date: parseLocalDate(item.date), value: item.price, trend: trendLine[index] }));
    if (trend !== null && known.length > 1) {
      const last = known[known.length - 1];
      for (let year = 1; year <= 2; year++) {
        const date = parseLocalDate(last.date);
        rows.push({ date: new Date(date.getFullYear() + year, date.getMonth(), date.getDate()), trend: Math.max(0, safeRound(last.price + trend * year, 2)) });
      }
    }
    return rows;
  }, [account.purchaseDate, purchasePrice, account.priceHistory, trend]);

  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, { logo?: string }>;
  const brandLogo = useMemo(() => {
    if (!brandfetchClientId || !account.make) return null;
    const key = account.make.trim().toLowerCase();
    return getMerchantLogoUrl(CAR_MAKE_DOMAINS[key] || (key.includes('.') ? key : `${key}.com`), brandfetchClientId, buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules), { type: 'icon', fallback: 'transparent', width: 96, height: 96 });
  }, [account.make, brandfetchClientId, merchantLogoOverrides, merchantRules]);
  const lease = metrics.leaseStats;
  const newestFirst = [...logs].reverse();

  return (
    <AccountShell
      account={account}
      context={[account.make, account.model, account.year].filter(Boolean).join(' ') || `${account.ownership || 'Owned'} vehicle`}
      value={isLeased && account.residualValue ? account.residualValue : account.balance}
      valueLabel={isLeased ? 'Residual value' : 'Estimated value'}
      heroNote={purchasePrice ? <>Lost <Amount value={Math.max(0, depreciation)} currency={account.currency} /> since you bought it, about {perYearPct.toFixed(1)}% a year</> : `${account.ownership || 'Owned'}, ${account.fuelType || 'vehicle'}`}
      heroAside={account.imageUrl ? <img src={account.imageUrl} alt={account.name} referrerPolicy="no-referrer" className="max-h-44 w-full rounded-[var(--radius-lg)] object-cover" /> : undefined}
      banner={closureBanner(account, 'Retired:', page.accounts, props.onOpenAccount)}
      kpis={[
        { label: 'Odometer', value: `${metrics.currentMileage.toLocaleString()} km`, context: kmPerMonth ? `${Math.round(kmPerMonth).toLocaleString()} km a month` : undefined },
        { label: 'Cost per km', value: costPerKm !== null ? money(costPerKm, account) : '—', context: costPerKm !== null ? 'Value lost plus running costs' : 'Needs readings and costs' },
        isLeased && lease ? { label: 'Lease', value: `${lease.daysRemaining} days left`, visual: <ShareBar value={lease.progress} label="Lease elapsed" onHero /> } : { label: 'Equity', value: money(metrics.netEquity, account), context: loan ? 'After the car loan' : undefined },
        { label: 'Running costs', value: money(assetMoney.costs12Total, account), context: 'Last 12 months' },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={!isClosed ? { id: 'value', label: 'Update value', icon: 'pencil-edit-02', onPress: props.onUpdateValuation } : undefined}
      actions={[{ id: 'log', label: 'Add reading', icon: 'add-01', onPress: props.onAddLog }, ...valuationActions(props, 'Retire vehicle')]}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <Grid2>
                <Section title="Value" subtitle={trend !== null ? `Trend ${trend >= 0 ? '+' : '−'}${Math.abs(Math.round(trend)).toLocaleString()} ${account.currency} a year, projected two years` : 'Add valuations to see a trend'}>
                  {valueChart.length > 1
                    ? <TimeSeries data={valueChart} series={[{ key: 'value', label: 'Valuations', color: 'var(--chart-1)' }, { key: 'trend', label: 'Trend', color: 'var(--chart-3)', dashed: true }]} currency={account.currency} />
                    : <EmptyState icon="chart-line-data-01" title="Not enough valuations" description="Add a purchase price and a valuation to see the trend." actionLabel={isClosed ? undefined : 'Update value'} onAction={props.onUpdateValuation} />}
                </Section>
                <Section title="Mileage" subtitle={isLeased && lease ? `${lease.mileageStatus}: ${Math.round(lease.projectedMileage).toLocaleString()} km projected of ${lease.totalAllowance.toLocaleString()}` : 'Odometer readings over time'}>
                  {logs.length > 1 ? <VehicleMileageChart logs={logs} /> : <EmptyState icon="dashboard-square-01" title="Add readings" description="Two or more readings show your pace." actionLabel="Add reading" onAction={props.onAddLog} />}
                </Section>
              </Grid2>
              <Grid2>
                {isLeased && lease ? (
                  <Section title="Lease" subtitle={account.leaseProvider}>
                    <Figures items={[
                      { label: 'Ends', value: day(account.leaseEndDate) },
                      { label: 'Each month', value: account.leasePaymentAmount ? money(account.leasePaymentAmount, account) : '—' },
                      { label: 'Against allowance', value: `${lease.mileageDiff > 0 ? '−' : '+'}${Math.abs(Math.round(lease.mileageDiff)).toLocaleString()} km`, note: lease.mileageStatus },
                    ]} />
                    <div className="mt-4 space-y-1">
                      <p className="type-caption text-muted">Time used {pct(lease.progress)}</p>
                      <ShareBar value={lease.progress} label="Lease elapsed" />
                      <p className="type-caption pt-2 text-muted">Allowance used {pct(lease.totalAllowance ? (metrics.currentMileage / lease.totalAllowance) * 100 : 0)}</p>
                      <ShareBar value={lease.totalAllowance ? (metrics.currentMileage / lease.totalAllowance) * 100 : 0} label="Allowance used" tone={lease.mileageStatus === 'Over Budget' ? 'bad' : 'ok'} />
                    </div>
                  </Section>
                ) : (
                  <Section title="Car loan" subtitle={loan ? undefined : 'Link a loan to this vehicle in the loan\'s Edit form'}>
                    {loan ? (
                      <div className="space-y-3">
                        <Figures items={[{ label: 'Owed', value: money(metrics.outstandingLoanBalance, account) }, { label: 'Rate', value: loan.interestRate != null ? `${loan.interestRate}%` : '—' }, { label: 'Equity', value: money(metrics.netEquity, account, 'flow') }]} />
                        <Button variant="secondary" size="sm" icon="arrow-right-01" onPress={() => props.onOpenAccount(loan.id)}>Open {loan.name}</Button>
                      </div>
                    ) : <p className="type-body text-muted">No loan on this vehicle.</p>}
                  </Section>
                )}
                <Section title="Running costs" subtitle="Payments marked for this vehicle, last 12 months">
                  {assetMoney.costsByCategory.length
                    ? <Donut items={assetMoney.costsByCategory} currency={account.currency} centerLabel="A year" />
                    : <p className="type-body text-muted">Mark fuel, insurance or repairs for this vehicle in the transaction form ("For a property or vehicle") to see them here.</p>}
                </Section>
              </Grid2>
            </>
          ),
        },
        {
          id: 'mileage',
          label: 'Mileage',
          content: (
            <Section title="Readings" action={<Button size="sm" icon="add-01" onPress={props.onAddLog}>Add reading</Button>}>
              {newestFirst.length === 0 && <p className="type-body text-muted">No readings yet.</p>}
              <ul className="divide-y divide-line">
                {newestFirst.map((log, index) => {
                  const previous = newestFirst[index + 1];
                  const added = previous ? log.reading - previous.reading : 0;
                  return (
                    <li key={log.id} className="flex min-h-12 items-center gap-2">
                      <span className="type-body min-w-0 flex-1 truncate text-ink">{day(log.date)}</span>
                      {added > 0 && <span className="type-caption text-muted">+{added.toLocaleString()} km</span>}
                      <span className="type-figure-row text-ink">{log.reading.toLocaleString()} km</span>
                      <IconButton icon="pencil-edit-02" label={`Edit the reading from ${day(log.date)}`} onPress={() => props.onEditLog(log)} />
                      <IconButton icon="delete-02" label={`Delete the reading from ${day(log.date)}`} onPress={() => props.onDeleteLog(log.id)} />
                    </li>
                  );
                })}
              </ul>
            </Section>
          ),
        },
        activityTab(props),
        detailsTab([
          { label: 'Make and model', value: <span className="inline-flex items-center gap-2">{brandLogo && <img src={brandLogo} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} className="size-6 rounded-[var(--radius-sm)]" />}{`${account.make || ''} ${account.model || ''}`.trim() || '—'}</span> },
          { label: 'Year', value: account.year },
          { label: 'Plate', value: account.licensePlate ? <LicensePlate plate={account.licensePlate} countryCode={account.registrationCountryCode} /> : undefined },
          { label: 'VIN', value: account.vin, copy: account.vin },
          { label: 'Fuel', value: account.fuelType },
          { label: 'Ownership', value: account.ownership },
          { label: 'Bought', value: day(account.purchaseDate) },
          { label: 'Price paid', value: purchasePrice ? money(purchasePrice, account) : undefined },
          { label: 'Lease provider', value: account.leaseProvider },
          { label: 'Currency', value: account.currency },
        ]),
      ]}
    />
  );
};

/** Other assets: what it's worth against what it cost, over time. Electronics and furniture lose value on a straight line. */
export const OtherAssetLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const isClosed = account.status === 'closed';
  const bought = account.purchasePrice || 0;
  const value = account.balance;
  const heldMonths = account.purchaseDate ? monthsBetween(parseLocalDate(account.purchaseDate), new Date()) : account.openingDate ? monthsBetween(parseLocalDate(account.openingDate), new Date()) : 0;
  const depreciates = account.otherSubType === 'Electronics' || account.otherSubType === 'Furniture';
  const chart = useMemo(() => {
    const known = [
      ...(account.purchaseDate && bought ? [{ date: account.purchaseDate, price: bought }] : []),
      ...(account.priceHistory || []),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const rows: Record<string, unknown>[] = known.map(item => ({ date: parseLocalDate(item.date), value: item.price }));
    if (rows.length === 0 || isoDay(rows[rows.length - 1].date as Date) < isoDay(new Date())) rows.push({ date: new Date(), value });
    if (depreciates && bought && account.purchaseDate) {
      // Five years to nothing, a common straight-line life for electronics and furniture.
      const start = parseLocalDate(account.purchaseDate);
      for (let year = 1; year <= 5; year++) rows.push({ date: new Date(start.getFullYear() + year, start.getMonth(), start.getDate()), schedule: Math.max(0, safeRound(bought * (1 - year / 5), 2)) });
      rows[0].schedule = bought;
      rows.sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
    }
    return rows;
  }, [account.purchaseDate, bought, account.priceHistory, value, depreciates]);
  const valued = (account.priceHistory?.length ?? 0) > 0 || account.subType === undefined;
  const isMarketValued = valued && account.otherSubType !== 'Private Loan';

  return (
    <AccountShell
      account={account}
      context={`${account.otherSubType || 'Other asset'}${account.location ? `, ${account.location}` : ''}`}
      value={value}
      valueLabel="Value"
      heroNote={bought ? <><Amount value={value - bought} currency={account.currency} /> against what you paid</> : undefined}
      banner={closureBanner(account, 'Sold or closed:', page.accounts, props.onOpenAccount)}
      kpis={[
        { label: 'Bought for', value: bought ? money(bought, account) : '—' },
        { label: 'Gain or loss', value: bought ? pct(((value - bought) / bought) * 100, 1) : '—' },
        { label: 'Held for', value: heldMonths ? `${Math.floor(heldMonths / 12) ? `${Math.floor(heldMonths / 12)}y ` : ''}${heldMonths % 12}m` : '—' },
        { label: account.otherSubType === 'Private Loan' ? 'Owed by' : 'Condition', value: (account.otherSubType === 'Private Loan' ? account.counterparty : account.assetCondition) || '—' },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={!isClosed && isMarketValued ? { id: 'value', label: 'Update value', icon: 'pencil-edit-02', onPress: props.onUpdateValuation } : { id: 'add', label: 'Add transaction', icon: 'add-01', onPress: props.onAddTransaction }}
      actions={valuationActions(props, 'Record sale')}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <Section title="Value over time" subtitle={depreciates ? 'Valuations, and a five-year straight-line schedule from the price paid' : 'From the price paid and your valuations'}>
              <TimeSeries data={chart} series={[{ key: 'value', label: 'Value', color: 'var(--chart-1)' }, ...(depreciates ? [{ key: 'schedule', label: 'Straight line', color: 'var(--chart-3)', dashed: true }] : [])]} currency={account.currency} />
            </Section>
          ),
        },
        activityTab(props),
        detailsTab([
          { label: 'Kind', value: account.otherSubType },
          { label: 'Condition', value: account.assetCondition },
          { label: 'Location', value: account.location },
          { label: 'Counterparty', value: account.counterparty },
          { label: 'Bought', value: day(account.purchaseDate) },
          { label: 'Currency', value: account.currency },
          { label: 'Notes', value: account.notes },
        ]),
      ]}
    />
  );
};

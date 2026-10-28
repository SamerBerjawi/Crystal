import React, { useState } from 'react';
import { curveNatural } from '@visx/curve';
import { AreaChart } from '../../components/bklit/charts/area-chart';
import { Area } from '../../components/bklit/charts/area';
import { Background } from '../../components/bklit/charts/background';
import { Grid } from '../../components/bklit/charts/grid';
import { TrendLine } from '../../components/bklit/charts/trend-line';
import { XAxis } from '../../components/bklit/charts/x-axis';
import { ChartTooltip } from '../../components/bklit/charts/tooltip';
import { Badge, Button, Card, CardTitle, IconButton, MoreButton, Money, ProgressBar, SegmentedTabs, StatTile, Switch } from '../../components/new/ui';
import { Drawer } from '../../components/new/Drawer';
import { usePageTabs } from '../../components/new/shellContext';
import { toast } from '../../components/new/toast';
import { confirmNew } from '../../components/new/ConfirmDialog';
import { HoldButton } from '../../components/kokonutui/hold-button';
import { FilterChip, FooterLink, PeriodPill, TileHeader, TileValue, TwoToneTitle } from '../../components/new/tile';

/** Dev-only gallery of the New design tokens and primitives (`/design-new`). Sample values only. */

const SWATCHES = ['canvas', 'surface', 'inset', 'line', 'ink', 'muted', 'faint', 'violet', 'violet-soft', 'green', 'green-soft', 'orange', 'orange-soft', 'sky', 'sky-soft', 'red', 'red-soft', 'peach'] as const;

/** Throws on render, to show the New error panel. */
const Crash: React.FC = () => { throw new Error('Sample failure from https://api.example.com/v1/data at /src/pages/x.tsx'); };

const sample = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(2026, 2, 20 + i),
  income: [32, 41, 30, 42, 47, 39, 58][i] * 1000,
  expenses: [12, 15, 14, 28, 22, 24, 41][i] * 1000,
}));

export const GalleryNew: React.FC = () => {
  const [tab, setTab] = useState<'tokens' | 'controls'>('tokens');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [syncOn, setSyncOn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [crash, setCrash] = useState(false);
  const [kind, setKind] = useState<'spend' | 'income' | 'transfers'>('spend');
  const [range, setRange] = useState<'week' | 'month' | 'year'>('week');
  const [chips, setChips] = useState(['Team', 'Insights', 'Today']);
  const ranges = [{ value: 'week' as const, label: 'Weekly' }, { value: 'month' as const, label: 'Monthly' }, { value: 'year' as const, label: 'Yearly' }];
  usePageTabs<'tokens' | 'controls'>({ label: 'Gallery sections', value: tab, onChange: setTab, items: [{ id: 'tokens', label: 'Tokens' }, { id: 'controls', label: 'Controls' }] });

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 xl:grid-cols-12">
      {crash && <Crash />}
      <div className="grid gap-4 sm:grid-cols-3 xl:col-span-12">
        <StatTile accent="violet" icon="wallet" label="Net worth" value={<Money amount={491080} currency="USD" size="lg" />} />
        <StatTile accent="green" icon="arrowUpRight" label="Income" detail="this month" value={<Money amount={8420} currency="USD" size="lg" />} />
        <StatTile accent="orange" icon="money" label="Spent" detail="67% of budget" value={<Money amount={2348.6} currency="USD" size="lg" />} />
      </div>

      <TwoToneTitle first="Hey, need help?" second="Just ask me anything" stacked className="text-3xl leading-tight sm:text-4xl xl:col-span-12" />

      <Card
        className="xl:col-span-4"
        top={(
          <>
            <TileHeader title={<span className="font-semibold italic tracking-wide">VISA</span>} action={<PeriodPill label="Debit type" value="direct" onChange={() => undefined} options={[{ value: 'direct', label: 'Direct debits' }]} />} />
            <TileValue label="Linked to main account"><span className="nv-tabular text-xl font-medium">•••• 2719</span></TileValue>
            <div className="mt-4 flex gap-2"><Button variant="primary" className="flex-1">Receive</Button><Button className="flex-1">Send</Button></div>
          </>
        )}
      >
        <div className="flex items-end justify-between gap-3">
          <TileValue label="Monthly regular fee"><Money amount={25} currency="USD" size="lg" /></TileValue>
          <FooterLink icon="settings" onClick={() => toast.info('Card limits')}>Edit card<br />limits</FooterLink>
        </div>
      </Card>
      <Card className="xl:col-span-4">
        <TileHeader icon="refresh" action={<PeriodPill<typeof range> label="Range" value={range} onChange={setRange} options={ranges} />} />
        <TileValue label="Total income"><Money amount={23194.8} currency="USD" size="xl" /></TileValue>
      </Card>
      <Card className="xl:col-span-4">
        <TileHeader icon="money" action={<PeriodPill<typeof range> label="Range" value={range} onChange={setRange} options={ranges} />} />
        <div className="flex items-end justify-between gap-3">
          <TileValue label="Total paid"><Money amount={8145.2} currency="USD" size="xl" /></TileValue>
          <FooterLink icon="analytics" onClick={() => toast.info('Chart mode')}>View on<br />chart mode</FooterLink>
        </div>
      </Card>
      <Card className="xl:col-span-12">
        <TileHeader title="Activity manager" action={<Button size="sm" icon="menu">Filters</Button>} />
        <div className="flex flex-wrap gap-2">
          {chips.map((c, i) => <FilterChip key={c} label={c} active={i === 0} onRemove={() => setChips(cs => cs.filter(x => x !== c))} />)}
          {chips.length < 3 && <Button size="sm" variant="ghost" onClick={() => setChips(['Team', 'Insights', 'Today'])}>Reset</Button>}
        </div>
      </Card>
      <Card className="xl:col-span-4" top={(
        <div className="text-center">
          <p className="text-sm text-nv-muted">Spent this month</p>
          <p className="mt-2"><Money amount={2348.6} currency="EUR" size="hero" /></p>
          <p className="mt-2 text-sm text-nv-muted">of €3,500 budget · 67% · 8 days left</p>
        </div>
      )}>
        <div className="grid grid-cols-3 divide-x divide-nv-line text-center">
          {[['Daily average', '€62.10'], ['Transactions', '47'], ['Largest', '€142']].map(([k, v]) => (
            <div key={k}><p className="text-xs text-nv-muted">{k}</p><p className="nv-tabular mt-1 text-xl font-semibold">{v}</p></div>
          ))}
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <CardTitle action={<SegmentedTabs<'month' | 'quarter' | 'year'> label="Period" size="sm" value={period} onChange={setPeriod} items={[{ id: 'month', label: 'Month' }, { id: 'quarter', label: 'Quarter' }, { id: 'year', label: 'Year' }]} />}>
          Balance
        </CardTitle>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Money amount={491080} currency="USD" size="hero" />
          <span className="flex items-center gap-2 text-sm text-nv-muted"><span className="h-2.5 w-2.5 rounded-full border-2 border-nv-violet" />Income</span>
          <span className="flex items-center gap-2 text-sm text-nv-muted"><span className="h-2.5 w-2.5 rounded-full border-2 border-nv-orange" />Expenses</span>
        </div>
        <AreaChart margin={{ top: 8, right: 8, bottom: 40, left: 8 }} data={sample} aspectRatio="3 / 1" currency="USD">
          <Background pattern="dots" opacity={0.85} />
          <Grid horizontal />
          <TrendLine
            dataKey="income"
            strokeStyle="gradient"
            gradientStart="var(--chart-3)"
            gradientEnd="var(--chart-1)"
            strokeWidth={2}
            strokeOpacity={0.5}
            fadeEdges
          />
          <Area dataKey="income" curve={curveNatural} fill="var(--chart-line-primary)" stroke="var(--chart-line-primary)" fillOpacity={0.2} strokeWidth={3} />
          <Area dataKey="expenses" curve={curveNatural} fill="var(--chart-line-secondary)" stroke="var(--chart-line-secondary)" fillOpacity={0.2} strokeWidth={3} />
          <XAxis />
          <ChartTooltip currency="USD" />
        </AreaChart>
      </Card>

      {tab === 'tokens' ? (
        <Card className="xl:col-span-12">
          <CardTitle>Colour tokens</CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {SWATCHES.map(name => (
              <div key={name}>
                <div className="h-16 rounded-nv-tile ring-1 ring-nv-line" style={{ background: `var(--nv-${name})` }} />
                <p className="mt-1.5 text-xs text-nv-muted">nv-{name}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <>
          <Card className="xl:col-span-6">
            <CardTitle>Buttons and badges</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon="add" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
              <Button variant="cta">Call to action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <IconButton icon="more" label="More" />
              <IconButton icon="add" label="Add" tone="violet" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="red" icon="alert">Uncategorized</Badge>
              <Badge tone="orange" icon="warning">Pending match</Badge>
              <Badge tone="sky" icon="transactions">Transfer</Badge>
              <Badge icon="more">Split</Badge>
              <Badge tone="green" icon="repeat">Recurring</Badge>
            </div>
          </Card>
          <Card className="xl:col-span-6">
            <CardTitle>Feedback</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => toast.success('Bank synced', { description: '12 new transactions.' })}>Success toast</Button>
              <Button onClick={() => toast.undo('Marked "Rent" as paid', () => toast.info('Restored'))}>Undo toast</Button>
              <Button onClick={() => toast.error("Changes not saved", { description: "The server couldn't be reached." })}>Error toast</Button>
              <Button onClick={async () => toast.info((await confirmNew({ title: 'Skip this payment?', message: 'The next one stays scheduled.' })) ? 'Confirmed' : 'Cancelled')}>Confirm</Button>
              <Button variant="danger" onClick={async () => toast.info((await confirmNew({ title: 'Delete "Checking"?', message: 'Its 214 transactions are deleted too.', danger: true, confirmLabel: 'Hold to delete' })) ? 'Deleted' : 'Kept')}>Danger confirm</Button>
              <Button variant="ghost" onClick={() => setCrash(true)}>Error panel</Button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <HoldButton tone="danger" onHoldComplete={() => toast.success('Held')}>Hold to delete</HoldButton>
              <span className="flex items-center text-sm text-nv-muted"><Switch checked={syncOn} onChange={setSyncOn} label="Auto sync" />Auto sync</span>
            </div>
          </Card>
          <Card className="xl:col-span-6">
            <CardTitle>Accent tabs and lists</CardTitle>
            <SegmentedTabs<'spend' | 'income' | 'transfers'> label="Kind" value={kind} onChange={setKind} items={[{ id: 'spend', label: 'Spending', accent: 'orange', icon: 'money' }, { id: 'income', label: 'Income', accent: 'green', icon: 'wallet' }, { id: 'transfers', label: 'Transfers', accent: 'sky', icon: 'transactions' }]} />
            <ul id="nv-sample-list" className="mt-4 divide-y divide-nv-line">
              {['Groceries', 'Rent', 'Fuel', 'Dining', 'Gym', 'Streaming'].slice(0, expanded ? 6 : 3).map(n => <li key={n} className="py-3 text-[15px]">{n}</li>)}
            </ul>
            <MoreButton expanded={expanded} total={6} onToggle={() => setExpanded(e => !e)} controls="nv-sample-list" />
          </Card>
          <Card className="xl:col-span-6">
            <CardTitle>Progress</CardTitle>
            <p className="text-sm text-nv-muted">Target $250,000</p>
            <ProgressBar className="mt-2" value={62} tone="green" label="Income target" />
            <p className="mt-4 text-sm text-nv-muted">Max $180,000</p>
            <ProgressBar className="mt-2" value={49} label="Spending limit" />
          </Card>
        </>
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Add expense"
        description="Sample drawer: bottom sheet on phones, right drawer on desktop."
        footer={<Button variant="cta" size="lg" className="w-full" onClick={() => setDrawerOpen(false)}>Save expense · €42.50</Button>}
      >
        <p className="py-6 text-center"><Money amount={42.5} currency="EUR" size="hero" /></p>
        <div className="grid grid-cols-3 gap-3">
          {['Food', 'Transport', 'Shopping', 'Fun', 'Health', 'Bills'].map((c, i) => (
            <button key={c} type="button" className={i === 0 ? 'rounded-nv-tile bg-nv-surface py-5 text-sm font-medium text-nv-ink ring-[1.5px] ring-nv-ink' : 'rounded-nv-tile bg-nv-inset py-5 text-sm text-nv-muted'}>{c}</button>
          ))}
        </div>
      </Drawer>
    </div>
  );
};

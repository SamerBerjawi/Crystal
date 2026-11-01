import React, { useState } from 'react';
import { Button as AriaButton, type Selection, type SortDescriptor } from 'react-aria-components';
import { toast } from 'sonner';
import { Button, HoldButton, IconButton, SelectionBar, TextLink } from '../../components/ui/Actions';
import { Badge, CountPill, DataTable, DayGroup, Row, ShowMore, type TableColumn } from '../../components/ui/Display';
import { AmountInput, Checkbox, DateInput, DateRangeInput, Radio, RadioGroup, Slider, Switch, Textarea, TextInput, type DateRange } from '../../components/ui/Fields';
import { Menu } from '../../components/ui/Menu';
import { ConfirmDialog, Dialog, FullPanel, Popover, SidePanel } from '../../components/ui/Overlays';
import { Combobox, MultiSelect, Select } from '../../components/ui/Pickers';
import { Banner, EmptyState, ErrorState, Skeleton, SyncStatus } from '../../components/ui/States';
import SegmentedControl from '../../components/ui/SegmentedControl';

const OPTIONS = [
  { id: 'groceries', label: 'Groceries', icon: 'shopping_cart' },
  { id: 'eating', label: 'Eating out', description: 'Restaurants and cafés' },
  { id: 'transport', label: 'Transport' },
  { id: 'a-very-long-one', label: 'A category with a very long name that has to truncate on a phone' },
];

interface Sample { id: string; name: string; account: string; amount: string }

const ROWS: Sample[] = [
  { id: '1', name: 'Colruyt', account: 'Everyday', amount: '− €42.10' },
  { id: '2', name: 'Salary', account: 'Everyday', amount: '+ €3,250.00' },
  { id: '3', name: 'A very long merchant name that should truncate before the amount does', account: 'Savings', amount: 'RON 12,345,678.90' },
];

const COLUMNS: TableColumn<Sample>[] = [
  { id: 'name', label: 'Name', isSortable: true, isKey: true, render: row => row.name },
  { id: 'account', label: 'Account', render: row => row.account },
  { id: 'amount', label: 'Amount', align: 'right', isKey: true, render: row => row.amount },
];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
    <h2 className="type-section-title mb-4 text-ink">{title}</h2>
    {children}
  </section>
);

/** Development only, at `/?ui-kit`: every primitive in one place, for checking sizes and themes. */
const UiKit: React.FC = () => {
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [date, setDate] = useState('2026-10-31');
  const [range, setRange] = useState<DateRange | null>(null);
  const [one, setOne] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);
  const [many, setMany] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<Selection>(new Set());
  const [sort, setSort] = useState<SortDescriptor>({ column: 'name', direction: 'ascending' });
  const [segment, setSegment] = useState('month');
  const close = () => { setOpen(null); setDirty(false); };
  const selected = selection === 'all' ? ROWS.length : selection.size;

  return (
    <div className="space-y-6">
      <h1 className="type-page-title text-ink">UI kit</h1>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon="add">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button isBusy>Busy label</Button>
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="lg">Large</Button>
          <Button isDisabled>Disabled</Button>
          <IconButton icon="search" label="Search" />
          <IconButton icon="add" label="Add" variant="primary" />
          <IconButton icon="notifications" label="Alerts" badge={3} />
          <TextLink href="#">Inline link</TextLink>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <HoldButton label="Delete 3 transactions" onConfirm={() => toast('Deleted 3 transactions', { action: { label: 'Undo', onClick: () => undefined } })} />
          <SegmentedControl items={[{ id: 'month', label: 'Month' }, { id: 'quarter', label: 'Quarter' }, { id: 'year', label: 'Year' }]} activeId={segment} onChange={setSegment} />
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Name" help="As it appears on your statement" value={text} onChange={setText} />
          <TextInput label="With an error" error="Enter a name" value="" onChange={() => undefined} />
          <AmountInput label="Amount" currency="EUR" />
          <TextInput label="Merchant" value="Colruyt" onChange={() => undefined} autofill={{ source: 'Merchant', onUndo: () => undefined }} />
          <DateInput label="Date" value={date} onChange={setDate} />
          <DateRangeInput label="Period" value={range} onChange={setRange} />
          <Select label="Category" options={OPTIONS} value={one} onChange={setOne} />
          <Combobox label="Payee" options={OPTIONS} value={found} onChange={setFound} onCreate={name => toast(`Create ${name}`)} />
          <MultiSelect label="Categories" options={OPTIONS} value={many} onChange={setMany} />
          <Textarea label="Notes" />
          <RadioGroup label="Repeat" defaultValue="monthly">
            <Radio value="monthly">Monthly</Radio>
            <Radio value="yearly">Yearly</Radio>
          </RadioGroup>
          <div className="flex flex-col gap-2">
            <Checkbox defaultSelected>Include in budget</Checkbox>
            <Checkbox isIndeterminate>Some selected</Checkbox>
            <Switch defaultSelected>Round up spare change</Switch>
            <Slider label="Pay extra" defaultValue={30} formatOptions={{ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }} maxValue={500} />
          </div>
        </div>
      </Section>

      <Section title="Menus and overlays">
        <div className="flex flex-wrap items-center gap-2">
          <Menu
            title="Transaction"
            trigger={<IconButton icon="more_horiz" label="More actions" />}
            items={[
              { id: 'edit', label: 'Edit', icon: 'edit', shortcut: 'E', onAction: () => toast('Edit') },
              { id: 'copy', label: 'Duplicate', icon: 'content_copy', onAction: () => toast('Duplicate') },
              { id: 'delete', label: 'Delete', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => setOpen('delete') },
            ]}
          />
          <Popover title="Filters" trigger={<AriaButton className="type-label cursor-pointer rounded-full border border-line-strong px-4 py-2.5 text-ink">Filters</AriaButton>}>
            <div className="w-56 max-md:w-full"><Checkbox>Only uncategorised</Checkbox></div>
          </Popover>
          <Button variant="secondary" onPress={() => setOpen('dialog')}>Dialog</Button>
          <Button variant="secondary" onPress={() => { setDirty(true); setOpen('side'); }}>Side panel, unsaved</Button>
          <Button variant="secondary" onPress={() => setOpen('full')}>Full panel</Button>
          <Button variant="secondary" onPress={() => setOpen('type')}>Type to confirm</Button>
          <Button variant="secondary" onPress={() => toast.success('Budget saved')}>Toast</Button>
        </div>
        <Dialog isOpen={open === 'dialog'} onClose={close} title="Change the budget" footer={<div className="flex justify-end gap-2"><Button variant="ghost" onPress={close}>Cancel</Button><Button onPress={close}>Save budget</Button></div>}>
          <AmountInput label="Amount" currency="EUR" />
        </Dialog>
        <SidePanel isOpen={open === 'side'} onClose={close} isDirty={dirty} title="Edit the transaction" description="Closing asks first" footer={<HoldButton block label="Delete this transaction" onConfirm={close} />}>
          <TextInput label="Name" />
        </SidePanel>
        <FullPanel isOpen={open === 'full'} onClose={close} title="Import data">
          <p className="type-body text-muted">A long or multi-step task.</p>
        </FullPanel>
        <ConfirmDialog isOpen={open === 'delete'} onClose={close} onConfirm={() => toast('Deleted')} title="Delete this transaction?" confirmLabel="Delete transaction" isDestructive />
        <ConfirmDialog isOpen={open === 'type'} onClose={close} onConfirm={() => toast('Deleted')} title="Delete Everyday?" message="This removes the account and its transactions." confirmLabel="Delete account" isDestructive requireText="Everyday" />
      </Section>

      <Section title="Table">
        <DataTable
          label="Sample transactions"
          columns={COLUMNS}
          rows={ROWS}
          sort={sort}
          onSortChange={setSort}
          selection={selection}
          onSelectionChange={setSelection}
          onRowOpen={row => toast(row.name)}
          renderPhoneRow={row => <Row title={row.name} context={row.account} trailing={row.amount} onPress={() => toast(row.name)} />}
        />
        <ShowMore remaining={2140} onPress={() => undefined} />
        <DayGroup label="Today" total="− €42.10">
          <Row title="Colruyt" context="Everyday" trailing="− €42.10" />
        </DayGroup>
        {selected > 0 && (
          <SelectionBar count={selected} onClear={() => setSelection(new Set())}>
            <Button size="sm" variant="ghost">Categorise</Button>
          </SelectionBar>
        )}
      </Section>

      <Section title="States">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="positive">Positive</Badge>
          <Badge tone="attention">Attention</Badge>
          <Badge tone="negative">Negative</Badge>
          <Badge tone="ocean">Ocean</Badge>
          <Badge tone="terracotta">Terracotta</Badge>
          <Badge tone="purple">Purple</Badge>
          <Badge tone="indigo">Indigo</Badge>
          <CountPill count={12} />
        </div>
        <div className="mt-4 space-y-2">
          <Banner>Rates were updated this morning.</Banner>
          <Banner tone="attention" actionLabel="Reconnect" onAction={() => undefined}>Your bank connection needs attention.</Banner>
          <Banner tone="error">Your last change couldn't be saved.</Banner>
          <SyncStatus state="working">Saving</SyncStatus>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Skeleton variant="row" />
          <Skeleton variant="card" />
          <Skeleton />
        </div>
        <EmptyState title="Nothing to review. Nice." description="Transactions that need a look appear here." actionLabel="Add a transaction" onAction={() => undefined} />
        <ErrorState onRetry={() => undefined} />
      </Section>
    </div>
  );
};

export default UiKit;

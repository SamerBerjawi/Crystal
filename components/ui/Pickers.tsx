import React, { useMemo, useRef, useState } from 'react';
import {
  Button as AriaButton,
  ComboBox,
  Dialog as AriaDialog,
  Header,
  Input,
  Label as AriaLabel,
  ListBox,
  ListBoxItem,
  Popover as AriaPopover,
  Section,
  Select as AriaSelect,
  SelectValue,
  useFilter,
  type Key,
} from 'react-aria-components';
import Icon from './Icon';
import { Button } from './Actions';
import { CountPill } from './Display';
import { FieldShell, controlStyles, type FieldProps } from './Fields';
import { BottomSheet, popoverStyles } from './Overlays';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

export interface PickerOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  visual?: React.ReactNode;
  group?: string;
  level?: number;
}

const optionRow =
  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-ink outline-hidden pointer-coarse:min-h-12 data-[focused]:bg-inset data-[hovered]:bg-inset data-[selected]:bg-primary-soft data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';

const triggerRow = cn(controlStyles, 'flex h-11 cursor-pointer items-center justify-between gap-2 px-3 text-left text-[.9375rem] font-medium max-md:h-12 max-md:text-base');

/** A filter chip in a toolbar: the label is for screen readers only, beside other chips. */
export const chipRow = 'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[.8125rem] font-bold text-ink outline-hidden hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)] pointer-coarse:h-11';

const Option: React.FC<{ option: PickerOption; multi?: boolean }> = ({ option, multi }) => (
  <ListBoxItem
    id={option.id}
    textValue={option.label}
    style={option.level ? { paddingLeft: 10 + option.level * 16 } : undefined}
    className={optionRow}
  >
    {({ isSelected }) => (
      <>
        {multi && (
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-[var(--duration-fast)]',
              isSelected
                ? 'border-pill bg-pill text-on-pill'
                : 'border-black/15 bg-black/[0.03] dark:border-white/20 dark:bg-white/[0.04]'
            )}
          >
            {isSelected && <Icon name="check" size={13} className="stroke-[2.5]" />}
          </span>
        )}
        {option.visual ? (
          <span className="shrink-0">{option.visual}</span>
        ) : option.icon ? (
          <Icon name={option.icon} size={20} className="shrink-0 text-muted" />
        ) : null}
        <span className="min-w-0 flex-1 py-1.5">
          <span className="type-body block truncate">{option.label}</span>
          {option.description && <span className="type-caption block truncate text-muted">{option.description}</span>}
        </span>
        {isSelected && !multi && <Icon name="check" size={20} weight="bold" className="shrink-0 text-primary" />}
      </>
    )}
  </ListBoxItem>
);

const listStyles = 'max-h-[calc(40px*12+12px)] overflow-y-auto p-1.5 outline-hidden';

function renderOptions(options: PickerOption[], multi?: boolean) {
  const hasGroups = options.some(o => !!o.group);
  if (!hasGroups) {
    return options.map(option => <Option key={option.id} option={option} multi={multi} />);
  }

  const groups = new Map<string, PickerOption[]>();
  options.forEach(o => {
    const key = o.group || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  });

  return Array.from(groups.entries()).map(([group, items]) => (
    <Section key={group || '__ungrouped'}>
      {group ? (
        <Header className="sticky top-0 z-10 bg-solid/95 backdrop-blur-sm px-2.5 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted select-none">
          {group}
        </Header>
      ) : null}
      {items.map(option => <Option key={option.id} option={option} multi={multi} />)}
    </Section>
  ));
}

/** Picks one value from a short list. A bottom sheet on phones. */
export const Select: React.FC<FieldProps & {
  options: PickerOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  /** `chip` for toolbars: a pill trigger with the label read out but not shown. */
  variant?: 'field' | 'chip';
}> = ({ label, help, error, autofill, className, options, value, onChange, placeholder = 'Choose', isDisabled, variant = 'field' }) => {
  const isPhone = useIsMobile();
  const [isOpen, setOpen] = useState(false);

  const name = typeof label === 'string' ? label : placeholder;
  const isChip = variant === 'chip';
  const shell = (trigger: React.ReactNode) => isChip
    ? <><AriaLabel className="sr-only">{label}</AriaLabel>{trigger}</>
    : <FieldShell label={label} help={help} error={error} autofill={autofill}>{trigger}</FieldShell>;

  // React Aria's Select reads its items from a popover, so the phone's sheet drives its own list.
  if (isPhone) {
    const selected = options.find(option => option.id === value);
    return (
      <div className={className}>
        <AriaSelect isOpen={false} isDisabled={isDisabled} isInvalid={!!error} onOpenChange={() => undefined}>
          {shell(
            <AriaButton className={isChip ? chipRow : triggerRow} onPress={() => setOpen(true)}>
              <span className={cn('min-w-0 truncate', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
              <Icon name="expand_more" size={isChip ? 16 : 20} className="shrink-0 text-muted" />
            </AriaButton>
          )}
        </AriaSelect>
        <BottomSheet isOpen={isOpen} onClose={() => setOpen(false)} title={name}>
          <ListBox
            aria-label={name}
            selectionMode="single"
            selectedKeys={value ? [value] : []}
            onAction={id => { onChange(String(id)); setOpen(false); }}
            className="outline-hidden"
          >
            {renderOptions(options)}
          </ListBox>
        </BottomSheet>
      </div>
    );
  }

  const selected = options.find(option => option.id === value);

  return (
    <AriaSelect
      value={value}
      onChange={id => onChange(String(id))}
      isDisabled={isDisabled}
      isInvalid={!!error}
      placeholder={placeholder}
      className={className}
    >
      {shell(
        <AriaButton className={isChip ? chipRow : cn(triggerRow, 'gap-2.5')}>
          {selected?.visual && <span className="shrink-0">{selected.visual}</span>}
          <SelectValue className="min-w-0 flex-1 truncate data-[placeholder]:text-muted">
            {({ selectedText, defaultChildren }) => selectedText ?? defaultChildren}
          </SelectValue>
          <Icon name="expand_more" size={isChip ? 16 : 20} className="shrink-0 text-muted" />
        </AriaButton>
      )}
      <AriaPopover offset={6} className={cn(popoverStyles, isChip ? 'min-w-(--trigger-width)' : 'w-(--trigger-width)')}>
        <ListBox className={listStyles}>
          {renderOptions(options)}
        </ListBox>
      </AriaPopover>
    </AriaSelect>
  );
};

/** Long lists get search, and can offer to create what isn't there. A full-height sheet on phones. */
export const Combobox: React.FC<FieldProps & {
  options: PickerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Adds a "Create" row for text that matches nothing. */
  onCreate?: (text: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}> = ({ label, help, error, autofill, className, options, value, onChange, onCreate, placeholder = 'Search', isDisabled }) => {
  const isPhone = useIsMobile();
  const { contains } = useFilter({ sensitivity: 'base' });
  const [query, setQuery] = useState('');
  const [isOpen, setOpen] = useState(false);
  const isSelectingRef = useRef(false);
  const selected = options.find(option => option.id === value);
  const name = typeof label === 'string' ? label : placeholder;

  const visible = useMemo(
    () =>
      options.filter(
        option =>
          contains(option.label, query) ||
          (option.description && contains(option.description, query)) ||
          (option.group && contains(option.group, query)),
      ),
    [contains, options, query],
  );
  const canCreate = !!onCreate && !!query.trim() && !options.some(option => option.label.toLowerCase() === query.trim().toLowerCase());

  const pick = (key: Key | null) => {
    if (key === null) return;
    isSelectingRef.current = true;
    if (key === '__create') {
      onCreate?.(query.trim());
    } else {
      onChange(String(key));
    }
    setQuery('');
    setOpen(false);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 150);
  };

  const handleInputChange = (text: string) => {
    if (isSelectingRef.current) return;
    setQuery(text);
    if (!isOpen) setOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (isSelectingRef.current && open) return;
    setOpen(open);
    if (!open) {
      setQuery('');
    }
  };

  const createRow = canCreate && (
    <ListBoxItem id="__create" textValue={query} className={optionRow}>
      <Icon name="add" size={20} className="shrink-0 text-primary" />
      <span className="type-body truncate">Create “{query.trim()}”</span>
    </ListBoxItem>
  );
  const empty = () => <p className="type-body px-2.5 py-3 text-muted">Nothing matches “{query}”.</p>;

  if (isPhone) {
    return (
      <div className={className}>
        <AriaSelect isOpen={false} isDisabled={isDisabled} isInvalid={!!error} onOpenChange={setOpen}>
          <FieldShell label={label} help={help} error={error} autofill={autofill}>
            <AriaButton className={cn(triggerRow, 'gap-2.5')} onPress={() => setOpen(true)}>
              {selected?.visual && <span className="shrink-0">{selected.visual}</span>}
              <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
              <Icon name="expand_more" size={20} className="shrink-0 text-muted" />
            </AriaButton>
          </FieldShell>
        </AriaSelect>
        <BottomSheet isOpen={isOpen} onClose={() => { setOpen(false); setQuery(''); }} title={name} height="full">
          <input
            autoFocus
            type="search"
            aria-label={`Search ${name}`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className={cn(controlStyles, 'mb-2 h-12 px-3 text-base')}
          />
          <ListBox
            aria-label={name}
            selectionMode="single"
            selectedKeys={value ? [value] : []}
            onAction={pick}
            renderEmptyState={empty}
            className="outline-hidden"
          >
            {createRow}
            {renderOptions(visible)}
          </ListBox>
        </BottomSheet>
      </div>
    );
  }

  const showVisual = Boolean(selected?.visual && !query);

  return (
    <ComboBox
      selectedKey={value}
      onSelectionChange={pick}
      onInputChange={handleInputChange}
      onOpenChange={handleOpenChange}
      menuTrigger="input"
      allowsEmptyCollection
      isDisabled={isDisabled}
      isInvalid={!!error}
      className={className}
    >
      <FieldShell label={label} help={help} error={error} autofill={autofill}>
        <div className="relative flex items-center">
          {showVisual && (
            <span className="pointer-events-none absolute left-3 z-1 flex size-6 shrink-0 items-center justify-center">
              {selected?.visual}
            </span>
          )}
          <Input
            onFocus={e => e.target.select()}
            placeholder={placeholder}
            className={cn(
              controlStyles,
              'h-11 pr-10 text-[.9375rem] font-medium cursor-pointer',
              showVisual ? 'pl-11' : 'pl-3'
            )}
          />
          <AriaButton
            aria-label="Show options"
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:text-ink transition-colors"
          >
            <Icon name="expand_more" size={20} />
          </AriaButton>
        </div>
      </FieldShell>
      <AriaPopover offset={6} className={cn(popoverStyles, 'w-(--trigger-width)')}>
        <ListBox className={listStyles} onAction={pick} renderEmptyState={empty}>
          {createRow}
          {renderOptions(visible)}
        </ListBox>
      </AriaPopover>
    </ComboBox>
  );
};

/** Several values, with checkboxes and a count in the trigger. Phones confirm with Apply. */
export const MultiSelect: React.FC<FieldProps & {
  options: PickerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  isDisabled?: boolean;
}> = ({ label, help, error, className, options, value, onChange, placeholder = 'All', isDisabled }) => {
  const isPhone = useIsMobile();
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = typeof label === 'string' ? label : placeholder;
  const selection = isPhone ? draft : value;

  const toggle = (next: 'all' | Set<Key>) => {
    const ids = next === 'all' ? options.map(option => option.id) : [...next].map(String);
    if (isPhone) setDraft(ids);
    else onChange(ids);
  };

  const list = (
    <ListBox
      aria-label={name}
      selectionMode="multiple"
      selectedKeys={selection}
      onSelectionChange={toggle}
      className={isPhone ? 'outline-hidden' : listStyles}
    >
      {renderOptions(options, true)}
    </ListBox>
  );

  return (
    <div className={className}>
      <AriaSelect isOpen={false} isDisabled={isDisabled} isInvalid={!!error} onOpenChange={() => undefined}>
        <FieldShell label={label} help={help} error={error}>
          <AriaButton ref={triggerRef} className={triggerRow} onPress={() => { setDraft(value); setOpen(open => !open); }}>
            <span className={cn('min-w-0 truncate', !value.length && 'text-muted')}>
              {value.length === 1 ? options.find(option => option.id === value[0])?.label : value.length ? 'Selected' : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {value.length > 1 && <CountPill count={value.length} />}
              <Icon name="expand_more" size={20} className="text-muted" />
            </span>
          </AriaButton>
        </FieldShell>
      </AriaSelect>
      {isPhone ? (
        <BottomSheet
          isOpen={isOpen}
          onClose={() => setOpen(false)}
          title={name}
          footer={<Button block size="lg" onPress={() => { onChange(draft); setOpen(false); }}>Apply</Button>}
        >
          {list}
        </BottomSheet>
      ) : (
        <AriaPopover triggerRef={triggerRef} isOpen={isOpen} onOpenChange={setOpen} offset={6} className={cn(popoverStyles, 'w-(--trigger-width)')}>
          <AriaDialog aria-label={name} className="outline-hidden">{list}</AriaDialog>
        </AriaPopover>
      )}
    </div>
  );
};

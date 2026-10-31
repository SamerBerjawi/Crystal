import React, { useMemo, useRef, useState } from 'react';
import {
  Button as AriaButton,
  ComboBox,
  Dialog as AriaDialog,
  Input,
  ListBox,
  ListBoxItem,
  Popover as AriaPopover,
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
}

const optionRow =
  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-ink outline-none pointer-coarse:min-h-12 data-[focused]:bg-inset data-[hovered]:bg-inset data-[selected]:bg-primary-soft data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';

const triggerRow = cn(controlStyles, 'flex h-11 cursor-pointer items-center justify-between gap-2 px-3 text-left text-[.9375rem] font-medium max-md:h-12 max-md:text-base');

const Option: React.FC<{ option: PickerOption; multi?: boolean }> = ({ option, multi }) => (
  <ListBoxItem id={option.id} textValue={option.label} className={optionRow}>
    {({ isSelected }) => (
      <>
        {multi && (
          <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-line-strong bg-surface text-on-primary', isSelected && 'border-primary bg-primary')}>
            {isSelected && <Icon name="check" size={16} weight="bold" />}
          </span>
        )}
        {option.icon && <Icon name={option.icon} size={20} className="shrink-0 text-muted" />}
        <span className="min-w-0 flex-1 py-1.5">
          <span className="type-body block truncate">{option.label}</span>
          {option.description && <span className="type-caption block truncate text-muted">{option.description}</span>}
        </span>
        {isSelected && !multi && <Icon name="check" size={20} weight="bold" className="shrink-0 text-primary" />}
      </>
    )}
  </ListBoxItem>
);

const listStyles = 'max-h-[calc(40px*12+12px)] overflow-y-auto p-1.5 outline-none';

/** Picks one value from a short list. A bottom sheet on phones. */
export const Select: React.FC<FieldProps & {
  options: PickerOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}> = ({ label, help, error, autofill, className, options, value, onChange, placeholder = 'Choose', isDisabled }) => {
  const isPhone = useIsMobile();
  const [isOpen, setOpen] = useState(false);

  const name = typeof label === 'string' ? label : placeholder;

  // React Aria's Select reads its items from a popover, so the phone's sheet drives its own list.
  if (isPhone) {
    const selected = options.find(option => option.id === value);
    return (
      <div className={className}>
        <AriaSelect isOpen={false} isDisabled={isDisabled} isInvalid={!!error} onOpenChange={() => undefined}>
          <FieldShell label={label} help={help} error={error} autofill={autofill}>
            <AriaButton className={triggerRow} onPress={() => setOpen(true)}>
              <span className={cn('min-w-0 truncate', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
              <Icon name="expand_more" size={20} className="shrink-0 text-muted" />
            </AriaButton>
          </FieldShell>
        </AriaSelect>
        <BottomSheet isOpen={isOpen} onClose={() => setOpen(false)} title={name}>
          <ListBox
            aria-label={name}
            selectionMode="single"
            selectedKeys={value ? [value] : []}
            onAction={id => { onChange(String(id)); setOpen(false); }}
            className="outline-none"
          >
            {options.map(option => <Option key={option.id} option={option} />)}
          </ListBox>
        </BottomSheet>
      </div>
    );
  }

  return (
    <AriaSelect
      value={value}
      onChange={id => onChange(String(id))}
      isDisabled={isDisabled}
      isInvalid={!!error}
      placeholder={placeholder}
      className={className}
    >
      <FieldShell label={label} help={help} error={error} autofill={autofill}>
        <AriaButton className={triggerRow}>
          <SelectValue className="min-w-0 truncate data-[placeholder]:text-muted">
            {({ selectedText, defaultChildren }) => selectedText ?? defaultChildren}
          </SelectValue>
          <Icon name="expand_more" size={20} className="shrink-0 text-muted" />
        </AriaButton>
      </FieldShell>
      <AriaPopover offset={6} className={cn(popoverStyles, 'w-(--trigger-width)')}>
        <ListBox className={listStyles}>
          {options.map(option => <Option key={option.id} option={option} />)}
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
  const selected = options.find(option => option.id === value);
  const name = typeof label === 'string' ? label : placeholder;

  const visible = useMemo(() => options.filter(option => contains(option.label, query)), [contains, options, query]);
  const canCreate = !!onCreate && !!query.trim() && !options.some(option => option.label.toLowerCase() === query.trim().toLowerCase());
  const pick = (key: Key | null) => {
    if (key === '__create') onCreate?.(query.trim());
    else onChange(key === null ? null : String(key));
    setOpen(false);
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
            <AriaButton className={triggerRow} onPress={() => setOpen(true)}>
              <span className={cn('min-w-0 truncate', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
              <Icon name="expand_more" size={20} className="shrink-0 text-muted" />
            </AriaButton>
          </FieldShell>
        </AriaSelect>
        <BottomSheet isOpen={isOpen} onClose={() => setOpen(false)} title={name} height="full">
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
            className="outline-none"
          >
            {createRow}
            {visible.map(option => <Option key={option.id} option={option} />)}
          </ListBox>
        </BottomSheet>
      </div>
    );
  }

  return (
    <ComboBox
      selectedKey={value}
      onSelectionChange={pick}
      inputValue={isOpen ? query : selected?.label ?? ''}
      onInputChange={text => { setQuery(text); setOpen(true); }}
      onOpenChange={open => { setOpen(open); if (open) setQuery(''); }}
      menuTrigger="focus"
      allowsEmptyCollection
      isDisabled={isDisabled}
      isInvalid={!!error}
      className={className}
    >
      <FieldShell label={label} help={help} error={error} autofill={autofill}>
        <div className="relative">
          <Input placeholder={placeholder} className={cn(controlStyles, 'h-11 pl-3 pr-10 text-[.9375rem] font-medium')} />
          <AriaButton aria-label="Show options" className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted">
            <Icon name="expand_more" size={20} />
          </AriaButton>
        </div>
      </FieldShell>
      <AriaPopover offset={6} className={cn(popoverStyles, 'w-(--trigger-width)')}>
        <ListBox className={listStyles} renderEmptyState={empty}>
          {createRow}
          {visible.map(option => <Option key={option.id} option={option} />)}
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
      className={isPhone ? 'outline-none' : listStyles}
    >
      {options.map(option => <Option key={option.id} option={option} multi />)}
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
          <AriaDialog aria-label={name} className="outline-none">{list}</AriaDialog>
        </AriaPopover>
      )}
    </div>
  );
};

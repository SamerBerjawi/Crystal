import React from 'react';
import {
  Button as AriaButton,
  Calendar,
  CalendarCell,
  CalendarGrid,
  Checkbox as AriaCheckbox,
  DateInput as AriaDateInput,
  DatePicker,
  DateRangePicker,
  DateSegment,
  Dialog as AriaDialog,
  FieldError,
  Group,
  Heading,
  Input,
  Label,
  Popover as AriaPopover,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  RangeCalendar,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Switch as AriaSwitch,
  Text,
  TextArea,
  TextField,
} from 'react-aria-components';
import { parseDate, type DateValue } from '@internationalized/date';
import Icon from './Icon';
import { popoverStyles } from './Overlays';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

export const controlStyles =
  'w-full rounded-[var(--radius-md)] border border-line-strong bg-inset text-ink outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-muted data-[invalid]:border-money-out data-[disabled]:opacity-50 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus';

const inputSize = 'h-11 px-3 text-[.9375rem] font-medium max-md:h-12 max-md:text-base';

export interface FieldProps {
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: string;
  /** "Filled from Merchant", with Undo. Marks a value Crystal filled in for you. */
  autofill?: { source: string; onUndo?: () => void };
  className?: string;
}

/** Label above, help or error below, for any control inside a React Aria field. */
export const FieldShell: React.FC<Omit<FieldProps, 'className'> & { children: React.ReactNode }> = ({ label, help, error, autofill, children }) => (
  <>
    <Label className="type-label mb-1.5 block text-ink">{label}</Label>
    {children}
    {autofill && (
      <p className="type-caption mt-1.5 flex items-center gap-1.5 text-muted">
        <Icon name="auto_awesome" size={16} />
        Filled from {autofill.source}
        {autofill.onUndo && (
          <button type="button" onClick={autofill.onUndo} className="cursor-pointer font-bold text-primary underline underline-offset-2">Undo</button>
        )}
      </p>
    )}
    {help && !error && <Text slot="description" className="type-caption mt-1.5 block text-muted">{help}</Text>}
    <FieldError className="type-caption mt-1.5 flex items-center gap-1.5 text-money-out">
      <Icon name="error_outline" size={16} />
      {error}
    </FieldError>
  </>
);

type TextProps = FieldProps & Omit<React.ComponentProps<typeof TextField>, 'children' | 'className' | 'isInvalid'> & {
  placeholder?: string;
  inputClassName?: string;
};

/** Text, search and password fields. */
export const TextInput: React.FC<TextProps> = ({ label, help, error, autofill, className, placeholder, inputClassName, ...props }) => (
  <TextField {...props} isInvalid={!!error} className={className}>
    <FieldShell label={label} help={help} error={error} autofill={autofill}>
      <Input placeholder={placeholder} className={cn(controlStyles, inputSize, inputClassName)} />
    </FieldShell>
  </TextField>
);

type AmountProps = Omit<TextProps, 'type' | 'inputMode'> & { currency?: string };

/** Right-aligned tabular amount with a currency prefix. */
export const AmountInput: React.FC<AmountProps> = ({ label, help, error, autofill, className, placeholder = '0.00', currency, ...props }) => (
  <TextField {...props} inputMode="decimal" isInvalid={!!error} className={className}>
    <FieldShell label={label} help={help} error={error} autofill={autofill}>
      <div className="relative">
        {currency && (
          <span className="type-body pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">{currency}</span>
        )}
        <Input
          placeholder={placeholder}
          className={cn(controlStyles, inputSize, 'text-right font-semibold tabular-nums', currency && 'pl-12')}
        />
      </div>
    </FieldShell>
  </TextField>
);

type AreaProps = FieldProps & Omit<React.ComponentProps<typeof TextField>, 'children' | 'className' | 'isInvalid'> & { placeholder?: string; rows?: number };

export const Textarea: React.FC<AreaProps> = ({ label, help, error, autofill, className, placeholder, rows = 3, ...props }) => (
  <TextField {...props} isInvalid={!!error} className={className}>
    <FieldShell label={label} help={help} error={error} autofill={autofill}>
      <TextArea rows={rows} placeholder={placeholder} className={cn(controlStyles, 'resize-y px-3 py-2.5 text-[.9375rem] font-medium max-md:text-base')} />
    </FieldShell>
  </TextField>
);

const dayCell =
  'flex size-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-ink outline-none data-[outside-month]:invisible data-[hovered]:bg-inset data-[disabled]:opacity-40 data-[selected]:bg-primary data-[selected]:text-on-primary data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus';

const CalendarHeader = () => (
  <header className="mb-2 flex items-center justify-between">
    <AriaButton slot="previous" aria-label="Previous month" className="flex size-10 cursor-pointer items-center justify-center rounded-full text-ink data-[hovered]:bg-inset">
      <Icon name="ChevronLeft" size={20} />
    </AriaButton>
    <Heading className="type-body-strong text-ink" />
    <AriaButton slot="next" aria-label="Next month" className="flex size-10 cursor-pointer items-center justify-center rounded-full text-ink data-[hovered]:bg-inset">
      <Icon name="ChevronRight" size={20} />
    </AriaButton>
  </header>
);

const segments = (
  <AriaDateInput className="flex flex-1 items-center gap-px">
    {segment => (
      <DateSegment
        segment={segment}
        className="rounded-sm px-0.5 tabular-nums outline-none data-[placeholder]:text-muted data-[focused]:bg-primary data-[focused]:text-on-primary"
      />
    )}
  </AriaDateInput>
);

const toValue = (value?: string | null): DateValue | null => {
  if (!value) return null;
  try { return parseDate(value.slice(0, 10)); } catch { return null; }
};

const CalendarButton = () => (
  <AriaButton aria-label="Open calendar" className="ml-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted data-[hovered]:bg-surface">
    <Icon name="calendar_today" size={20} />
  </AriaButton>
);

export interface DateInputProps extends FieldProps {
  /** `YYYY-MM-DD`, as Crystal stores dates. */
  value?: string | null;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  isRequired?: boolean;
}

/** A calendar popover, and the native date picker on phones. */
export const DateInput: React.FC<DateInputProps> = ({ label, help, error, autofill, className, value, onChange, isDisabled, isRequired }) => {
  const isPhone = useIsMobile();

  if (isPhone) {
    return (
      <TextField value={value ?? ''} onChange={onChange} type="date" isDisabled={isDisabled} isRequired={isRequired} isInvalid={!!error} className={className}>
        <FieldShell label={label} help={help} error={error} autofill={autofill}>
          <Input className={cn(controlStyles, inputSize)} />
        </FieldShell>
      </TextField>
    );
  }

  return (
    <DatePicker
      value={toValue(value)}
      onChange={(next: DateValue | null) => onChange(next ? next.toString() : '')}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={!!error}
      className={className}
    >
      <FieldShell label={label} help={help} error={error} autofill={autofill}>
        <Group className={cn(controlStyles, inputSize, 'flex items-center')}>
          {segments}
          <CalendarButton />
        </Group>
      </FieldShell>
      <AriaPopover placement="bottom start" offset={8} className={cn(popoverStyles, 'p-3')}>
        <AriaDialog className="outline-none">
          <Calendar>
            <CalendarHeader />
            <CalendarGrid>{date => <CalendarCell date={date} className={dayCell} />}</CalendarGrid>
          </Calendar>
        </AriaDialog>
      </AriaPopover>
    </DatePicker>
  );
};

export interface DateRange { start: string; end: string }

/** Two dates, with one calendar. Phones use two native pickers. */
export const DateRangeInput: React.FC<Omit<DateInputProps, 'value' | 'onChange'> & { value?: DateRange | null; onChange: (value: DateRange | null) => void }> = ({ label, help, error, className, value, onChange, isDisabled }) => {
  const isPhone = useIsMobile();

  if (isPhone) {
    return (
      <div className={cn('grid grid-cols-2 gap-3', className)}>
        <DateInput label="From" value={value?.start} isDisabled={isDisabled} onChange={start => onChange({ start, end: value?.end ?? start })} error={error} />
        <DateInput label="To" value={value?.end} isDisabled={isDisabled} onChange={end => onChange({ start: value?.start ?? end, end })} />
      </div>
    );
  }

  const start = toValue(value?.start);
  const end = toValue(value?.end);

  return (
    <DateRangePicker
      value={start && end ? ({ start, end } as never) : null}
      onChange={next => onChange(next ? { start: next.start.toString(), end: next.end.toString() } : null)}
      isDisabled={isDisabled}
      isInvalid={!!error}
      className={className}
    >
      <FieldShell label={label} help={help} error={error}>
        <Group className={cn(controlStyles, inputSize, 'flex items-center gap-1')}>
          <AriaDateInput slot="start" className="flex items-center gap-px">
            {segment => <DateSegment segment={segment} className="rounded-sm px-0.5 tabular-nums outline-none data-[placeholder]:text-muted data-[focused]:bg-primary data-[focused]:text-on-primary" />}
          </AriaDateInput>
          <span aria-hidden="true" className="text-muted">to</span>
          <AriaDateInput slot="end" className="flex flex-1 items-center gap-px">
            {segment => <DateSegment segment={segment} className="rounded-sm px-0.5 tabular-nums outline-none data-[placeholder]:text-muted data-[focused]:bg-primary data-[focused]:text-on-primary" />}
          </AriaDateInput>
          <CalendarButton />
        </Group>
      </FieldShell>
      <AriaPopover placement="bottom start" offset={8} className={cn(popoverStyles, 'p-3')}>
        <AriaDialog className="outline-none">
          <RangeCalendar>
            <CalendarHeader />
            <CalendarGrid>{date => <CalendarCell date={date} className={cn(dayCell, 'data-[selection-start]:rounded-full')} />}</CalendarGrid>
          </RangeCalendar>
        </AriaDialog>
      </AriaPopover>
    </DateRangePicker>
  );
};

const choiceRow = 'group flex min-h-6 cursor-pointer items-center gap-2.5 pointer-coarse:min-h-11 max-md:w-full data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';
const choiceFocus = 'group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-focus';

type CheckboxProps = Omit<React.ComponentProps<typeof AriaCheckbox>, 'children' | 'className'> & { children: React.ReactNode; className?: string };

/** For choices that are saved with a form. */
export const Checkbox: React.FC<CheckboxProps> = ({ children, className, ...props }) => (
  <AriaCheckbox {...props} className={cn(choiceRow, className)}>
    {({ isSelected, isIndeterminate }) => (
      <>
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-line-strong bg-surface text-on-primary transition-colors duration-[var(--duration-fast)]', (isSelected || isIndeterminate) && 'border-primary bg-primary', choiceFocus)}>
          {isSelected && <Icon name="check" size={16} weight="bold" />}
          {isIndeterminate && !isSelected && <span className="h-0.5 w-2.5 rounded-full bg-on-primary" />}
        </span>
        <span className="type-body min-w-0 text-ink">{children}</span>
      </>
    )}
  </AriaCheckbox>
);

export const RadioGroup: React.FC<Omit<React.ComponentProps<typeof AriaRadioGroup>, 'children' | 'className'> & { label: React.ReactNode; children: React.ReactNode; className?: string }> = ({ label, children, className, ...props }) => (
  <AriaRadioGroup {...props} className={className}>
    <Label className="type-label mb-1.5 block text-ink">{label}</Label>
    <div className="flex flex-col gap-1">{children}</div>
  </AriaRadioGroup>
);

export const Radio: React.FC<Omit<React.ComponentProps<typeof AriaRadio>, 'children' | 'className'> & { children: React.ReactNode }> = ({ children, ...props }) => (
  <AriaRadio {...props} className={choiceRow}>
    {({ isSelected }) => (
      <>
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface', isSelected && 'border-primary', choiceFocus)}>
          {isSelected && <span className="size-2.5 rounded-full bg-primary" />}
        </span>
        <span className="type-body min-w-0 text-ink">{children}</span>
      </>
    )}
  </AriaRadio>
);

/** For settings that apply at once. */
export const Switch: React.FC<Omit<React.ComponentProps<typeof AriaSwitch>, 'children' | 'className'> & { children: React.ReactNode; className?: string }> = ({ children, className, ...props }) => (
  <AriaSwitch {...props} className={cn(choiceRow, 'justify-between', className)}>
    {({ isSelected }) => (
      <>
        <span className="type-body min-w-0 text-ink">{children}</span>
        <span className={cn('flex h-6 w-10 shrink-0 items-center rounded-full border border-line-strong bg-inset p-0.5 transition-colors duration-[var(--duration-fast)]', isSelected && 'border-primary bg-primary', choiceFocus)}>
          <span className={cn('size-[18px] rounded-full bg-line-strong transition-transform duration-[var(--duration-fast)]', isSelected && 'translate-x-4 bg-on-primary')} />
        </span>
      </>
    )}
  </AriaSwitch>
);

export const Slider: React.FC<Omit<React.ComponentProps<typeof AriaSlider<number>>, 'children' | 'className'> & { label: React.ReactNode; className?: string }> = ({ label, className, ...props }) => (
  <AriaSlider {...props} className={className}>
    <div className="mb-1.5 flex items-center justify-between">
      <Label className="type-label text-ink">{label}</Label>
      <SliderOutput className="type-label text-ink tabular-nums" />
    </div>
    <SliderTrack className="relative h-11 w-full">
      {({ state }) => (
        <>
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
          <span className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary" style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
          <SliderThumb className="top-1/2 size-6 cursor-grab rounded-full border-2 border-primary bg-surface shadow-sm data-[dragging]:cursor-grabbing data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus" />
        </>
      )}
    </SliderTrack>
  </AriaSlider>
);

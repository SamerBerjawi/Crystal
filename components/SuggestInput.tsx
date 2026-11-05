import React, { useEffect, useId, useRef, useState } from 'react';
import { controlStyles } from './ui/Fields';
import { popoverStyles } from './ui/Overlays';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';

export interface Suggestion {
  id: string;
  title: string;
  subtitle?: string;
  /** Short kind, such as Business or City, read out and shown in small type. */
  kind?: string;
  icon?: string;
}

interface SuggestInputProps {
  value: string;
  /** Every keystroke. The field also calls it with '' when cleared. */
  onType: (text: string) => void;
  onPick: (id: string) => void;
  /** Called with whether the field is in use, so searches only run while it is. */
  onActiveChange?: (isActive: boolean) => void;
  suggestions: Suggestion[];
  isFetching?: boolean;
  icon: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A text field with suggestions as you type, for places and addresses. It follows the ARIA combobox pattern:
 * arrows move through the list, Enter picks, Escape closes.
 */
const SuggestInput: React.FC<SuggestInputProps> = ({ value, onType, onPick, onActiveChange, suggestions, isFetching, icon, label, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const canOpen = value.trim().length >= 2 && suggestions.length > 0;
  const shown = isOpen && canOpen;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlighted(-1);
        onActiveChange?.(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onActiveChange]);

  const pick = (index: number) => {
    onPick(suggestions[index].id);
    setIsOpen(false);
    setHighlighted(-1);
    onActiveChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(i => (i < suggestions.length - 1 ? i + 1 : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(i => (i > 0 ? i - 1 : suggestions.length - 1)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); pick(highlighted); }
    else if (e.key === 'Escape') { e.stopPropagation(); setIsOpen(false); setHighlighted(-1); }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={shown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown && highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          value={value}
          disabled={disabled}
          onChange={e => { onType(e.target.value); setIsOpen(true); setHighlighted(-1); onActiveChange?.(true); }}
          onFocus={() => { onActiveChange?.(true); setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          className={cn(controlStyles, 'h-11 pl-9 pr-14 text-[.9375rem] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] max-md:h-12 max-md:text-base')}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <Icon name={icon} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {isFetching && <Icon name="loading-03" size={16} className="animate-spin text-muted" aria-label="Searching" />}
          {value && !disabled && (
            <button
              type="button"
              onClick={() => { onType(''); setIsOpen(false); inputRef.current?.focus(); }}
              className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-inset hover:text-ink pointer-coarse:size-11"
              aria-label={`Clear ${label.toLowerCase()}`}
            >
              <Icon name="cancel-01" size={16} />
            </button>
          )}
        </div>
      </div>

      {shown && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className={cn(popoverStyles, 'absolute left-0 top-full z-[var(--z-popover)] mt-1.5 max-h-60 w-full overflow-y-auto p-1.5')}>
          {suggestions.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={highlighted === index}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(index)}
              onMouseEnter={() => setHighlighted(index)}
              className={cn('flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-ink', highlighted === index && 'bg-inset')}
            >
              <Icon name={item.icon || icon} size={16} className="mt-0.5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="type-body-strong block truncate">{item.title}</span>
                {(item.kind || item.subtitle) && (
                  <span className="type-caption block truncate text-muted">{[item.kind, item.subtitle].filter(Boolean).join(' · ')}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SuggestInput;

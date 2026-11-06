import React from 'react';
import { CARD_COLORS, CARD_PATTERNS, patternStyle, type CardShade, type CardStyleChoice } from '../utils/cardStyle';
import { cn } from '../lib/utils';

interface CardStylePickerProps {
  value: CardStyleChoice;
  onChange: (next: CardStyleChoice) => void;
}

/** Ten colours in two shades each, and a handful of patterns. Choosing none of the colours keeps the account type's own. */
const CardStylePicker: React.FC<CardStylePickerProps> = ({ value, onChange }) => {
  const shade: CardShade = value.shade === 'light' ? 'light' : 'dark';
  const pattern = value.pattern ?? 'none';
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="type-label mb-2 text-muted">Colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={!value.color}
            aria-label="Account default colour"
            title="Account default"
            onClick={() => onChange({ ...value, color: undefined, shade: undefined })}
            className={cn('type-caption flex size-9 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-inset text-muted', !value.color && 'ring-2 ring-pill ring-offset-2 ring-offset-[var(--solid)]')}
          >
            Auto
          </button>
          {CARD_COLORS.map(color => (
            <button
              key={color.id}
              type="button"
              aria-pressed={value.color === color.id}
              aria-label={`${color.label}, ${shade} shade`}
              title={color.label}
              onClick={() => onChange({ ...value, color: color.id, shade })}
              className={cn('size-9 cursor-pointer rounded-full border border-black/10', value.color === color.id && 'ring-2 ring-pill ring-offset-2 ring-offset-[var(--solid)]')}
              style={{ background: color[shade] }}
            />
          ))}
        </div>
        <div className="mt-3 inline-flex rounded-full bg-inset p-0.5" role="group" aria-label="Shade">
          {(['light', 'dark'] as const).map(item => (
            <button
              key={item}
              type="button"
              disabled={!value.color}
              aria-pressed={shade === item && !!value.color}
              onClick={() => onChange({ ...value, shade: item })}
              className={cn('type-caption min-h-8 cursor-pointer rounded-full px-4 capitalize text-muted disabled:cursor-not-allowed disabled:opacity-50', shade === item && value.color && 'bg-[var(--solid)] text-ink shadow-sm')}
            >
              {item}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="type-label mb-2 text-muted">Pattern</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {CARD_PATTERNS.map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={pattern === item.id}
              onClick={() => onChange({ ...value, pattern: item.id === 'none' ? undefined : item.id })}
              className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-md)] p-1.5 text-muted hover:bg-inset', pattern === item.id && 'bg-inset text-ink ring-2 ring-pill')}
            >
              <span className="relative block h-9 w-full overflow-hidden rounded-[6px] border border-black/10 bg-[#2E3440]">
                <span aria-hidden className="absolute inset-0" style={patternStyle(item.id, 'dark')} />
              </span>
              <span className="type-caption">{item.label}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
};

export default CardStylePicker;

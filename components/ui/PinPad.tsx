import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { PIN_LENGTH, pinAfterKey } from '../../utils/lockModel';
import Icon from './Icon';

interface PinPadProps {
  pin: string;
  onChange: (pin: string) => void;
  isDisabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const keyStyles = 'flex size-[72px] cursor-pointer items-center justify-center rounded-full text-2xl font-semibold text-ink outline-none transition-colors hover:bg-inset focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

/** Four dots and a keypad. The physical keyboard works too. */
const PinPad: React.FC<PinPadProps> = ({ pin, onChange, isDisabled }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isDisabled || event.metaKey || event.ctrlKey || event.altKey) return;
      const next = pinAfterKey(pin, event.key);
      if (next !== pin) {
        event.preventDefault();
        onChange(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDisabled, onChange, pin]);

  const press = (key: string) => onChange(pinAfterKey(pin, key));

  return (
    <div className="flex flex-col items-center gap-6">
      <div role="status" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`} className="flex h-4 items-center gap-3">
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span key={index} aria-hidden="true" className={cn('size-3.5 rounded-full border border-line-strong transition-colors', index < pin.length && 'border-transparent bg-ink')} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map(key => <button key={key} type="button" disabled={isDisabled} onClick={() => press(key)} className={keyStyles}>{key}</button>)}
        <span aria-hidden="true" />
        <button type="button" disabled={isDisabled} onClick={() => press('0')} className={keyStyles}>0</button>
        <button type="button" disabled={isDisabled || !pin} aria-label="Delete last digit" onClick={() => press('Backspace')} className={keyStyles}>
          <Icon name="arrow_back" size={24} />
        </button>
      </div>
    </div>
  );
};

export default PinPad;

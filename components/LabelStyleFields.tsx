import React, { useState } from 'react';
import { CATEGORY_ICON_LIST, CATEGORY_TAG_PRESET_COLORS } from '../constants';
import { cn } from '../lib/utils';
import IconPicker from './IconPicker';
import { Button } from './ui/Actions';
import Icon from './ui/Icon';

interface LabelStyleFieldsProps {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}

/** The icon and colour shared by categories and tags. */
const LabelStyleFields: React.FC<LabelStyleFieldsProps> = ({ icon, color, onIconChange, onColorChange }) => {
  const [isPicking, setPicking] = useState(false);

  return (
    <>
      <div>
        <p className="type-label mb-1.5 text-ink">Icon</p>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]" style={{ backgroundColor: `${color}26`, color }}>
            <Icon name={icon} size={24} />
          </span>
          <Button variant="secondary" size="sm" onPress={() => setPicking(true)}>Change icon</Button>
        </div>
      </div>
      <div>
        <p className="type-label mb-1.5 text-ink">Colour</p>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_TAG_PRESET_COLORS.map(preset => (
            <button
              key={preset}
              type="button"
              aria-label={`Colour ${preset}`}
              aria-pressed={preset === color}
              onClick={() => onColorChange(preset)}
              className={cn('size-8 cursor-pointer rounded-full outline-none ring-offset-2 ring-offset-solid focus-visible:ring-2 focus-visible:ring-primary', preset === color && 'ring-2 ring-ink')}
              style={{ backgroundColor: preset }}
            />
          ))}
          <input type="color" aria-label="Custom colour" value={color} onChange={event => onColorChange(event.target.value)} className="size-8 cursor-pointer rounded-full border border-line bg-transparent" />
        </div>
      </div>
      {isPicking && <IconPicker onClose={() => setPicking(false)} onSelect={onIconChange} iconList={CATEGORY_ICON_LIST} selectedIcon={icon} />}
    </>
  );
};

export default LabelStyleFields;

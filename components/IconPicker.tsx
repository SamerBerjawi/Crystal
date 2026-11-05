import React, { useMemo, useState, useDeferredValue } from 'react';
import { SidePanel } from './ui/Overlays';
import { TextInput } from './ui/Fields';
import { Select } from './ui/Pickers';
import { EmptyState } from './ui/States';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';
import {
  PHOSPHOR_CATEGORIES,
  PhosphorCategory,
  searchPhosphorIcons,
  groupIconsByCategory,
  PhosphorIconItem,
} from '../utils/phosphorIcons';

interface IconPickerProps {
  onClose: () => void;
  onSelect: (icon: string) => void;
  iconList?: string[];
  selectedIcon?: string;
}

const ICON_GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-4';

const IconTile: React.FC<{ item: PhosphorIconItem; isCurrent: boolean; onPick: (name: string) => void }> = ({ item, isCurrent, onPick }) => (
  <button
    type="button"
    aria-pressed={isCurrent}
    title={`${item.label}, ${item.category}`}
    onClick={() => onPick(item.name)}
    className={cn(
      'flex min-h-[5.5rem] flex-col items-center justify-start gap-1.5 rounded-[var(--radius-md)] border p-2 text-ink outline-hidden transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] pointer-coarse:min-h-24',
      isCurrent ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-inset'
    )}
  >
    <Icon name={item.name} size={28} aria-hidden />
    <span className="type-caption line-clamp-2 w-full break-words text-center">{item.label}</span>
  </button>
);

/** Pick an icon by searching, or by browsing a category. Saved icon names are unchanged. */
const IconPicker: React.FC<IconPickerProps> = ({ onClose, onSelect, selectedIcon }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PhosphorCategory>('View all');
  const deferredSearch = useDeferredValue(searchTerm);

  const filteredIcons = useMemo(() => searchPhosphorIcons(deferredSearch, selectedCategory), [deferredSearch, selectedCategory]);
  const groupedSections = useMemo(() => (selectedCategory === 'View all' ? groupIconsByCategory(filteredIcons) : null), [selectedCategory, filteredIcons]);

  const categoryOptions = useMemo(
    () => PHOSPHOR_CATEGORIES.map(category => ({ id: category, label: `${category} (${searchPhosphorIcons(deferredSearch, category).length})` })),
    [deferredSearch]
  );

  const pick = (name: string) => {
    onSelect(name);
    onClose();
  };

  const isCurrent = (item: PhosphorIconItem) =>
    !!selectedIcon && (selectedIcon.toLowerCase() === item.name.toLowerCase() || selectedIcon.toLowerCase() === item.label.toLowerCase());

  return (
    <SidePanel isOpen onClose={onClose} title="Choose an icon" width={640}>
      <div className="flex flex-col gap-4">
        <div className="sticky top-0 z-[var(--z-sticky)] -mx-1 grid gap-3 bg-solid px-1 pb-3 sm:grid-cols-2">
          <TextInput label="Search" type="search" value={searchTerm} onChange={setSearchTerm} placeholder="Wallet, card, home" autoFocus />
          <Select label="Category" options={categoryOptions} value={selectedCategory} onChange={id => setSelectedCategory(id as PhosphorCategory)} />
        </div>

        {filteredIcons.length === 0 ? (
          <EmptyState
            icon="search-01"
            title={`No icons match "${searchTerm}"`}
            description="Try another word, or search every category."
            actionLabel={selectedCategory !== 'View all' ? 'Search every category' : undefined}
            onAction={selectedCategory !== 'View all' ? () => setSelectedCategory('View all') : undefined}
          />
        ) : groupedSections ? (
          groupedSections.map(group => (
            <section key={group.category} aria-label={group.category} className="flex flex-col gap-2">
              <h3 className="type-label text-muted">{group.category} <span className="font-normal">({group.icons.length})</span></h3>
              <div className={ICON_GRID}>
                {group.icons.map(item => <IconTile key={item.name} item={item} isCurrent={isCurrent(item)} onPick={pick} />)}
              </div>
            </section>
          ))
        ) : (
          <div className={ICON_GRID}>
            {filteredIcons.map(item => <IconTile key={item.name} item={item} isCurrent={isCurrent(item)} onPick={pick} />)}
          </div>
        )}
      </div>
    </SidePanel>
  );
};

export default IconPicker;

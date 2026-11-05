import React, { useEffect, useState } from 'react';
import { Category } from '../types';
import { CATEGORY_TAG_PRESET_COLORS } from '../constants';
import LabelStyleFields from './LabelStyleFields';
import { Button } from './ui/Actions';
import { TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Category, parentId?: string) => void;
  category: Category | null;
  parentId?: string;
  mode: 'add' | 'edit';
  classification: 'income' | 'expense';
}

const DEFAULT_ICON = 'category';
const randomColor = () => CATEGORY_TAG_PRESET_COLORS[Math.floor(Math.random() * CATEGORY_TAG_PRESET_COLORS.length)];

const CATEGORY_CLASSIFICATION_TABS: SwipeTabItem[] = [
  {
    id: 'expense',
    title: 'Expense',
    icon: () => <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="shrink-0" />,
    activeColor: 'bg-money-out',
    activeTextColor: 'text-on-danger',
  },
  {
    id: 'income',
    title: 'Income',
    icon: () => <HugeiconsIcon icon={ArrowUp01Icon} size={16} className="shrink-0" />,
    activeColor: 'bg-money-in',
    activeTextColor: 'text-on-primary',
  },
];

const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, onSave, category, parentId, mode, classification: initialClassification }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(randomColor);
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [classification, setClassification] = useState(initialClassification);

  useEffect(() => {
    setName(category?.name ?? '');
    setColor(category?.color || randomColor());
    setIcon(category?.icon || DEFAULT_ICON);
    setClassification(category?.classification ?? initialClassification);
  }, [category, initialClassification, isOpen]);

  const isDirty = name !== (category?.name ?? '') || (mode === 'edit' && (color !== category?.color || icon !== category?.icon));
  const title = mode === 'edit' ? 'Edit category' : parentId ? 'New sub-category' : 'New category';

  const save = () => {
    if (!name.trim()) return;
    onSave({ id: category?.id || '', name: name.trim(), color, icon, classification, subCategories: category?.subCategories || [], parentId }, parentId);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      isDirty={isDirty}
      title={title}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={!name.trim()} onPress={save}>{mode === 'edit' ? 'Save category' : 'Add category'}</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        {mode === 'add' && !parentId && (
          <SmoothTab
            fullWidth
            className="w-full"
            items={CATEGORY_CLASSIFICATION_TABS}
            value={classification}
            onChange={id => setClassification(id as 'income' | 'expense')}
            label="Category classification"
          />
        )}
        <TextInput label="Name" autoFocus isRequired value={name} onChange={setName} />
        <LabelStyleFields icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
      </div>
    </SidePanel>
  );
};

export default CategoryModal;

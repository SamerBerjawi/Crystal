import React, { useMemo, useState } from 'react';
import { Category } from '../types';
import { categoryPickerOptions } from '../utils/categoryTree';
import { Button } from './ui/Actions';
import { Dialog } from './ui/Overlays';
import { Combobox } from './ui/Pickers';

interface BulkCategorizeModalProps {
  onClose: () => void;
  onSave: (newCategory: string) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
}

const BulkCategorizeModal: React.FC<BulkCategorizeModalProps> = ({ onClose, onSave, incomeCategories, expenseCategories }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(() => categoryPickerOptions(expenseCategories, incomeCategories), [expenseCategories, incomeCategories]);

  const save = () => {
    if (!selected) return;
    onSave(selected);
    onClose();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Assign a category"
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={!selected} onPress={save}>Assign</Button>
        </div>
      )}
    >
      <Combobox label="Category" options={options} value={selected} onChange={setSelected} placeholder="Search categories" />
    </Dialog>
  );
};

export default BulkCategorizeModal;

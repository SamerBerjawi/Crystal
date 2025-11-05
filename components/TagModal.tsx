import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Tag } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CATEGORY_ICON_LIST } from '../constants';
import IconPicker from './IconPicker';

interface TagModalProps {
  onClose: () => void;
  onSave: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
  tagToEdit?: Tag | null;
}

const TagModal: React.FC<TagModalProps> = ({ onClose, onSave, tagToEdit }) => {
  const isEditing = !!tagToEdit;
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('label');
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (tagToEdit) {
      setName(tagToEdit.name);
      setColor(tagToEdit.color);
      setIcon(tagToEdit.icon);
    }
  }, [tagToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({ id: tagToEdit?.id, name, color, icon });
    onClose();
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  const title = isEditing ? 'Edit Tag' : 'Create New Tag';

  return (
    <>
      {isIconPickerOpen && (
        <IconPicker 
          onClose={() => setIconPickerOpen(false)} 
          onSelect={setIcon} 
          iconList={CATEGORY_ICON_LIST} 
        />
      )}
      <Modal onClose={onClose} title={title}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-grow">
              <label htmlFor="tag-name" className={labelStyle}>Tag Name</label>
              <input
                id="tag-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_BASE_STYLE}
                required
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-lg shadow-neu-raised-light dark:shadow-neu-raised-dark hover:shadow-neu-inset-light dark:hover:shadow-neu-inset-dark transition-shadow text-primary-500"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color }}>
                {icon}
              </span>
            </button>
            <div
              className="relative flex-shrink-0 w-10 h-10 rounded-lg border border-black/10 dark:border-white/10 overflow-hidden cursor-pointer"
              style={{ backgroundColor: color }}
              title="Select color"
            >
              <label htmlFor="tag-color" className="sr-only">Select color</label>
              <input
                id="tag-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
            <button type="submit" className={BTN_PRIMARY_STYLE}>Save</button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default TagModal;

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Tag } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CATEGORY_ICON_LIST, CATEGORY_TAG_PRESET_COLORS } from '../constants';
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
    } else {
      setName('');
      setColor(CATEGORY_TAG_PRESET_COLORS[Math.floor(Math.random() * CATEGORY_TAG_PRESET_COLORS.length)]);
      setIcon('label');
    }
  }, [tagToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({ id: tagToEdit?.id, name, color, icon });
    onClose();
  };

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
        <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Name Input */}
            <div>
                <label htmlFor="tag-name" className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">
                    Tag Name
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-light-text-secondary dark:text-dark-text-secondary font-bold text-lg">#</span>
                    </div>
                    <input
                        id="tag-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`${INPUT_BASE_STYLE} !pl-8 !text-lg font-medium`}
                        placeholder="vacation"
                        required
                        autoFocus
                    />
                </div>
            </div>

            {/* Appearance Section */}
            <div>
                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">
                    Style & Icon
                </label>
                
                <div className="flex flex-col gap-4">
                     {/* Preview */}
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-2">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider font-semibold">Preview</span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm transition-all duration-300" style={{ backgroundColor: `${color}20`, color: color }}>
                            <span className="material-symbols-outlined text-lg">{icon}</span>
                            {name || 'Tag Name'}
                        </span>
                    </div>

                    <div className="flex items-start gap-4 mt-2">
                        {/* Icon Button */}
                        <button
                            type="button"
                            onClick={() => setIconPickerOpen(true)}
                            className="flex-shrink-0 w-12 h-12 bg-light-bg dark:bg-dark-bg rounded-xl flex items-center justify-center border border-black/10 dark:border-white/10 hover:border-primary-500 transition-colors group"
                            title="Change Icon"
                        >
                            <span className="material-symbols-outlined text-2xl text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 transition-colors">{icon}</span>
                        </button>

                        {/* Color Grid */}
                        <div className="flex-1 grid grid-cols-6 sm:grid-cols-7 gap-2">
                            {CATEGORY_TAG_PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none ${color === c ? 'ring-2 ring-offset-2 ring-offset-light-card dark:ring-offset-dark-card ring-primary-500 scale-110' : ''}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                             {/* Custom Color Input Wrapper */}
                            <div className="relative w-8 h-8 rounded-full overflow-hidden cursor-pointer hover:scale-110 transition-transform bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-xs">colorize</span>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                <button type="submit" className={BTN_PRIMARY_STYLE}>Save Tag</button>
            </div>
        </form>
      </Modal>
    </>
  );
};

export default TagModal;

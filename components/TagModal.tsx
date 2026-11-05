import React, { useState } from 'react';
import { Tag } from '../types';
import { CATEGORY_TAG_PRESET_COLORS } from '../constants';
import LabelStyleFields from './LabelStyleFields';
import { Button } from './ui/Actions';
import { TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';

interface TagModalProps {
  onClose: () => void;
  onSave: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
  tagToEdit?: Tag | null;
  existingTags?: Tag[];
}

const TagModal: React.FC<TagModalProps> = ({ onClose, onSave, tagToEdit, existingTags = [] }) => {
  const [isOpen, setOpen] = useState(true);
  const [name, setName] = useState(tagToEdit?.name ?? '');
  const [color, setColor] = useState(() => tagToEdit?.color ?? CATEGORY_TAG_PRESET_COLORS[Math.floor(Math.random() * CATEGORY_TAG_PRESET_COLORS.length)]);
  const [icon, setIcon] = useState(tagToEdit?.icon ?? 'label');
  const [error, setError] = useState<string | undefined>();

  const normalizedName = name.trim().replace(/^#/, '');
  const isDuplicate = existingTags.some(
    t => t.id !== tagToEdit?.id && t.name.trim().toLowerCase() === normalizedName.toLowerCase()
  );

  const isDirty = name !== (tagToEdit?.name ?? '') || (!!tagToEdit && (color !== tagToEdit.color || icon !== tagToEdit.icon));
  const close = () => { setOpen(false); onClose(); };
  const save = () => {
    if (!normalizedName) return;
    if (isDuplicate) {
      setError('A tag with this name already exists.');
      return;
    }
    onSave({ id: tagToEdit?.id, name: normalizedName, color, icon });
    close();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      isDirty={isDirty}
      title={tagToEdit ? 'Edit tag' : 'New tag'}
      footer={confirmClose => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={confirmClose}>Cancel</Button>
          <Button isDisabled={!normalizedName} onPress={save}>{tagToEdit ? 'Save tag' : 'Add tag'}</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <TextInput label="Name" autoFocus isRequired value={name} error={error} onChange={val => { setName(val); if (error) setError(undefined); }} />
        <LabelStyleFields icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
      </div>
    </SidePanel>
  );
};

export default TagModal;

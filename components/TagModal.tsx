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
}

const TagModal: React.FC<TagModalProps> = ({ onClose, onSave, tagToEdit }) => {
  const [isOpen, setOpen] = useState(true);
  const [name, setName] = useState(tagToEdit?.name ?? '');
  const [color, setColor] = useState(() => tagToEdit?.color ?? CATEGORY_TAG_PRESET_COLORS[Math.floor(Math.random() * CATEGORY_TAG_PRESET_COLORS.length)]);
  const [icon, setIcon] = useState(tagToEdit?.icon ?? 'label');

  const isDirty = name !== (tagToEdit?.name ?? '') || (!!tagToEdit && (color !== tagToEdit.color || icon !== tagToEdit.icon));
  const close = () => { setOpen(false); onClose(); };
  const save = () => {
    if (!name.trim()) return;
    onSave({ id: tagToEdit?.id, name: name.trim().replace(/^#/, ''), color, icon });
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
          <Button isDisabled={!name.trim()} onPress={save}>{tagToEdit ? 'Save tag' : 'Add tag'}</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <TextInput label="Name" autoFocus isRequired value={name} onChange={setName} />
        <LabelStyleFields icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
      </div>
    </SidePanel>
  );
};

export default TagModal;

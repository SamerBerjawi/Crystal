import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Membership } from '../types';
import { CATEGORY_ICON_LIST, CATEGORY_TAG_PRESET_COLORS } from '../constants';
import { cn } from '../lib/utils';
import IconPicker from './IconPicker';
import { Button } from './ui/Actions';
import { DateInput, Textarea, TextInput } from './ui/Fields';
import Icon from './ui/Icon';
import { SidePanel } from './ui/Overlays';
import { Select } from './ui/Pickers';

interface MembershipModalProps {
  onClose: () => void;
  onSave: (membership: Omit<Membership, 'id'> & { id?: string }) => void;
  membershipToEdit?: Membership | null;
}

const MEMBERSHIP_CATEGORIES = ['Retail', 'Airline', 'Hotel', 'Grocery', 'Dining', 'Health', 'Services', 'Other'];
const EMPTY = { provider: '', memberId: '', tier: '', holderName: '', memberSince: '', points: '', expiryDate: '', color: 'var(--chart-1)', icon: 'loyalty', notes: '', website: '', category: 'Other' };

/** Add or edit a card in the Wallet (SUB-05). */
const MembershipModal: React.FC<MembershipModalProps> = ({ onClose, onSave, membershipToEdit }) => {
  const initial = useRef({ ...EMPTY, ...membershipToEdit, category: membershipToEdit?.category || 'Other' });
  const [draft, setDraft] = useState(initial.current);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const update = (patch: Partial<typeof EMPTY>) => setDraft(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    if (!draft.provider.trim() || !draft.memberId.trim()) {
      toast.error('Add a provider and a member number');
      return;
    }
    onSave({
      ...membershipToEdit,
      id: membershipToEdit?.id,
      provider: draft.provider.trim(),
      memberId: draft.memberId.trim(),
      tier: draft.tier.trim() || undefined,
      holderName: draft.holderName.trim() || undefined,
      memberSince: draft.memberSince.trim() || undefined,
      points: draft.points.trim() || undefined,
      expiryDate: draft.expiryDate || undefined,
      color: draft.color,
      icon: draft.icon,
      notes: draft.notes.trim() || undefined,
      website: draft.website.trim() || undefined,
      category: draft.category,
    });
    onClose();
  };

  return (
    <>
      <SidePanel
        isOpen
        onClose={onClose}
        title={membershipToEdit ? `Edit ${membershipToEdit.provider}` : 'Add a card'}
        isDirty={JSON.stringify(draft) !== JSON.stringify(initial.current)}
        footer={close => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button onPress={handleSave}>{membershipToEdit ? 'Save changes' : 'Add card'}</Button>
          </div>
        )}
      >
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <TextInput label="Provider" value={draft.provider} onChange={provider => update({ provider })} autoFocus />
          <TextInput label="Member number" value={draft.memberId} onChange={memberId => update({ memberId })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" options={MEMBERSHIP_CATEGORIES.map(item => ({ id: item, label: item }))} value={draft.category} onChange={category => update({ category })} />
            <TextInput label="Tier" value={draft.tier} onChange={tier => update({ tier })} />
          </div>
          <TextInput label="Holder name" value={draft.holderName} onChange={holderName => update({ holderName })} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Points" value={draft.points} onChange={points => update({ points })} />
            <TextInput label="Member since" value={draft.memberSince} onChange={memberSince => update({ memberSince })} />
          </div>
          <DateInput label="Valid until" value={draft.expiryDate} onChange={expiryDate => update({ expiryDate })} />
          <TextInput label="Website" inputMode="url" value={draft.website} onChange={website => update({ website })} />
          <div>
            <p className="type-label mb-1.5 text-ink">Colour</p>
            <div className="flex flex-wrap" role="group" aria-label="Card colour">
              {CATEGORY_TAG_PRESET_COLORS.map(preset => (
                <button key={preset} type="button" aria-label={`Colour ${preset}`} aria-pressed={draft.color === preset} onClick={() => update({ color: preset })} className="flex size-9 pointer-coarse:size-11 cursor-pointer items-center justify-center pointer-coarse:size-11">
                  <span aria-hidden="true" className={cn('size-6 rounded-full border-2', draft.color === preset ? 'border-ink' : 'border-transparent')} style={{ backgroundColor: preset }} />
                </button>
              ))}
            </div>
          </div>
          <Button variant="secondary" onPress={() => setIconPickerOpen(true)}><Icon name={draft.icon} size={18} /> Choose an icon</Button>
          <Textarea label="Notes" value={draft.notes} onChange={notes => update({ notes })} />
        </form>
      </SidePanel>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={icon => { update({ icon }); setIconPickerOpen(false); }} iconList={CATEGORY_ICON_LIST} selectedIcon={draft.icon} />}
    </>
  );
};

export default MembershipModal;

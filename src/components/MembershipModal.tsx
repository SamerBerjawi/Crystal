
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Membership } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import IconPicker from './IconPicker';

interface MembershipModalProps {
  onClose: () => void;
  onSave: (membership: Omit<Membership, 'id'> & { id?: string }) => void;
  membershipToEdit?: Membership | null;
}

const MembershipModal: React.FC<MembershipModalProps> = ({ onClose, onSave, membershipToEdit }) => {
  const isEditing = !!membershipToEdit;
  
  const [provider, setProvider] = useState('');
  const [memberId, setMemberId] = useState('');
  const [tier, setTier] = useState('');
  const [programType, setProgramType] = useState<'points' | 'tier' | 'access' | 'discount'>('points');
  const [expiryDate, setExpiryDate] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('card_membership');
  const [notes, setNotes] = useState('');
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (membershipToEdit) {
      setProvider(membershipToEdit.provider);
      setMemberId(membershipToEdit.memberId);
      setTier(membershipToEdit.tier || '');
      setProgramType(membershipToEdit.programType);
      setExpiryDate(membershipToEdit.expiryDate || '');
      setColor(membershipToEdit.color);
      setIcon(membershipToEdit.icon);
      setNotes(membershipToEdit.notes || '');
    }
  }, [membershipToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: membershipToEdit?.id,
      provider,
      memberId,
      tier: tier || undefined,
      programType,
      expiryDate: expiryDate || undefined,
      color,
      icon,
      notes: notes || undefined,
    });
    onClose();
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  
  const iconList = ['card_membership', 'loyalty', 'flight', 'local_cafe', 'fitness_center', 'shopping_bag', 'hotel', 'local_gas_station', 'restaurant', 'movie', 'star', 'credit_card'];

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={iconList} />}
      <Modal onClose={onClose} title={isEditing ? 'Edit Membership' : 'Add Membership'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex items-end gap-4">
                <div className="flex-grow">
                     <label htmlFor="provider" className={labelStyle}>Provider Name</label>
                     <input id="provider" type="text" value={provider} onChange={e => setProvider(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Starbucks, British Airways" required autoFocus />
                </div>
                 <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-lg shadow-sm border border-black/10 dark:border-white/10 text-primary-500"
                >
                    <span className="material-symbols-outlined text-2xl" style={{ color }}>{icon}</span>
                </button>
                 <div
                    className="relative flex-shrink-0 w-10 h-10 rounded-lg border border-black/10 dark:border-white/10 overflow-hidden cursor-pointer"
                    style={{ backgroundColor: color }}
                    title="Select color"
                >
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="memberId" className={labelStyle}>Member ID / Card Number</label>
                <input id="memberId" type="text" value={memberId} onChange={e => setMemberId(e.target.value)} className={INPUT_BASE_STYLE} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                     <label htmlFor="programType" className={labelStyle}>Type</label>
                     <div className={SELECT_WRAPPER_STYLE}>
                        <select id="programType" value={programType} onChange={e => setProgramType(e.target.value as any)} className={INPUT_BASE_STYLE}>
                            <option value="points">Points</option>
                            <option value="tier">Status Tier</option>
                            <option value="access">Access / Pass</option>
                            <option value="discount">Discount</option>
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                </div>
                <div>
                     <label htmlFor="tier" className={labelStyle}>Tier Level (Optional)</label>
                     <input id="tier" type="text" value={tier} onChange={e => setTier(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Gold" />
                </div>
            </div>

            <div>
                 <label htmlFor="expiryDate" className={labelStyle}>Expiry Date (Optional)</label>
                 <input id="expiryDate" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={INPUT_BASE_STYLE} />
            </div>

            <div>
                <label htmlFor="notes" className={labelStyle}>Notes</label>
                <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_BASE_STYLE} rows={2} placeholder="Login info, perks, etc." />
            </div>

            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Membership'}</button>
            </div>
        </form>
      </Modal>
    </>
  );
};

export default MembershipModal;

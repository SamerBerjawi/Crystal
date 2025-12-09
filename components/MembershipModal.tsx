
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Membership } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CATEGORY_ICON_LIST, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import IconPicker from './IconPicker';

interface MembershipModalProps {
  onClose: () => void;
  onSave: (membership: Omit<Membership, 'id'> & { id?: string }) => void;
  membershipToEdit?: Membership | null;
}

const MEMBERSHIP_CATEGORIES = ['Retail', 'Airline', 'Hotel', 'Grocery', 'Dining', 'Health', 'Services', 'Other'];

const MembershipModal: React.FC<MembershipModalProps> = ({ onClose, onSave, membershipToEdit }) => {
  const isEditing = !!membershipToEdit;
  
  const [provider, setProvider] = useState('');
  const [memberId, setMemberId] = useState('');
  const [tier, setTier] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [color, setColor] = useState('#3b82f6'); // Default blue
  const [icon, setIcon] = useState('loyalty');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('Other');
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (membershipToEdit) {
      setProvider(membershipToEdit.provider);
      setMemberId(membershipToEdit.memberId);
      setTier(membershipToEdit.tier || '');
      setExpiryDate(membershipToEdit.expiryDate || '');
      setColor(membershipToEdit.color);
      setIcon(membershipToEdit.icon);
      setNotes(membershipToEdit.notes || '');
      setWebsite(membershipToEdit.website || '');
      setCategory(membershipToEdit.category || 'Other');
    } else {
      // Defaults
      setProvider('');
      setMemberId('');
      setTier('');
      setExpiryDate('');
      setColor('#3b82f6');
      setIcon('loyalty');
      setNotes('');
      setWebsite('');
      setCategory('Other');
    }
  }, [membershipToEdit]);

  const handleWebsiteBlur = () => {
      if (website && !/^https?:\/\//i.test(website)) {
          setWebsite('https://' + website);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
        id: membershipToEdit?.id,
        provider,
        memberId,
        tier: tier || undefined,
        expiryDate: expiryDate || undefined,
        color,
        icon,
        notes: notes || undefined,
        website: website || undefined,
        category: category || 'Other',
    });
    onClose();
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={CATEGORY_ICON_LIST} />}
      <Modal onClose={onClose} title={isEditing ? 'Edit Membership' : 'Add Membership'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="flex items-end gap-4">
               <div className="flex-grow">
                    <label htmlFor="provider" className={labelStyle}>Provider Name</label>
                    <input id="provider" type="text" value={provider} onChange={e => setProvider(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Starbucks, Delta" required autoFocus />
               </div>
               <button
                  type="button"
                  onClick={() => setIconPickerOpen(true)}
                  className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-light-bg dark:bg-dark-bg rounded-lg shadow-neu-raised-light dark:shadow-neu-raised-dark hover:shadow-neu-inset-light dark:hover:shadow-neu-inset-dark transition-shadow text-white"
                  style={{ backgroundColor: color }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                    {icon}
                  </span>
                </button>
                 <div
                    className="relative flex-shrink-0 w-10 h-10 rounded-lg border border-black/10 dark:border-white/10 overflow-hidden cursor-pointer"
                    style={{ backgroundColor: color }}
                    title="Select card color"
                  >
                    <label htmlFor="card-color" className="sr-only">Select color</label>
                    <input
                      id="card-color"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
          </div>

          <div>
            <label htmlFor="category" className={labelStyle}>Category</label>
            <div className={SELECT_WRAPPER_STYLE}>
                <select id="category" value={category} onChange={e => setCategory(e.target.value)} className={INPUT_BASE_STYLE}>
                    {MEMBERSHIP_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </div>

          <div>
            <label htmlFor="memberId" className={labelStyle}>Member ID / Card Number</label>
            <input id="memberId" type="text" value={memberId} onChange={e => setMemberId(e.target.value)} className={INPUT_BASE_STYLE} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label htmlFor="tier" className={labelStyle}>Tier / Status (Optional)</label>
                <input id="tier" type="text" value={tier} onChange={e => setTier(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Gold" />
             </div>
             <div>
                <label htmlFor="expiryDate" className={labelStyle}>Expiry Date (Optional)</label>
                <input id="expiryDate" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={INPUT_BASE_STYLE} />
             </div>
          </div>

           <div>
            <label htmlFor="website" className={labelStyle}>Website (Optional)</label>
            <input 
                id="website" 
                type="text" 
                value={website} 
                onChange={e => setWebsite(e.target.value)} 
                onBlur={handleWebsiteBlur}
                className={INPUT_BASE_STYLE} 
                placeholder="www.example.com" 
            />
          </div>

          <div>
            <label htmlFor="notes" className={labelStyle}>Notes (Optional)</label>
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_BASE_STYLE} rows={3} placeholder="PIN, benefits, etc." />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
            <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Card'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default MembershipModal;

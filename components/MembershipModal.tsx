
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

  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1";

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={CATEGORY_ICON_LIST} />}
      <Modal onClose={onClose} title={isEditing ? 'Edit Membership' : 'Add Membership'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Header Section: Icon, Color, Provider Name */}
          <div className="flex items-center gap-5">
               <div className="relative group">
                    <button
                        type="button"
                        onClick={() => setIconPickerOpen(true)}
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform transform hover:scale-105"
                        style={{ backgroundColor: color }}
                    >
                        <span className="material-symbols-outlined text-4xl">{icon}</span>
                    </button>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 border-white dark:border-dark-card overflow-hidden shadow-sm cursor-pointer hover:scale-110 transition-transform">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-full h-full opacity-0 cursor-pointer absolute inset-0 z-10"
                        />
                        <div className="w-full h-full" style={{ backgroundColor: color }}></div>
                        <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-[10px] text-white pointer-events-none bg-black/20">palette</span>
                    </div>
               </div>
               
               <div className="flex-grow">
                    <label htmlFor="provider" className={labelStyle}>Provider Name</label>
                    <input 
                        id="provider" 
                        type="text" 
                        value={provider} 
                        onChange={e => setProvider(e.target.value)} 
                        className={`${INPUT_BASE_STYLE} !text-lg !h-12 font-bold`} 
                        placeholder="e.g. Starbucks" 
                        required 
                        autoFocus 
                    />
               </div>
          </div>

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label htmlFor="memberId" className={labelStyle}>Member ID</label>
                <input id="memberId" type="text" value={memberId} onChange={e => setMemberId(e.target.value)} className={INPUT_BASE_STYLE} required placeholder="Card Number" />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label htmlFor="tier" className={labelStyle}>Tier / Status</label>
                <input id="tier" type="text" value={tier} onChange={e => setTier(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Gold" />
             </div>
             <div>
                <label htmlFor="expiryDate" className={labelStyle}>Expiry Date</label>
                <input id="expiryDate" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={INPUT_BASE_STYLE} />
             </div>
          </div>

          {/* Additional Info Section */}
          <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-4">
              <div>
                <label htmlFor="website" className={labelStyle}>Website</label>
                <div className="relative">
                    <input 
                        id="website" 
                        type="text" 
                        value={website} 
                        onChange={e => setWebsite(e.target.value)} 
                        onBlur={handleWebsiteBlur}
                        className={`${INPUT_BASE_STYLE} pl-9`} 
                        placeholder="www.example.com" 
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">public</span>
                </div>
              </div>

              <div>
                <label htmlFor="notes" className={labelStyle}>Notes</label>
                <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_BASE_STYLE} rows={2} placeholder="PIN, benefits, login details..." />
              </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-black/10 dark:border-white/10">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
            <button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Card'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default MembershipModal;


import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Membership } from '../types';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CATEGORY_ICON_LIST, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
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
  const [holderName, setHolderName] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [points, setPoints] = useState('');
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
      setHolderName(membershipToEdit.holderName || '');
      setMemberSince(membershipToEdit.memberSince || '');
      setPoints(membershipToEdit.points || '');
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
      setHolderName('');
      setMemberSince('');
      setPoints('');
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
        holderName: holderName || undefined,
        memberSince: memberSince || undefined,
        points: points || undefined,
        expiryDate: expiryDate || undefined,
        color,
        icon,
        notes: notes || undefined,
        website: website || undefined,
        category: category || 'Other',
    });
    onClose();
  };

  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1";

  return (
    <>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={setIcon} iconList={CATEGORY_ICON_LIST} />}
      <Modal onClose={onClose} title={isEditing ? 'Asset Management' : 'New Identity Asset'}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
            <div className="absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full opacity-20 transition-colors" style={{ backgroundColor: color }} />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full" />
        </div>

        <form onSubmit={handleSubmit} className="relative z-10 space-y-8">
          
          {/* Header Section: Icon, Color, Provider Name */}
          <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-[2rem] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-6">
                <div className="relative group shrink-0">
                    <button
                        type="button"
                        onClick={() => setIconPickerOpen(true)}
                        className="w-24 h-24 rounded-3xl flex items-center justify-center text-white shadow-2xl transition-all transform hover:scale-105 active:scale-95 border-4 border-white dark:border-dark-card"
                        style={{ backgroundColor: color }}
                    >
                        <span className="material-symbols-outlined text-5xl">{icon}</span>
                    </button>
                    <label className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-white dark:bg-dark-card border-2 border-primary-500 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform overflow-hidden">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-full h-full opacity-0 cursor-pointer absolute inset-0 z-10"
                        />
                        <span className="material-symbols-outlined text-primary-500 text-lg">palette</span>
                    </label>
                </div>
                
                <div className="flex-grow">
                    <label htmlFor="provider" className={labelStyle}>Provider / Issuer</label>
                    <input 
                        id="provider" 
                        type="text" 
                        value={provider} 
                        onChange={e => setProvider(e.target.value)} 
                        className={`${INPUT_BASE_STYLE} !text-2xl !h-14 font-black tracking-tight `} 
                        placeholder="e.g. Starbucks" 
                        required 
                        autoFocus 
                    />
                </div>
            </div>
          </div>

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="category" className={labelStyle}>Industry Category</label>
                <div className={SELECT_WRAPPER_STYLE}>
                    <select id="category" value={category} onChange={e => setCategory(e.target.value)} className={`${SELECT_STYLE} h-12 font-bold`}>
                        {MEMBERSHIP_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                </div>
              </div>
              <div>
                <label htmlFor="memberId" className={labelStyle}>Identification Number</label>
                <input id="memberId" type="text" value={memberId} onChange={e => setMemberId(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-mono font-bold tracking-wider`} required placeholder="•••• •••• ••••" />
              </div>
          </div>

          {/* Additional Details */}
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="md:col-span-2">
                      <label htmlFor="holderName" className={labelStyle}>Holder Name</label>
                      <input id="holderName" type="text" value={holderName} onChange={e => setHolderName(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-bold`} placeholder="Jane Doe" />
                   </div>
                   <div>
                      <label htmlFor="tier" className={labelStyle}>Tier Status</label>
                      <input id="tier" type="text" value={tier} onChange={e => setTier(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-bold`} placeholder="e.g. Platinum" />
                   </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                   <div>
                      <label htmlFor="points" className={labelStyle}>Digital Balance</label>
                      <input id="points" type="text" value={points} onChange={e => setPoints(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-black tabular-nums`} placeholder="0 pts" />
                   </div>
                   <div className="hidden md:block">
                      <label htmlFor="memberSince" className={labelStyle}>Loyalty Start</label>
                      <input id="memberSince" type="text" value={memberSince} onChange={e => setMemberSince(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} placeholder="Year" />
                   </div>
                   <div className="col-span-1">
                      <label htmlFor="expiryDate" className={labelStyle}>Expiration</label>
                      <input id="expiryDate" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} />
                   </div>
              </div>
          </div>

          {/* Metadata Section */}
          <div className="bg-gray-50 dark:bg-black/20 p-6 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-6">
              <div>
                <label htmlFor="website" className={labelStyle}>Online Portal</label>
                <div className="relative">
                    <input 
                        id="website" 
                        type="text" 
                        value={website} 
                        onChange={e => setWebsite(e.target.value)} 
                        onBlur={handleWebsiteBlur}
                        className={`${INPUT_BASE_STYLE} pl-12 h-12`} 
                        placeholder="https://..." 
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">public</span>
                </div>
              </div>

              <div>
                <label htmlFor="notes" className={labelStyle}>Private Notes</label>
                <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className={`${INPUT_BASE_STYLE} p-4`} rows={3} placeholder="Add PIN or special benefits..." />
              </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-black/5 dark:border-white/5">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Dismiss</button>
            <button type="submit" className={`${BTN_PRIMARY_STYLE} px-10 animate-glow`}>{isEditing ? 'Sync Changes' : 'Store Asset'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default MembershipModal;
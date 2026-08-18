import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Membership } from '../types';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, CATEGORY_ICON_LIST, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import IconPicker from './IconPicker';
import Icon from './ui/Icon';

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
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('loyalty');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('Other');
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, [membershipToEdit]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

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
    handleClose();
  };

  const labelStyle = "block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5";

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-lg bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/5 via-primary-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
              >
                <Icon name={icon} className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  {isEditing ? 'Edit Loyalty Card' : 'Add Loyalty Card'}
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  {provider || 'Store membership and rewards'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* Provider & Icon Selector */}
              <div className="p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 flex items-center gap-4">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform"
                    style={{ backgroundColor: color }}
                    title="Change icon"
                  >
                    <Icon name={icon} className="text-3xl" />
                  </button>
                  <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 flex items-center justify-center shadow-xs cursor-pointer hover:scale-110 transition-transform overflow-hidden">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full h-full opacity-0 cursor-pointer absolute inset-0"
                    />
                    <Icon name="palette" className="text-primary-500 text-xs" />
                  </label>
                </div>

                <div className="flex-1 min-w-0">
                  <label htmlFor="provider" className={labelStyle}>Provider / Issuer <span className="text-rose-500">*</span></label>
                  <input 
                    id="provider" 
                    type="text" 
                    value={provider} 
                    onChange={e => setProvider(e.target.value)} 
                    className={`${INPUT_BASE_STYLE} h-12 font-bold !text-lg`} 
                    placeholder="e.g. Starbucks, Delta" 
                    required 
                    autoFocus 
                  />
                </div>
              </div>

              {/* Identification and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className={labelStyle}>Category</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                    <select id="category" value={category} onChange={e => setCategory(e.target.value)} className={`${SELECT_STYLE} h-12 font-bold`}>
                      {MEMBERSHIP_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                  </div>
                </div>
                <div>
                  <label htmlFor="memberId" className={labelStyle}>Card / Member # <span className="text-rose-500">*</span></label>
                  <input 
                    id="memberId" 
                    type="text" 
                    value={memberId} 
                    onChange={e => setMemberId(e.target.value)} 
                    className={`${INPUT_BASE_STYLE} h-12 font-mono font-bold`} 
                    required 
                    placeholder="•••• •••• ••••" 
                  />
                </div>
              </div>

              {/* Holder & Tier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="holderName" className={labelStyle}>Holder Name</label>
                  <input id="holderName" type="text" value={holderName} onChange={e => setHolderName(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-semibold`} placeholder="Jane Doe" />
                </div>
                <div>
                  <label htmlFor="tier" className={labelStyle}>Tier Status</label>
                  <input id="tier" type="text" value={tier} onChange={e => setTier(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-semibold`} placeholder="e.g. Gold, Diamond" />
                </div>
              </div>

              {/* Points, Expiry, Loyalty Start */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="points" className={labelStyle}>Digital Points</label>
                  <input id="points" type="text" value={points} onChange={e => setPoints(e.target.value)} className={`${INPUT_BASE_STYLE} h-12 font-bold tabular-nums`} placeholder="0 pts" />
                </div>
                <div>
                  <label htmlFor="memberSince" className={labelStyle}>Member Since</label>
                  <input id="memberSince" type="text" value={memberSince} onChange={e => setMemberSince(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} placeholder="e.g. 2021" />
                </div>
                <div>
                  <label htmlFor="expiryDate" className={labelStyle}>Expiration</label>
                  <input id="expiryDate" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} />
                </div>
              </div>

              {/* Online Portal & Private Notes */}
              <div className="space-y-4 pt-2">
                <div>
                  <label htmlFor="website" className={labelStyle}>Online Portal</label>
                  <div className="relative">
                    <input 
                      id="website" 
                      type="text" 
                      value={website} 
                      onChange={e => setWebsite(e.target.value)} 
                      onBlur={handleWebsiteBlur}
                      className={`${INPUT_BASE_STYLE} pl-11 h-12`} 
                      placeholder="https://..." 
                    />
                    <Icon name="public" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className={labelStyle}>Private Notes & Perks</label>
                  <textarea 
                    id="notes" 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className={`${INPUT_BASE_STYLE} p-4`} 
                    rows={3} 
                    placeholder="Add bar-code info, PIN, or special discounts..." 
                  />
                </div>
              </div>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
              >
                <span>{isEditing ? 'Save Changes' : 'Store Card'}</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {isIconPickerOpen && (
        <IconPicker 
          onClose={() => setIconPickerOpen(false)} 
          onSelect={setIcon} 
          iconList={CATEGORY_ICON_LIST} 
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default MembershipModal;
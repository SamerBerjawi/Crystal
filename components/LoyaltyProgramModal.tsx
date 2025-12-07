
import React, { useState } from 'react';
import Modal from './Modal';
import { LoyaltyProgram } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LOYALTY_CATEGORIES } from '../constants';
import IconPicker from './IconPicker';

interface LoyaltyProgramModalProps {
  onClose: () => void;
  onSave: (program: Omit<LoyaltyProgram, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  programToEdit?: LoyaltyProgram | null;
}

const BRAND_COLORS = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#111827', // Black
    '#6B7280', // Gray
];

const ICONS = ['flight', 'shopping_cart', 'store', 'hotel', 'local_gas_station', 'restaurant', 'fitness_center', 'star', 'card_membership', 'loyalty'];

const LoyaltyProgramModal: React.FC<LoyaltyProgramModalProps> = ({ onClose, onSave, onDelete, programToEdit }) => {
  const isEditing = !!programToEdit;

  const [name, setName] = useState(programToEdit?.name || '');
  const [programName, setProgramName] = useState(programToEdit?.programName || '');
  const [membershipId, setMembershipId] = useState(programToEdit?.membershipId || '');
  const [pointsBalance, setPointsBalance] = useState(programToEdit?.pointsBalance ? String(programToEdit.pointsBalance) : '');
  const [pointsUnit, setPointsUnit] = useState(programToEdit?.pointsUnit || 'Points');
  const [tier, setTier] = useState(programToEdit?.tier || '');
  const [color, setColor] = useState(programToEdit?.color || BRAND_COLORS[4]);
  const [icon, setIcon] = useState(programToEdit?.icon || 'card_membership');
  const [websiteUrl, setWebsiteUrl] = useState(programToEdit?.websiteUrl || '');
  const [notes, setNotes] = useState(programToEdit?.notes || '');
  const [category, setCategory] = useState(programToEdit?.category || 'Other');
  
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: programToEdit?.id,
      name,
      programName,
      membershipId,
      pointsBalance: parseFloat(pointsBalance) || 0,
      pointsUnit,
      tier,
      color,
      icon,
      websiteUrl,
      notes,
      category
    });
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

  return (
    <>
        {isIconPickerOpen && <IconPicker onClose={() => setIsIconPickerOpen(false)} onSelect={setIcon} iconList={ICONS} />}
        
        <Modal onClose={onClose} title={isEditing ? 'Edit Loyalty Program' : 'Add Loyalty Program'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex gap-4 items-end">
                 <div className="flex-grow">
                    <label htmlFor="name" className={labelStyle}>Merchant / Brand</label>
                    <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. British Airways" required autoFocus />
                </div>
                
                 {/* Visual Selector */}
                <div className="flex gap-2">
                    <button type="button" onClick={() => setIsIconPickerOpen(true)} className="w-10 h-10 rounded-lg bg-light-fill dark:bg-dark-fill flex items-center justify-center text-light-text dark:text-dark-text border border-black/10 dark:border-white/10">
                        <span className="material-symbols-outlined">{icon}</span>
                    </button>
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="programName" className={labelStyle}>Program Name</label>
                    <input id="programName" type="text" value={programName} onChange={e => setProgramName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Executive Club" required />
                </div>
                <div>
                    <label htmlFor="category" className={labelStyle}>Category</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                        <select id="category" value={category} onChange={e => setCategory(e.target.value)} className={INPUT_BASE_STYLE}>
                            {LOYALTY_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="membershipId" className={labelStyle}>Membership ID</label>
                    <input id="membershipId" type="text" value={membershipId} onChange={e => setMembershipId(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. 12345678" />
                </div>
                <div>
                     <label htmlFor="tier" className={labelStyle}>Tier Level</label>
                    <input id="tier" type="text" value={tier} onChange={e => setTier(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Gold" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="pointsBalance" className={labelStyle}>Balance</label>
                    <input id="pointsBalance" type="number" value={pointsBalance} onChange={e => setPointsBalance(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0" />
                </div>
                 <div>
                    <label htmlFor="pointsUnit" className={labelStyle}>Unit</label>
                    <input id="pointsUnit" type="text" value={pointsUnit} onChange={e => setPointsUnit(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Avios, Points" />
                </div>
            </div>
            
            <div>
                 <label htmlFor="websiteUrl" className={labelStyle}>Login / Website URL</label>
                 <input id="websiteUrl" type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className={INPUT_BASE_STYLE} placeholder="https://..." />
            </div>

             <div>
                 <label htmlFor="notes" className={labelStyle}>Notes</label>
                 <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_BASE_STYLE} rows={2} placeholder="e.g. Points expire in Dec 2025" />
            </div>

            <div className="flex justify-between pt-4 mt-2 border-t border-black/10 dark:border-white/10">
                {isEditing ? (
                    <button type="button" onClick={() => { onDelete(programToEdit.id); onClose(); }} className={BTN_DANGER_STYLE}>Delete</button>
                ) : <div></div>}
                
                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>Save Program</button>
                </div>
            </div>
        </form>
        </Modal>
    </>
  );
};

export default LoyaltyProgramModal;


import React, { useState } from 'react';
import Modal from './Modal';
import { Challenge, ChallengeType, Category } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CHECKBOX_STYLE } from '../constants';

interface AddChallengeModalProps {
    onClose: () => void;
    onSave: (challenge: Omit<Challenge, 'id'>) => void;
    categories: Category[];
}

const AddChallengeModal: React.FC<AddChallengeModalProps> = ({ onClose, onSave, categories }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<ChallengeType>('spend-limit');
    const [targetAmount, setTargetAmount] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [icon, setIcon] = useState('emoji_events');
    const [color, setColor] = useState('#F59E0B');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            description,
            type,
            targetAmount: type === 'spend-limit' ? parseFloat(targetAmount) : 0,
            startDate,
            endDate,
            categoryNames: selectedCategories,
            icon,
            color
        });
        onClose();
    };

    const toggleCategory = (catName: string) => {
        setSelectedCategories(prev => 
            prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
        );
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

    return (
        <Modal onClose={onClose} title="Create Custom Challenge">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className={labelStyle}>Challenge Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. No Spend Week" required />
                </div>
                <div>
                    <label className={labelStyle}>Description</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g. Don't buy any clothes." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className={labelStyle}>Type</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select value={type} onChange={e => setType(e.target.value as ChallengeType)} className={INPUT_BASE_STYLE}>
                                <option value="spend-limit">Spending Limit</option>
                                <option value="streak">Streak (No Spend)</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                    {type === 'spend-limit' && (
                         <div>
                            <label className={labelStyle}>Limit Amount (€)</label>
                            <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className={INPUT_BASE_STYLE} required />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                    </div>
                    <div>
                        <label className={labelStyle}>End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT_BASE_STYLE} required />
                    </div>
                </div>

                <div>
                    <label className={labelStyle}>Categories to Track</label>
                    <div className="max-h-40 overflow-y-auto border border-black/10 dark:border-white/10 rounded-lg p-2 bg-light-bg dark:bg-dark-bg">
                        {categories.map(cat => (
                             <label key={cat.id} className="flex items-center gap-2 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer">
                                 <input type="checkbox" checked={selectedCategories.includes(cat.name)} onChange={() => toggleCategory(cat.name)} className={CHECKBOX_STYLE} />
                                 <span className="text-sm">{cat.name}</span>
                             </label>
                        ))}
                    </div>
                </div>
                
                <div className="flex gap-4">
                     <div className="flex-1">
                        <label className={labelStyle}>Icon</label>
                        <input type="text" value={icon} onChange={e => setIcon(e.target.value)} className={INPUT_BASE_STYLE} placeholder="material icon name" />
                     </div>
                     <div>
                        <label className={labelStyle}>Color</label>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-full rounded cursor-pointer" />
                     </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>Create Challenge</button>
                </div>
            </form>
        </Modal>
    );
};

export default AddChallengeModal;

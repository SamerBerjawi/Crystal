
import React from 'react';
import { Membership } from '../types';
import { parseDateAsUTC } from '../utils';

interface LoyaltyCardProps {
  membership: Membership;
  onEdit: (membership: Membership) => void;
  onDelete: (id: string) => void;
}

const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
  const formattedExpiry = membership.expiryDate 
    ? parseDateAsUTC(membership.expiryDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : 'N/A';

  const isExpired = membership.expiryDate && new Date(membership.expiryDate) < new Date();

  return (
    <div className="group relative bg-white dark:bg-dark-card rounded-xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full min-h-[180px]">
      {/* Colored Accent Line */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: membership.color }}></div>

      <div className="p-5 pl-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm" 
                    style={{ backgroundColor: membership.color }}
                >
                     <span className="material-symbols-outlined text-xl">{membership.icon || 'loyalty'}</span>
                </div>
                <div>
                    <h3 className="font-bold text-light-text dark:text-dark-text leading-tight truncate max-w-[120px]" title={membership.provider}>
                        {membership.provider}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                        {membership.category || 'Member'}
                    </span>
                </div>
            </div>

            {/* Actions (Reveal on Hover) */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(membership); }}
                    className="p-1.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 hover:text-primary-500 transition-colors"
                    title="Edit"
                >
                    <span className="material-symbols-outlined text-lg">edit</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }}
                    className="p-1.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                    title="Delete"
                >
                    <span className="material-symbols-outlined text-lg">delete</span>
                </button>
            </div>
        </div>

        {/* Member ID Area */}
        <div className="mb-4">
             <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1">Member ID</p>
             <div className="bg-gray-50 dark:bg-black/20 p-2 rounded-lg border border-black/5 dark:border-white/5">
                 <p className="font-mono text-sm font-semibold text-light-text dark:text-dark-text break-all select-all">
                    {membership.memberId}
                 </p>
             </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mt-auto">
             <div>
                 <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-0.5">Tier</p>
                 <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">{membership.tier || 'Standard'}</p>
             </div>
             <div className="text-right">
                 <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-0.5">Expires</p>
                 <p className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-light-text dark:text-dark-text'}`}>
                    {formattedExpiry}
                 </p>
             </div>
        </div>
        
        {/* Footer: Notes/Link */}
        {(membership.notes || membership.website) && (
            <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col gap-2">
                {membership.notes && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic line-clamp-2" title={membership.notes}>
                        "{membership.notes}"
                    </p>
                )}
                {membership.website && (
                     <a 
                        href={membership.website} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-primary-500 hover:underline flex items-center gap-1 self-start"
                     >
                        Visit Website <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                     </a>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default LoyaltyCard;

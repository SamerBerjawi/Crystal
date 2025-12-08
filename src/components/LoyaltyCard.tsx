
import React, { useState } from 'react';
import { Membership } from '../types';
import { parseDateAsUTC } from '../utils';

interface LoyaltyCardProps {
    membership: Membership;
    onEdit: (membership: Membership) => void;
    onDelete: (id: string) => void;
}

const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    
    // Check if expiring soon (within 30 days)
    const isExpiringSoon = React.useMemo(() => {
        if (!membership.expiryDate) return false;
        const expiry = parseDateAsUTC(membership.expiryDate);
        const today = new Date();
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
    }, [membership.expiryDate]);

    const isExpired = React.useMemo(() => {
         if (!membership.expiryDate) return false;
         return parseDateAsUTC(membership.expiryDate) < new Date();
    }, [membership.expiryDate]);

    return (
        <div 
            className="relative w-full h-52 perspective-1000 cursor-pointer group"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div 
                className="relative w-full h-full transition-all duration-500 shadow-xl rounded-2xl"
                style={{ 
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
            >
                
                {/* FRONT */}
                <div 
                    className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between overflow-hidden text-white"
                    style={{ 
                        background: `linear-gradient(135deg, ${membership.color} 0%, #00000088 100%)`,
                        backgroundColor: membership.color,
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden'
                    }}
                >
                     {/* Glossy Overlay */}
                     <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                     <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

                     <div className="relative z-10 flex justify-between items-start">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-sm">
                                 <span className="material-symbols-outlined text-2xl">{membership.icon}</span>
                             </div>
                             <h3 className="font-bold text-lg tracking-wide drop-shadow-md">{membership.provider}</h3>
                         </div>
                         {membership.tier && (
                             <span className="px-2 py-1 rounded bg-black/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider border border-white/10">
                                 {membership.tier}
                             </span>
                         )}
                     </div>
                     
                     <div className="relative z-10">
                         <p className="text-[10px] uppercase opacity-70 tracking-widest mb-1">Member ID</p>
                         <p className="font-mono text-xl tracking-widest drop-shadow-md truncate">{membership.memberId}</p>
                     </div>
                     
                     {membership.expiryDate && (
                         <div className="relative z-10 flex justify-between items-end">
                             <div>
                                 <p className="text-[8px] uppercase opacity-70 mb-0.5">Expires</p>
                                 <p className={`text-sm font-semibold ${isExpired ? 'text-red-200' : 'text-white'}`}>
                                     {parseDateAsUTC(membership.expiryDate).toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' })}
                                 </p>
                             </div>
                             {(isExpiringSoon || isExpired) && (
                                 <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${isExpired ? 'bg-red-500/80' : 'bg-yellow-500/80'}`}>
                                     <span className="material-symbols-outlined text-[12px]">{isExpired ? 'error' : 'warning'}</span>
                                     {isExpired ? 'Expired' : 'Expiring'}
                                 </div>
                             )}
                         </div>
                     )}
                </div>

                {/* BACK */}
                <div 
                    className="absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl p-6 flex flex-col shadow-xl border border-gray-200 dark:border-gray-700"
                    style={{ 
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden'
                    }}
                >
                     <div className="flex-grow flex flex-col items-center justify-center space-y-2">
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Scan Card</p>
                          {/* Simulated Barcode */}
                          <div className="h-12 w-full max-w-[200px] flex items-stretch justify-center gap-[2px] opacity-80" aria-hidden="true">
                              {Array.from({ length: 40 }).map((_, i) => (
                                  <div key={i} className={`bg-black dark:bg-white ${Math.random() > 0.5 ? 'w-[1px]' : 'w-[3px]'}`}></div>
                              ))}
                          </div>
                          <p className="font-mono text-sm text-gray-600 dark:text-gray-300 tracking-widest">{membership.memberId}</p>
                     </div>
                     
                     {membership.notes && (
                         <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                             <p className="text-[10px] text-gray-400 uppercase mb-1">Notes</p>
                             <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{membership.notes}</p>
                         </div>
                     )}
                     
                     <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                         <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(membership); }} 
                            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                            title="Edit"
                         >
                             <span className="material-symbols-outlined text-lg">edit</span>
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }} 
                            className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors"
                            title="Delete"
                         >
                             <span className="material-symbols-outlined text-lg">delete</span>
                         </button>
                     </div>
                </div>
            </div>
        </div>
    );
};

export default LoyaltyCard;

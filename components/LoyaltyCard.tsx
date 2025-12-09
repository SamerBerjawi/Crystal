
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

  const formattedExpiry = membership.expiryDate 
    ? parseDateAsUTC(membership.expiryDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : 'No Expiry';

  const isExpired = membership.expiryDate && new Date(membership.expiryDate) < new Date();

  // Create a richer background gradient based on the selected color
  const bgStyle = {
      background: `linear-gradient(135deg, ${membership.color} 0%, ${membership.color} 50%, #000000 150%)`,
      // Ensure the background is solid
      backgroundColor: membership.color,
  };

  return (
    <div 
      className="group relative w-full aspect-[1.586/1] perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
        
        {/* Front Face */}
        <div 
          className="absolute inset-0 w-full h-full backface-hidden rounded-2xl p-6 shadow-xl flex flex-col justify-between overflow-hidden border border-white/20"
          style={bgStyle}
        >
            {/* Texture/Pattern */}
            <div className="absolute inset-0 bg-white opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, transparent 20%, #000 120%)' }}></div>
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner border border-white/20">
                         <span className="material-symbols-outlined text-2xl">{membership.icon || 'loyalty'}</span>
                    </div>
                    <div className="min-w-0">
                        <span className="font-bold text-lg text-white drop-shadow-md truncate block leading-tight">{membership.provider}</span>
                        {membership.category && <span className="text-[10px] text-white/80 uppercase font-semibold tracking-wider block">{membership.category}</span>}
                    </div>
                </div>
                {membership.tier && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/25 text-white backdrop-blur-md border border-white/20 shadow-sm">
                        {membership.tier}
                    </span>
                )}
            </div>

            <div className="relative z-10">
                 <div className="flex justify-between items-end">
                     <div className="flex-1 mr-4">
                         <p className="text-[9px] text-white/70 uppercase tracking-widest font-semibold mb-0.5">Member ID</p>
                         <p className="font-mono text-lg text-white font-medium tracking-wide drop-shadow-sm truncate w-full">{membership.memberId}</p>
                     </div>
                     <div className="text-right flex-shrink-0">
                         <p className="text-[9px] text-white/70 uppercase font-semibold mb-0.5">Valid Thru</p>
                         <p className={`font-mono text-sm font-bold ${isExpired ? 'text-red-200' : 'text-white'}`}>{formattedExpiry}</p>
                     </div>
                 </div>
            </div>
        </div>

        {/* Back Face */}
        <div 
            className="absolute inset-0 w-full h-full backface-hidden [transform:rotateY(180deg)] bg-white dark:bg-dark-card rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col"
        >
            {/* Magnetic Strip Simulation */}
            <div className="w-full h-10 bg-gray-800 mt-4 mb-2"></div>
            
            <div className="px-6 flex-grow flex flex-col">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Authorized Signature</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Security Code</span>
                </div>
                <div className="flex gap-2 h-8 mb-3">
                     <div className="flex-grow bg-gray-100 dark:bg-white/10 flex items-center px-2">
                         <span className="font-handwriting text-gray-600 dark:text-gray-400 text-xs italic">Sign Here</span>
                     </div>
                     <div className="w-12 bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-800">
                         {membership.memberId.slice(-3)}
                     </div>
                </div>

                {/* Simulated Barcode */}
                <div className="w-full h-8 bg-[repeating-linear-gradient(90deg,black,black_1px,transparent_1px,transparent_3px)] opacity-60 mb-1"></div>
                <p className="text-center font-mono text-[9px] tracking-[0.2em] text-gray-500 mb-2 truncate">{membership.memberId}</p>

                {membership.notes && (
                    <p className="text-[10px] text-gray-500 italic line-clamp-2 text-center px-2 border-t border-gray-100 dark:border-white/5 pt-1">{membership.notes}</p>
                )}
            </div>

            <div className="p-2 flex justify-between bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 mt-auto">
                 <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete"
                 >
                     <span className="material-symbols-outlined text-lg">delete</span>
                 </button>
                 {membership.website && (
                     <a
                        href={membership.website}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        title="Visit Website"
                     >
                         <span className="material-symbols-outlined text-lg">public</span>
                     </a>
                 )}
                 <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(membership); }}
                    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title="Edit"
                 >
                     <span className="material-symbols-outlined text-lg">edit</span>
                 </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default LoyaltyCard;

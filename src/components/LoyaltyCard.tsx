
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
    ? parseDateAsUTC(membership.expiryDate).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' })
    : 'N/A';

  // Generate a gradient based on the user's selected color
  const cardStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${membership.color}, #111827)`,
    boxShadow: `0 10px 15px -3px ${membership.color}40, 0 4px 6px -2px ${membership.color}20`,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden', // Safari support
  };

  const backFaceStyle: React.CSSProperties = {
    transform: 'rotateY(180deg)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden', // Safari support
  };

  return (
    <div 
      className="group relative w-full aspect-[1.586/1] cursor-pointer select-none"
      onClick={() => setIsFlipped(!isFlipped)}
      style={{ perspective: '1000px' }}
    >
      <div 
        className="relative w-full h-full transition-transform duration-500"
        style={{ 
            transformStyle: 'preserve-3d', 
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
        }}
      >
        
        {/* Front Face */}
        <div 
          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden text-white flex flex-col justify-between p-6 shadow-xl border border-white/10"
          style={cardStyle}
        >
            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
            
            {/* Abstract Glows */}
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-black/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header */}
            <div className="flex justify-between items-start z-10">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                     <span className="material-symbols-outlined text-xl">{membership.icon || 'loyalty'}</span>
                </div>
                <div className="text-right">
                    <h3 className="font-bold text-lg tracking-wide drop-shadow-md leading-tight text-white">{membership.provider}</h3>
                    {membership.category && <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest text-white">{membership.category}</p>}
                </div>
            </div>

            {/* Member ID */}
            <div className="z-10 mt-auto mb-auto">
                 <p className="font-mono text-xl sm:text-2xl tracking-widest drop-shadow-sm truncate opacity-95 text-white">
                    {membership.memberId}
                 </p>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end z-10 text-white">
                 <div>
                     <p className="text-[8px] uppercase tracking-widest opacity-70 mb-0.5">Tier</p>
                     <p className="font-medium text-sm tracking-wide">{membership.tier || 'Standard'}</p>
                 </div>
                 <div className="text-right">
                     <p className="text-[8px] uppercase tracking-widest opacity-70 mb-0.5">Valid Thru</p>
                     <p className="font-mono text-sm font-semibold">{formattedExpiry}</p>
                 </div>
            </div>
        </div>

        {/* Back Face */}
        <div 
            className="absolute inset-0 w-full h-full bg-gray-900 text-white rounded-2xl shadow-xl overflow-hidden border border-gray-700 flex flex-col"
            style={backFaceStyle}
        >
            <div className="p-6 flex flex-col h-full relative z-10 bg-gray-900">
                {/* Texture Overlay for Back */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>

                <div className="flex justify-between items-start mb-4 z-10">
                    <h3 className="font-bold text-gray-200">Details</h3>
                    {membership.website && (
                         <a
                            href={membership.website}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 transition-colors"
                         >
                             Visit Site <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                         </a>
                     )}
                </div>

                <div className="flex-grow bg-white/5 rounded-xl p-3 mb-4 overflow-y-auto border border-white/5 z-10 custom-scrollbar">
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-medium">
                        {membership.notes || 'No additional notes.'}
                    </p>
                </div>

                <div className="flex gap-3 mt-auto z-10">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(membership); }}
                        className="flex-1 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-bold uppercase tracking-wider transition-colors border border-blue-600/20"
                    >
                        Edit
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }}
                        className="flex-1 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs font-bold uppercase tracking-wider transition-colors border border-red-600/20"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default LoyaltyCard;

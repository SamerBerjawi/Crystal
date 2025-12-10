
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

  const toRgba = (hexColor: string, alpha = 1) => {
    const sanitized = hexColor.replace('#', '');
    const normalized = sanitized.length === 3
      ? sanitized.split('').map(char => char + char).join('')
      : sanitized;

    if (normalized.length !== 6) return `rgba(59, 130, 246, ${alpha})`;

    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const cardColor = membership.color || '#3b82f6';

  const formattedExpiry = membership.expiryDate
    ? parseDateAsUTC(membership.expiryDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : 'No Expiry';

  const isExpired = membership.expiryDate && new Date(membership.expiryDate) < new Date();

  // Create a richer background gradient based on the selected color
  const bgStyle = {
    background: `linear-gradient(135deg, ${toRgba(cardColor, 0.9)} 0%, ${toRgba(cardColor, 0.7)} 45%, rgba(26,26,26,0.78) 140%)`,
  };

  return (
    <div 
      className="group relative w-full aspect-[1.586/1] perspective-1000 cursor-pointer select-none"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
        
        {/* Front Face */}
        <div 
          className="absolute inset-0 w-full h-full backface-hidden rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden border border-white/10"
          style={bgStyle}
        >
            {/* Texture/Pattern */}
            <div className="absolute inset-0 bg-white opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(255,255,255,0.2) 0%, transparent 20%)' }}></div>
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-black/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 p-5 flex justify-between items-start">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner border border-white/10 flex-shrink-0">
                         <span className="material-symbols-outlined text-xl">{membership.icon || 'loyalty'}</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg text-white drop-shadow-md leading-tight break-words">{membership.provider}</h3>
                        <p className="text-[10px] text-white/70 uppercase font-bold tracking-wider whitespace-normal break-words">
                            {membership.category || 'Membership'}
                        </p>
                    </div>
                </div>
                {membership.tier && (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-md border border-white/10 shadow-sm whitespace-nowrap">
                        {membership.tier}
                    </span>
                )}
            </div>

            {/* Body / Barcode Area */}
            <div className="relative z-10 px-5 flex-grow flex flex-col justify-center">
                 {/* Simulated Barcode */}
                 <div className="h-8 w-full opacity-80 mb-3 rounded-sm overflow-hidden flex items-center">
                     <div className="w-full h-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_2px,transparent_2px,transparent_4px)]"></div>
                 </div>
                 <p className="font-mono text-lg text-white font-medium tracking-[0.15em] drop-shadow-sm break-all text-center w-full shadow-black">
                    {membership.memberId}
                 </p>
            </div>

            {/* Footer */}
            <div className="relative z-10 p-5 pt-2 flex justify-between items-end">
                 <div>
                     <p className="text-[8px] text-white/60 uppercase tracking-widest font-bold mb-0.5">Member Since</p>
                     <p className="text-xs text-white font-semibold">2023</p>
                 </div>
                 <div className="text-right">
                     <p className="text-[8px] text-white/60 uppercase tracking-widest font-bold mb-0.5">Valid Thru</p>
                     <p className={`font-mono text-sm font-bold ${isExpired ? 'text-red-300' : 'text-white'}`}>{formattedExpiry}</p>
                 </div>
            </div>
        </div>

        {/* Back Face */}
        <div
            className="absolute inset-0 w-full h-full backface-hidden [transform:rotateY(180deg)] rounded-2xl shadow-xl overflow-hidden border border-white/10 flex flex-col text-white"
            style={bgStyle}
        >
            <div className="absolute inset-0 bg-white opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(255,255,255,0.2) 0%, transparent 20%)' }}></div>
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-black/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 p-5 flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner border border-white/10 flex-shrink-0">
                        <span className="material-symbols-outlined text-xl">{membership.icon || 'loyalty'}</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg text-white drop-shadow-md leading-tight break-words">{membership.provider}</h3>
                        <p className="text-[10px] text-white/70 uppercase font-bold tracking-wider whitespace-normal break-words">
                            {membership.category || 'Membership'}
                        </p>
                    </div>
                </div>
                {membership.tier && (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-md border border-white/10 shadow-sm whitespace-nowrap">
                        {membership.tier}
                    </span>
                )}
            </div>

            {/* Magnetic Strip Simulation */}
            <div className="w-full h-10 bg-black/60 mb-3 backdrop-blur-sm"></div>

            <div className="px-6 flex-grow flex flex-col gap-3 relative z-10 pb-3">
                <div className="flex justify-between items-center">
                    <span className="text-[8px] text-white/70 font-bold uppercase tracking-wider">Authorized Signature</span>
                    <span className="text-[8px] text-white/70 font-bold uppercase tracking-wider">Security Code</span>
                </div>
                <div className="flex gap-2 h-8">
                    <div className="flex-grow bg-white/15 backdrop-blur-sm flex items-center px-2 rounded-sm border border-white/15 min-w-0">
                        <span className="font-handwriting text-white/60 text-xs italic truncate">Sign Here</span>
                    </div>
                    <div className="w-14 bg-white/90 border border-white/20 flex items-center justify-center text-xs font-bold text-gray-800 rounded-sm font-mono">
                        {membership.memberId.slice(-3)}
                    </div>
                </div>

                {membership.notes ? (
                    <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/15 flex-grow overflow-y-auto min-h-[110px]">
                        <p className="text-[10px] text-white/80 break-words italic leading-relaxed">
                            {membership.notes}
                        </p>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center min-h-[110px]">
                        <span className="text-white/60 text-xs opacity-80">No notes</span>
                    </div>
                )}
            </div>

            <div className="p-3 bg-black/20 backdrop-blur-sm border-t border-white/10 mt-auto flex justify-center gap-4 relative z-10">
                 {membership.website && (
                     <a
                        href={membership.website}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-primary-500 hover:scale-110 transition-all shadow-sm border border-black/5 dark:border-white/10"
                        title="Visit Website"
                     >
                         <span className="material-symbols-outlined text-base">public</span>
                     </a>
                 )}
                 <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(membership); }}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:scale-110 transition-all shadow-sm border border-black/5 dark:border-white/10"
                    title="Edit"
                 >
                     <span className="material-symbols-outlined text-base">edit</span>
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-white/10 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:scale-110 transition-all shadow-sm border border-black/5 dark:border-white/10"
                    title="Delete"
                 >
                     <span className="material-symbols-outlined text-base">delete</span>
                 </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default LoyaltyCard;

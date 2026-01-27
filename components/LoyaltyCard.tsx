
import React, { useMemo, useState } from 'react';
import { Membership } from '../types';
import { parseLocalDate } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl } from '../utils/brandfetch';

interface LoyaltyCardProps {
  membership: Membership;
  onEdit: (membership: Membership) => void;
  onDelete: (id: string) => void;
}

const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
  const [copied, setCopied] = useState(false);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const [logoError, setLogoError] = useState(false);

  const normalizeColor = (hexColor: string) => hexColor.replace('#', '');

  const toRgba = (hexColor: string, alpha = 1) => {
    const sanitized = normalizeColor(hexColor);
    const normalized = sanitized.length === 3
      ? sanitized.split('').map(char => char + char).join('')
      : sanitized;

    if (normalized.length !== 6) return `rgba(79, 70, 229, ${alpha})`;

    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const cardColor = membership.color || '#4f46e5';

  const formattedExpiry = membership.expiryDate
    ? parseLocalDate(membership.expiryDate).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' })
    : 'Never';

  const isExpired = useMemo(() => {
    if (!membership.expiryDate) return false;
    return new Date(membership.expiryDate) < new Date();
  }, [membership.expiryDate]);

  const gradientBackground = useMemo(() => ({
    background: `linear-gradient(135deg, ${toRgba(cardColor, 0.9)} 0%, ${toRgba(cardColor, 0.7)} 100%)`,
  }), [cardColor]);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(membership.memberId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleWebsiteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
  };

  const logoUrl = getMerchantLogoUrl(membership.provider, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 128, height: 128 });
  const hasLogo = Boolean(logoUrl && !logoError);

  return (
    <div className="group relative w-full aspect-[1.586/1] rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden border border-white/10 select-none bg-black">
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-0" style={gradientBackground}></div>
      
      {/* Texture & Watermark Icon - Hide watermark if we have a real logo to avoid clutter */}
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
      {!hasLogo && (
        <div className="absolute -right-4 -bottom-8 text-white opacity-10 z-0 pointer-events-none transform rotate-12">
             <span className="material-symbols-outlined text-[140px] leading-none">{membership.icon || 'loyalty'}</span>
        </div>
      )}
      
      {/* Actions Overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-30 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(membership); }}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center backdrop-blur-md transition-colors"
            title="Edit"
          >
             <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-red-500/80 text-white flex items-center justify-center backdrop-blur-md transition-colors"
            title="Delete"
          >
             <span className="material-symbols-outlined text-sm">delete</span>
          </button>
      </div>

      {/* Main Content Layout */}
      <div className="relative z-10 flex flex-col justify-between h-full p-5 text-white">
        
        {/* Top Row: Provider & Tier */}
        <div className="flex justify-between items-start pr-16"> {/* pr-16 to avoid overlap with actions */}
             <div className="flex items-center gap-3">
                {hasLogo ? (
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden">
                        <img 
                            src={logoUrl!} 
                            alt={membership.provider} 
                            className="w-full h-full object-cover" 
                            onError={() => setLogoError(true)}
                        />
                    </div>
                ) : (
                    <span className="material-symbols-outlined text-xl opacity-90">{membership.icon || 'loyalty'}</span>
                )}
                
                {membership.website ? (
                    <a 
                        href={membership.website} 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={handleWebsiteClick}
                        className="font-bold text-lg leading-none drop-shadow-sm tracking-wide hover:underline decoration-white/50 underline-offset-4 cursor-pointer"
                        title="Visit Website"
                    >
                        {membership.provider}
                    </a>
                ) : (
                    <h3 className="font-bold text-lg leading-none drop-shadow-sm tracking-wide">{membership.provider}</h3>
                )}
             </div>
             
             {membership.tier && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/10 shadow-sm whitespace-nowrap">
                    {membership.tier}
                </span>
             )}
        </div>

        {/* Middle Row: ID (Click-to-Copy) & Details Grid */}
        <div className="flex flex-col justify-center flex-grow px-1 mt-2">
             <p className="text-[8px] uppercase tracking-[0.2em] opacity-70 font-semibold mb-0.5">Member ID</p>
             <button 
                onClick={handleCopyId}
                className="group/id flex items-center gap-3 text-left w-full hover:bg-white/10 p-1 -ml-1 rounded-lg transition-colors duration-200 mb-3"
                title="Click to Copy ID"
             >
                <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest drop-shadow-md truncate">
                    {membership.memberId}
                </span>
                <div className={`flex items-center justify-center w-5 h-5 rounded-full transition-all duration-300 ${copied ? 'bg-green-400 text-black scale-100' : 'bg-white/20 text-white scale-90 opacity-0 group-hover/id:opacity-100'}`}>
                    <span className="material-symbols-outlined text-xs font-bold">
                        {copied ? 'check' : 'content_copy'}
                    </span>
                </div>
            </button>
            
            {/* New Fields Grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] opacity-90">
                {membership.holderName && (
                    <div className="truncate">
                        <span className="opacity-60 block text-[8px] uppercase tracking-wider">Holder</span>
                        <span className="font-medium">{membership.holderName}</span>
                    </div>
                )}
                {membership.points && (
                    <div className="truncate text-right">
                        <span className="opacity-60 block text-[8px] uppercase tracking-wider">Balance</span>
                        <span className="font-bold">{membership.points}</span>
                    </div>
                )}
                 {/* Notes (Small) */}
                {membership.notes && (
                    <div className="col-span-2 mt-1 truncate opacity-70 italic text-[9px]">
                        "{membership.notes}"
                    </div>
                )}
            </div>
        </div>

        {/* Bottom Row: Since & Expiry */}
        <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/10">
            <div className="flex flex-col gap-0.5">
                 {membership.memberSince && (
                     <p className="text-[9px] opacity-80">Since {membership.memberSince}</p>
                 )}
            </div>
            <div className="text-right">
                 <p className="text-[8px] uppercase tracking-wider opacity-60 mb-0.5">Valid Thru</p>
                 <p className={`font-mono text-xs font-semibold ${isExpired ? 'text-red-300 bg-red-900/40 px-1 rounded' : 'opacity-90'}`}>
                    {formattedExpiry}
                 </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyCard;

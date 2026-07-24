
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
    <div 
        onClick={() => onEdit(membership)}
        className="group relative w-full aspect-[1.586/1] rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden border border-white/10 select-none bg-black cursor-pointer"
    >
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 bg-cover bg-center brightness-90 saturate-[1.2] transition-transform duration-700 group-hover:scale-110" style={gradientBackground}></div>
      
      {/* Dynamic Glow Overlay */}
      <div className="absolute inset-0 z-0 opacity-40 group-hover:opacity-60 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 100% 0%, ${toRgba(cardColor, 0.4)} 0%, transparent 60%)` }} />
      <div className="absolute -inset-24 z-0 bg-white/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-white/10 transition-colors" />

      {/* Texture & Watermark */}
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
      {!hasLogo && (
        <div className="absolute -right-8 -bottom-8 text-white opacity-10 z-0 pointer-events-none transform rotate-12 transition-transform duration-700 group-hover:rotate-0">
             <span className="material-symbols-outlined text-[160px] leading-none">{membership.icon || 'loyalty'}</span>
        </div>
      )}
      
      {/* Actions (Floating) */}
      <div className="absolute top-6 right-6 z-30 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }}
            className="w-10 h-10 rounded-2xl bg-black/20 hover:bg-rose-500 text-white flex items-center justify-center backdrop-blur-xl border border-white/10 transition-all shadow-xl"
            title="Delete"
          >
             <span className="material-symbols-outlined text-sm">delete</span>
          </button>
      </div>

      {/* Main Content Layout */}
      <div className="relative z-10 flex flex-col justify-between h-full p-6 text-white">
        
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
             <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${hasLogo ? 'bg-white dark:bg-white/10' : 'bg-white/10'}`}>
                    {hasLogo ? (
                        <img 
                            src={logoUrl!} 
                            alt={membership.provider} 
                            className="w-full h-full object-cover" 
                            onError={() => setLogoError(true)}
                        />
                    ) : (
                        <span className="material-symbols-outlined text-2xl text-white/80">{membership.icon || 'loyalty'}</span>
                    )}
                </div>
                
                <div className="flex flex-col">
                    <h3 className="font-bold text-xl leading-none drop-shadow-lg tracking-tight">{membership.provider}</h3>
                    {membership.tier && (
                        <span className="text-[10px] font-black  tracking-[0.2em] text-white/60 mt-1">{membership.category || 'Membership'}</span>
                    )}
                </div>
             </div>
             
             {membership.tier && (
                <div className="px-3 py-1 rounded-xl text-[9px] font-black  tracking-widest bg-white/20 backdrop-blur-xl border border-white/10 shadow-lg group-hover:bg-white transition-colors group-hover:text-black">
                    {membership.tier}
                </div>
             )}
        </div>

        {/* Middle: ID */}
        <div className="flex flex-col justify-center flex-grow py-4">
             <div 
                onClick={handleCopyId}
                className="group/id inline-flex flex-col text-left hover:bg-white/10 p-2 -ml-2 rounded-2xl transition-all duration-300 relative w-fit"
             >
                <span className="text-[9px] font-black  tracking-widest text-white/50 mb-1">Asset ID</span>
                <div className="flex items-center gap-4">
                    <span className="font-mono text-2xl font-bold tracking-[0.15em] drop-shadow-xl text-white">
                        {membership.memberId}
                    </span>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-xl transition-all duration-300 ${copied ? 'bg-emerald-400 text-black scale-110' : 'bg-white/20 text-white scale-90 opacity-0 group-hover/id:opacity-100'}`}>
                        <span className="material-symbols-outlined text-[10px] font-black">
                            {copied ? 'check' : 'content_copy'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Bottom Details Grid */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
             <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black  tracking-widest text-white/40">Holder</span>
                <span className="text-xs font-black tracking-tight truncate">{membership.holderName || 'Card Holder'}</span>
             </div>
             <div className="flex flex-col gap-1 text-right">
                <span className="text-[8px] font-black  tracking-widest text-white/40">Status / Balance</span>
                <span className="text-xs font-black tracking-tight text-white tabular-nums">
                    {membership.points || (isExpired ? 'EXPIRED' : formattedExpiry !== 'Never' ? `VAL: ${formattedExpiry}` : 'ACTIVE')}
                </span>
             </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyCard;

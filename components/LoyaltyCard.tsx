import React, { useMemo, useState } from 'react';
import { Membership } from '../types';
import { parseDateAsUTC } from '../utils';

interface LoyaltyCardProps {
  membership: Membership;
  onEdit: (membership: Membership) => void;
  onDelete: (id: string) => void;
}

const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
  const [isFlipped, setIsFlipped] = useState(false);

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
    ? parseDateAsUTC(membership.expiryDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : 'No Expiry';

  const isExpired = useMemo(() => {
    if (!membership.expiryDate) return false;
    return new Date(membership.expiryDate) < new Date();
  }, [membership.expiryDate]);

  const gradientBackground = useMemo(() => ({
    background: `radial-gradient(circle at 20% 20%, ${toRgba(cardColor, 0.32)} 0, transparent 35%),
                 radial-gradient(circle at 80% 10%, ${toRgba(cardColor, 0.28)} 0, transparent 30%),
                 radial-gradient(circle at 50% 100%, rgba(255,255,255,0.12) 0, transparent 40%),
                 linear-gradient(135deg, ${toRgba(cardColor, 0.92)} 0%, ${toRgba(cardColor, 0.7)} 55%, #0f172a 120%)`,
  }), [cardColor]);

  const pillStyles = 'px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em]';

  return (
    <div
      className="group relative w-full aspect-[1.65/1] perspective-1000 cursor-pointer select-none"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>

        {/* Front Face */}
        <div
          className="absolute inset-0 w-full h-full backface-hidden rounded-3xl shadow-2xl overflow-hidden border border-white/10"
          style={gradientBackground}
        >
          <div className="absolute inset-0 opacity-15 bg-[linear-gradient(120deg,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/30"></div>

          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-start justify-between p-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-inner border border-white/20">
                  <span className="material-symbols-outlined text-2xl">{membership.icon || 'loyalty'}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xl text-white leading-tight break-words drop-shadow">{membership.provider}</h3>
                  <p className="text-[11px] text-white/70 uppercase tracking-[0.28em] font-semibold break-words">
                    {membership.category || 'Loyalty Member'}
                  </p>
                </div>
              </div>
              {membership.tier && (
                <span className={`${pillStyles} bg-white/20 text-white backdrop-blur-sm border border-white/20 shadow-sm`}>{membership.tier}</span>
              )}
            </div>

            <div className="flex-1 px-6 pb-6 flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-10 rounded-lg bg-black/30 border border-white/15 shadow-inner flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/80">credit_card</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-white/70 tracking-[0.18em] font-semibold">Member ID</span>
                  <p className="font-mono text-2xl text-white tracking-[0.18em] font-semibold break-all drop-shadow-sm">
                    {membership.memberId}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-white/60 uppercase tracking-[0.18em] font-semibold">Status</span>
                  <span className="text-sm text-white font-semibold">{isExpired ? 'Expired' : 'Active'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-white/60 uppercase tracking-[0.18em] font-semibold">Valid Thru</span>
                  <span className={`text-sm font-semibold ${isExpired ? 'text-red-200' : 'text-white'}`}>{formattedExpiry}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-white/60 uppercase tracking-[0.18em] font-semibold">Category</span>
                  <span className="text-sm text-white font-semibold truncate">{membership.category || 'General'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 w-full h-full backface-hidden [transform:rotateY(180deg)] rounded-3xl shadow-2xl overflow-hidden border border-white/10"
          style={gradientBackground}
        >
          <div className="absolute inset-0 opacity-15 bg-[linear-gradient(120deg,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10"></div>

          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-inner border border-white/20">
                  <span className="material-symbols-outlined text-2xl">{membership.icon || 'loyalty'}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xl text-white leading-tight break-words drop-shadow">{membership.provider}</h3>
                  <p className="text-[11px] text-white/70 uppercase tracking-[0.28em] font-semibold break-words">{membership.tier || 'Member'}</p>
                </div>
              </div>
              <span className={`${pillStyles} bg-black/30 text-white border border-white/15 backdrop-blur-sm`}>Loyalty Wallet</span>
            </div>

            <div className="px-6 flex-1 flex flex-col gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4 shadow-inner">
                <dl className="grid grid-cols-2 gap-3 text-white text-sm">
                  <div>
                    <dt className="text-[10px] uppercase text-white/60 tracking-[0.2em] font-semibold">Member ID</dt>
                    <dd className="font-mono text-base break-all">{membership.memberId}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-white/60 tracking-[0.2em] font-semibold">Valid Thru</dt>
                    <dd className={`font-semibold ${isExpired ? 'text-red-200' : 'text-white'}`}>{formattedExpiry}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-white/60 tracking-[0.2em] font-semibold">Category</dt>
                    <dd className="font-semibold truncate">{membership.category || 'General'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-white/60 tracking-[0.2em] font-semibold">Tier</dt>
                    <dd className="font-semibold">{membership.tier || 'Standard'}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex-1 bg-black/20 border border-white/10 rounded-2xl backdrop-blur-sm p-4 text-white/80 text-sm leading-relaxed">
                {membership.notes ? (
                  <p className="whitespace-pre-wrap break-words">{membership.notes}</p>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/50 text-xs">No additional notes saved.</div>
                )}
              </div>
            </div>

            <div className="p-4 mt-auto flex items-center justify-between gap-3 bg-black/30 backdrop-blur-sm border-t border-white/10">
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <span className="material-symbols-outlined text-base">loyalty</span>
                <span className="uppercase tracking-[0.2em] font-semibold">Tap to flip</span>
              </div>
              <div className="flex items-center gap-2">
                {membership.website && (
                  <a
                    href={membership.website}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-gray-700 hover:text-primary-600 hover:scale-105 transition-all shadow-sm border border-black/10"
                    title="Visit Website"
                  >
                    <span className="material-symbols-outlined text-base">public</span>
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(membership); }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 text-white hover:bg-white/30 hover:scale-105 transition-all shadow-sm border border-white/15"
                  title="Edit"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(membership.id); }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-red-500/80 text-white hover:bg-red-500 hover:scale-105 transition-all shadow-sm border border-white/15"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoyaltyCard;

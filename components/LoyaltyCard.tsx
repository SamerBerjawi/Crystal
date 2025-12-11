import React, { useMemo } from 'react';
import { Membership } from '../types';
import { parseDateAsUTC } from '../utils';

interface LoyaltyCardProps {
  membership: Membership;
  onEdit: (membership: Membership) => void;
  onDelete: (id: string) => void;
}

const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ membership, onEdit, onDelete }) => {
  const normalizeColor = (hexColor: string) => hexColor.replace('#', '');

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
    <div className="relative w-full max-w-2xl aspect-[1.6/1] select-none">
      <div
        className="absolute inset-0 w-full h-full rounded-3xl shadow-2xl overflow-hidden border border-white/10"
        style={gradientBackground}
      >
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(120deg,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/30"></div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-start justify-between p-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-inner border border-white/20">
                <span className="material-symbols-outlined text-3xl">{membership.icon || 'loyalty'}</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-2xl text-white leading-tight break-words drop-shadow">{membership.provider}</h3>
                <p className="text-[11px] text-white/70 uppercase tracking-[0.28em] font-semibold break-words">
                  {membership.category || 'Loyalty Member'}
                </p>
              </div>
            </div>
            {membership.tier && (
              <span className={`${pillStyles} bg-white/20 text-white backdrop-blur-sm border border-white/20 shadow-sm`}>{membership.tier}</span>
            )}
          </div>

          <div className="flex-1 px-6 pb-6 flex flex-col gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-12 rounded-xl bg-black/30 border border-white/15 shadow-inner flex items-center justify-center">
                <span className="material-symbols-outlined text-white/80 text-xl">credit_card</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase text-white/70 tracking-[0.18em] font-semibold">Member ID</span>
                <p className="font-mono text-3xl text-white tracking-[0.18em] font-semibold break-all drop-shadow-sm">
                  {membership.memberId}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
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
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/60 uppercase tracking-[0.18em] font-semibold">Tier</span>
                <span className="text-sm text-white font-semibold">{membership.tier || 'Standard'}</span>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-5 gap-4">
              <div className="col-span-3 bg-black/30 border border-white/15 rounded-2xl backdrop-blur p-4 text-white/90 text-sm leading-relaxed overflow-auto shadow-inner">
                {membership.notes ? (
                  <p className="whitespace-pre-wrap break-words">{membership.notes}</p>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/50 text-xs">No additional notes saved.</div>
                )}
              </div>
              <div className="col-span-2 flex flex-col gap-3">
                {membership.website && (
                  <a
                    href={membership.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between w-full rounded-2xl bg-white text-gray-800 hover:text-primary-600 hover:scale-[1.02] transition-all shadow-sm border border-black/10 px-4 py-3"
                    title="Visit Website"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-lg">public</span>
                      <span className="text-sm font-semibold truncate">Website</span>
                    </div>
                    <span className="material-symbols-outlined text-base text-gray-500">open_in_new</span>
                  </a>
                )}

                <button
                  onClick={() => onEdit(membership)}
                  className="flex items-center justify-between w-full rounded-2xl bg-white/20 text-white hover:bg-white/30 hover:scale-[1.02] transition-all shadow-sm border border-white/15 px-4 py-3"
                  title="Edit"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg">edit</span>
                    <span className="text-sm font-semibold">Edit</span>
                  </div>
                  <span className="material-symbols-outlined text-base text-white/70">chevron_right</span>
                </button>

                <button
                  onClick={() => onDelete(membership.id)}
                  className="flex items-center justify-between w-full rounded-2xl bg-red-500/85 text-white hover:bg-red-500 hover:scale-[1.02] transition-all shadow-sm border border-white/15 px-4 py-3"
                  title="Delete"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg">delete</span>
                    <span className="text-sm font-semibold">Delete</span>
                  </div>
                  <span className="material-symbols-outlined text-base text-white/80">chevron_right</span>
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

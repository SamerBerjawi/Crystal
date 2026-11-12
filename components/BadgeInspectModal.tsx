import React from 'react';
import Icon from './ui/Icon';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { fireConfetti } from './ui/Confetti';

export type BadgeRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface BadgeItem {
  id: string;
  group: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
}

export const getBadgeRarity = (id: string): {
  rarity: BadgeRarity;
  xp: number;
  glowClass: string;
  badgeTone: 'neutral' | 'blue' | 'purple' | 'butter';
  textColor: string;
  bgGradient: string;
} => {
  switch (id) {
    case '1percent':
    case 'crypto_whale':
    case 'prophet':
    case 'high_roller':
      return {
        rarity: 'Legendary',
        xp: 500,
        glowClass: 'ring-2 ring-amber-400/60 shadow-amber-500/30 shadow-xl',
        badgeTone: 'butter',
        textColor: 'text-amber-400',
        bgGradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
      };
    case 'safety':
    case 'oracle':
    case 'debtfree':
    case 'goal_getter':
    case 'collector':
      return {
        rarity: 'Epic',
        xp: 300,
        glowClass: 'ring-2 ring-purple-400/60 shadow-purple-500/30 shadow-xl',
        badgeTone: 'purple',
        textColor: 'text-purple-400',
        bgGradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
      };
    case 'streak':
    case 'crystal':
    case 'credit_ace':
    case 'bill_crusher':
    case 'investor':
    case 'automator':
      return {
        rarity: 'Rare',
        xp: 200,
        glowClass: 'ring-1.5 ring-cyan-400/50 shadow-cyan-500/20 shadow-lg',
        badgeTone: 'blue',
        textColor: 'text-cyan-400',
        bgGradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
      };
    default:
      return {
        rarity: 'Common',
        xp: 100,
        glowClass: 'ring-1 ring-line',
        badgeTone: 'neutral',
        textColor: 'text-muted',
        bgGradient: 'from-slate-500/10 to-transparent',
      };
  }
};

interface BadgeInspectModalProps {
  badge: BadgeItem | null;
  onClose: () => void;
}

export const BadgeInspectModal: React.FC<BadgeInspectModalProps> = ({ badge, onClose }) => {
  if (!badge) return null;

  const { rarity, xp, badgeTone, textColor, bgGradient } = getBadgeRarity(badge.id);

  const handleCelebrate = () => {
    fireConfetti({ particleCount: 75, spread: 65 });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={badge.title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-2xl)] border border-line bg-surface-card p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient background glow */}
        <div className={`absolute inset-0 bg-gradient-to-b ${bgGradient} opacity-50 pointer-events-none`} />

        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-inset text-muted hover:text-ink transition-colors"
        >
          <Icon name="cancel-01" size={16} />
        </button>

        {/* Badge Centerpiece */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative mb-4 mt-2">
            <div className={`flex size-24 items-center justify-center rounded-3xl border ${badge.unlocked ? 'border-primary/40 bg-surface-card shadow-xl' : 'border-line bg-inset/50 text-muted'}`}>
              <Icon
                name={badge.unlocked ? badge.icon : 'square-lock-02'}
                size={44}
                className={badge.unlocked ? textColor : 'text-muted'}
              />
            </div>
            {badge.unlocked && (
              <span className="absolute -bottom-2 -right-2 flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <Icon name="tick-02" size={16} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-1">
            <Badge tone={badgeTone}>{rarity.toUpperCase()}</Badge>
            <span className="text-xs font-semibold text-primary">+{xp} XP</span>
          </div>

          <h3 className="type-page-title text-ink mt-1">{badge.title}</h3>
          <p className="type-caption text-muted mt-0.5">{badge.group}</p>

          <p className="type-body text-ink/80 mt-3 max-w-xs">{badge.description}</p>

          {/* Progress Section */}
          <div className="w-full mt-6 rounded-xl border border-line bg-inset/60 p-3.5 text-left">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted font-medium">Achievement Status</span>
              <span className="font-bold text-ink">
                {badge.unlocked ? 'Unlocked 🏆' : `${Math.round(badge.progress)}% completed`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${badge.unlocked ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, Math.max(0, badge.progress))}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex w-full gap-2 mt-6">
            {badge.unlocked ? (
              <Button
                variant="primary"
                className="w-full justify-center"
                icon="sparkles"
                onPress={handleCelebrate}
              >
                Celebrate! 🎉
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="w-full justify-center"
                onPress={onClose}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

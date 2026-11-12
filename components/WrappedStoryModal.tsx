import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import type { Wrapped as WrappedData, WrappedRank } from '../utils/wrappedModel';
import { wrappedDate } from '../utils/wrappedModel';
import { formatCurrency, getMainCurrency } from '../utils';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { Button } from './ui/Actions';
import { EntityGlyph, MerchantLogo } from './EntityIcon';
import { fireConfetti } from './ui/Confetti';

export interface Archetype {
  id: string;
  title: string;
  badge: string;
  icon: string;
  tagline: string;
  description: string;
  themeGradient: string;
  accentColor: string;
}

export const getFinancialArchetype = (w: WrappedData): Archetype => {
  const savingsRate = w.savingsRate ?? 0;
  const noSpendStreak = w.longestNoSpendStreak.days;
  const topMerchantSpendRatio = (w.topMerchants[0]?.total ?? 0) / (w.expense || 1);

  if (savingsRate >= 0.35 && w.saved > 0) {
    return {
      id: 'master-architect',
      title: 'The Master Architect',
      badge: '👑',
      icon: 'crown',
      tagline: 'Empire Builder',
      description: `You commanded an extraordinary ${Math.round(savingsRate * 100)}% savings rate, turning surplus capital into a towering fortress of financial independence.`,
      themeGradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
      accentColor: '#f59e0b',
    };
  }

  if (savingsRate >= 0.20 && w.saved > 0) {
    return {
      id: 'fortress-guardian',
      title: 'The Fortress Guardian',
      badge: '🛡️',
      icon: 'shield-02',
      tagline: 'Resilient & Disciplined',
      description: `Steady, calculated, and disciplined. Keeping ${Math.round(savingsRate * 100)}% of your earnings means you can weather any storm without breaking stride.`,
      themeGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      accentColor: '#10b981',
    };
  }

  if (noSpendStreak >= 6) {
    return {
      id: 'zen-minimalist',
      title: 'The Zen Minimalist',
      badge: '🧘',
      icon: 'target-01',
      tagline: 'Master of Intentionality',
      description: `With a tranquil ${noSpendStreak}-day zero-spending streak, you proved you have complete serenity and control over impulsive impulses.`,
      themeGradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
      accentColor: '#06b6d4',
    };
  }

  if (topMerchantSpendRatio >= 0.20 && w.topMerchants[0]) {
    return {
      id: 'loyal-connoisseur',
      title: 'The Loyal Connoisseur',
      badge: '🎯',
      icon: 'award-01',
      tagline: `Devoted to ${w.topMerchants[0].label}`,
      description: `When you find something you love, you stay true. Over ${Math.round(topMerchantSpendRatio * 100)}% of your spending was dedicated to your signature spots.`,
      themeGradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
      accentColor: '#8b5cf6',
    };
  }

  if (w.transactionCount >= 200) {
    return {
      id: 'high-velocity',
      title: 'The High-Velocity Mover',
      badge: '⚡',
      icon: 'zap',
      tagline: 'Dynamic & Action-Oriented',
      description: `A whirlwind of activity across ${w.transactionCount.toLocaleString()} transactions. You kept commerce flowing every single week of the year!`,
      themeGradient: 'from-orange-500/20 via-amber-500/10 to-transparent',
      accentColor: '#f97316',
    };
  }

  return {
    id: 'experience-collector',
    title: 'The Experience Collector',
    badge: '🌟',
    icon: 'sparkles',
    tagline: 'Living Life in Full Color',
    description: `You made ${w.year} count with memorable experiences, prioritising life, memories, and making each moment count.`,
    themeGradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
    accentColor: '#ec4899',
  };
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SLIDE_DURATION = 5500; // 5.5 seconds per slide
const TOTAL_SLIDES = 7;

interface WrappedStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  wrapped: WrappedData;
  categoryMap: Map<string, { icon?: string; color?: string }>;
  isPrivate?: boolean;
}

export const WrappedStoryModal: React.FC<WrappedStoryModalProps> = ({
  isOpen,
  onClose,
  wrapped,
  categoryMap,
  isPrivate = false,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);
  const currency = getMainCurrency();

  const archetype = useMemo(() => getFinancialArchetype(wrapped), [wrapped]);

  const goToNextSlide = useCallback(() => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide(prev => prev + 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
    } else {
      onClose();
    }
  }, [currentSlide, onClose]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
    }
  }, [currentSlide]);

  // Trigger confetti on celebratory slides
  useEffect(() => {
    if (!isOpen) return;
    if (currentSlide === 0) {
      const timer = setTimeout(() => {
        fireConfetti({ particleCount: 70, spread: 60 });
      }, 500);
      return () => clearTimeout(timer);
    }
    if (currentSlide === 1) {
      const timer = setTimeout(() => {
        fireConfetti({ particleCount: 60, spread: 50 });
      }, 600);
      return () => clearTimeout(timer);
    }
    if (currentSlide === 6) {
      const timer = setTimeout(() => {
        fireConfetti({ particleCount: 110, spread: 80 });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentSlide, isOpen]);

  // Main story tick timer
  useEffect(() => {
    if (!isOpen) return;

    if (isPaused) {
      elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
      return;
    }

    startTimeRef.current = Date.now();
    const interval = 25; // 40fps progress bar updates

    const intervalId = window.setInterval(() => {
      const totalElapsed = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current);
      const newProgress = Math.min(1, totalElapsed / SLIDE_DURATION);
      setProgress(newProgress);

      if (newProgress >= 1) {
        goToNextSlide();
      }
    }, interval);

    return () => clearInterval(intervalId);
  }, [isOpen, isPaused, currentSlide, goToNextSlide]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      setProgress(0);
      setIsPaused(false);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevSlide();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNextSlide, goToPrevSlide, onClose]);

  const copyShareText = async () => {
    const money = (v: number) => isPrivate ? '•••' : formatCurrency(v, currency);
    const savingsPct = wrapped.savingsRate !== undefined ? `${Math.round(wrapped.savingsRate * 100)}%` : '0%';
    const text = [
      `✨ My ${wrapped.year} Wrapped on Crystal ✨`,
      `🏆 Money Archetype: ${archetype.badge} ${archetype.title}`,
      `💰 Saved & Kept: ${money(wrapped.saved)} (${savingsPct} savings rate)`,
      `🛒 Favorite Spot: ${wrapped.topMerchants[0]?.label || 'Everywhere'} (${wrapped.topMerchants[0]?.count || 0} visits)`,
      `🧊 Longest Freeze: ${wrapped.longestNoSpendStreak.days} consecutive days`,
      `📊 Total Transactions: ${wrapped.transactionCount.toLocaleString()}`,
      `#CrystalWrapped #${wrapped.year}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Story recap copied to clipboard! 📋');
    } catch {
      toast.error('Could not copy recap');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 select-none"
        role="dialog"
        aria-modal="true"
        aria-label={`${wrapped.year} Annual Wrapped Story`}
      >
        {/* Story Card Container */}
        <div
          className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-slate-950 text-white sm:h-[820px] sm:max-h-[92vh] sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Ambient dynamic background lighting */}
          <div className={`absolute inset-0 bg-gradient-to-b ${archetype.themeGradient} opacity-60 pointer-events-none transition-colors duration-700`} />
          <div className="absolute -top-32 -left-32 size-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 size-64 rounded-full bg-chart-4/20 blur-3xl pointer-events-none" />

          {/* Top Header: Progress Segments & Controls */}
          <div className="relative z-20 flex flex-col gap-3 px-4 pt-4 pb-2">
            {/* 7 Progress Bars */}
            <div className="flex w-full items-center gap-1.5">
              {Array.from({ length: TOTAL_SLIDES }).map((_, index) => {
                let fill = 0;
                if (index < currentSlide) fill = 1;
                else if (index === currentSlide) fill = progress;

                return (
                  <div
                    key={index}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/20 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentSlide(index);
                      setProgress(0);
                      elapsedBeforePauseRef.current = 0;
                    }}
                  >
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-75"
                      style={{ width: `${fill * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Header controls */}
            <div className="flex items-center justify-between text-xs text-white/80">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-wide text-white uppercase text-[11px]">Crystal Wrapped</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono font-medium text-white/90">
                  {wrapped.year}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={isPaused ? 'Resume story' : 'Pause story'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(prev => !prev);
                  }}
                  className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <Icon name={isPaused ? 'play' : 'pause'} size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Close story"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <Icon name="cancel-01" size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Tap Zones (Previous / Next) */}
          <button
            type="button"
            aria-label="Previous slide"
            className="absolute top-16 bottom-16 left-0 z-10 w-1/4 cursor-w-resize opacity-0"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevSlide();
            }}
          />
          <button
            type="button"
            aria-label="Next slide"
            className="absolute top-16 bottom-16 right-0 z-10 w-3/4 cursor-e-resize opacity-0"
            onClick={(e) => {
              e.stopPropagation();
              goToNextSlide();
            }}
          />

          {/* Main Slide Content Area */}
          <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-4">
            <AnimatePresence mode="wait">
              {currentSlide === 0 && (
                <motion.div
                  key="slide-0"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-chart-4 text-white shadow-lg shadow-primary/30">
                    <Icon name="sparkles" size={32} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">The Big Picture</p>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                      Your {wrapped.year} in Money
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      Across {wrapped.transactionCount.toLocaleString()} transactions, here is where the journey led.
                    </p>
                  </div>

                  {/* Net Kept Hero Showcase */}
                  <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                    <p className="text-xs text-white/60">At the end of the year, you kept</p>
                    <div className="mt-2 text-4xl font-extrabold text-white sm:text-5xl">
                      <Amount value={wrapped.saved} currency={currency} countUp />
                    </div>
                    {wrapped.savingsRate !== undefined && (
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                        <Icon name="arrow-up-01" size={14} />
                        <span>{Math.round(wrapped.savingsRate * 100)}% savings rate</span>
                      </div>
                    )}
                  </div>

                  <div className="grid w-full grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                      <span className="text-[11px] text-white/60">Total Income</span>
                      <p className="mt-1 text-lg font-bold text-money-in">
                        <Amount value={wrapped.income} currency={currency} />
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                      <span className="text-[11px] text-white/60">Total Spending</span>
                      <p className="mt-1 text-lg font-bold text-white">
                        <Amount value={wrapped.expense} currency={currency} />
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 1 && (
                <motion.div
                  key="slide-1"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">Your Money Persona</p>
                  
                  {/* Archetype Badge Emblem */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-60" style={{ background: archetype.accentColor }} />
                    <div className="relative flex size-28 items-center justify-center rounded-3xl border-2 border-white/20 bg-white/10 text-5xl shadow-2xl backdrop-blur-md">
                      {archetype.badge}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                      {archetype.title}
                    </h2>
                    <span className="mt-1 inline-block text-xs font-semibold uppercase tracking-wider" style={{ color: archetype.accentColor }}>
                      {archetype.tagline}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-md">
                    <p className="text-sm leading-relaxed text-white/90">
                      {archetype.description}
                    </p>
                  </div>

                  <p className="text-xs text-white/50 italic">
                    Calculated from your saving velocity, spending consistency, and streak fortitude in {wrapped.year}.
                  </p>
                </motion.div>
              )}

              {currentSlide === 2 && (
                <motion.div
                  key="slide-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">Top Merchant</p>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Your VIP Sanctuary</h2>
                    <p className="mt-1 text-sm text-white/70">The place you frequented the most this year.</p>
                  </div>

                  {wrapped.topMerchants[0] ? (
                    <>
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-20 rounded-2xl border border-white/20 bg-white/10 p-2 shadow-xl flex items-center justify-center">
                          <MerchantLogo merchant={wrapped.topMerchants[0].label} size={56} className="rounded-xl" />
                        </div>
                        <h3 className="text-2xl font-bold text-white">{wrapped.topMerchants[0].label}</h3>
                      </div>

                      <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <span className="text-xs text-white/60">Total Spent</span>
                            <p className="mt-1 text-xl font-extrabold text-white">
                              <Amount value={wrapped.topMerchants[0].total} currency={currency} />
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-white/60">Visits / Orders</span>
                            <p className="mt-1 text-xl font-extrabold text-white">
                              {wrapped.topMerchants[0].count} times
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-white/70">
                        Representing {Math.round((wrapped.topMerchants[0].total / (wrapped.expense || 1)) * 100)}% of your entire annual spending!
                      </p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
                      No merchant data recorded for this year.
                    </div>
                  )}
                </motion.div>
              )}

              {currentSlide === 3 && (
                <motion.div
                  key="slide-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">Category Podium</p>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Where It Flowed</h2>
                    <p className="mt-1 text-sm text-white/70">Your top 3 spending categories of {wrapped.year}.</p>
                  </div>

                  {/* 3D Olympic Podium */}
                  <div className="flex w-full items-end justify-center gap-2 pt-6 pb-2">
                    {/* 2nd Place (Left) */}
                    {wrapped.topCategories[1] && (
                      <div className="flex flex-1 flex-col items-center">
                        <div className="mb-2 flex flex-col items-center">
                          <EntityGlyph
                            icon={categoryMap.get(wrapped.topCategories[1].label)?.icon}
                            label={wrapped.topCategories[1].label}
                            color={categoryMap.get(wrapped.topCategories[1].label)?.color}
                            size={24}
                          />
                          <span className="mt-1 text-xs font-semibold truncate max-w-[85px] text-white/90">
                            {wrapped.topCategories[1].label}
                          </span>
                          <span className="text-[11px] text-white/60">
                            <Amount value={wrapped.topCategories[1].total} currency={currency} />
                          </span>
                        </div>
                        <div className="w-full h-24 rounded-t-xl bg-slate-700/60 border-t border-x border-white/20 flex items-center justify-center text-lg font-bold text-slate-300">
                          🥈 2
                        </div>
                      </div>
                    )}

                    {/* 1st Place (Center - Tallest) */}
                    {wrapped.topCategories[0] && (
                      <div className="flex flex-1 flex-col items-center">
                        <div className="mb-2 flex flex-col items-center">
                          <div className="size-8 rounded-full bg-amber-500/20 flex items-center justify-center mb-1">
                            <Icon name="crown" size={18} className="text-amber-400" />
                          </div>
                          <EntityGlyph
                            icon={categoryMap.get(wrapped.topCategories[0].label)?.icon}
                            label={wrapped.topCategories[0].label}
                            color={categoryMap.get(wrapped.topCategories[0].label)?.color}
                            size={28}
                          />
                          <span className="mt-1 text-xs font-bold truncate max-w-[95px] text-white">
                            {wrapped.topCategories[0].label}
                          </span>
                          <span className="text-xs font-bold text-amber-300">
                            <Amount value={wrapped.topCategories[0].total} currency={currency} />
                          </span>
                        </div>
                        <div className="w-full h-36 rounded-t-xl bg-amber-500/30 border-t-2 border-x border-amber-400/50 flex items-center justify-center text-2xl font-black text-amber-300 shadow-lg shadow-amber-500/20">
                          🥇 1
                        </div>
                      </div>
                    )}

                    {/* 3rd Place (Right) */}
                    {wrapped.topCategories[2] && (
                      <div className="flex flex-1 flex-col items-center">
                        <div className="mb-2 flex flex-col items-center">
                          <EntityGlyph
                            icon={categoryMap.get(wrapped.topCategories[2].label)?.icon}
                            label={wrapped.topCategories[2].label}
                            color={categoryMap.get(wrapped.topCategories[2].label)?.color}
                            size={24}
                          />
                          <span className="mt-1 text-xs font-semibold truncate max-w-[85px] text-white/90">
                            {wrapped.topCategories[2].label}
                          </span>
                          <span className="text-[11px] text-white/60">
                            <Amount value={wrapped.topCategories[2].total} currency={currency} />
                          </span>
                        </div>
                        <div className="w-full h-18 rounded-t-xl bg-amber-800/40 border-t border-x border-white/20 flex items-center justify-center text-lg font-bold text-amber-600">
                          🥉 3
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {currentSlide === 4 && (
                <motion.div
                  key="slide-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">Calendar Odyssey</p>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Seasons of Fortune</h2>
                    <p className="mt-1 text-sm text-white/70">The high peaks and steep climbs of the calendar.</p>
                  </div>

                  <div className="w-full space-y-3">
                    {wrapped.bestMonth && (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Golden Month 🌟</span>
                          <span className="text-xs text-white/60">{MONTH_NAMES[wrapped.bestMonth.month]}</span>
                        </div>
                        <p className="mt-2 text-2xl font-extrabold text-white">
                          +<Amount value={wrapped.bestMonth.saved} currency={currency} /> kept
                        </p>
                        <p className="mt-1 text-xs text-emerald-200/80">
                          Your peak savings month! You mastered expenses while maximizing surplus.
                        </p>
                      </div>
                    )}

                    {wrapped.worstMonth && wrapped.worstMonth.month !== wrapped.bestMonth?.month && (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-rose-400">The Steep Climb 🏔️</span>
                          <span className="text-xs text-white/60">{MONTH_NAMES[wrapped.worstMonth.month]}</span>
                        </div>
                        <p className="mt-2 text-2xl font-extrabold text-white">
                          <Amount value={wrapped.worstMonth.expense} currency={currency} /> spent
                        </p>
                        <p className="mt-1 text-xs text-white/70">
                          Demanded the most resources, but you navigated right through to the other side.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {currentSlide === 5 && (
                <motion.div
                  key="slide-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center text-center space-y-5"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">Wild Superlatives</p>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Did You Know?</h2>
                    <p className="mt-1 text-sm text-white/70">Your most distinctive spending records in {wrapped.year}.</p>
                  </div>

                  <div className="w-full space-y-3 text-left">
                    {wrapped.biggestPurchase && (
                      <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                          <Icon name="receipt" size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-white/60">Whale Purchase 🐋</span>
                          <p className="text-sm font-bold text-white truncate">{wrapped.biggestPurchase.label}</p>
                          <p className="text-xs text-primary font-semibold">
                            <Amount value={wrapped.biggestPurchase.amount} currency={currency} /> • {wrappedDate(wrapped.biggestPurchase.date)}
                          </p>
                        </div>
                      </div>
                    )}

                    {wrapped.longestNoSpendStreak.days > 1 && (
                      <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                          <Icon name="target-01" size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-white/60">The Freeze Streak 🧊</span>
                          <p className="text-sm font-bold text-white">
                            {wrapped.longestNoSpendStreak.days} Consecutive Days
                          </p>
                          <p className="text-xs text-cyan-300">
                            Zero spending days! Totaling {wrapped.noSpendDays} calm days throughout {wrapped.year}.
                          </p>
                        </div>
                      </div>
                    )}

                    {wrapped.busiestDay && (
                      <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                          <Icon name="calendar-03" size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-white/60">Peak Activity Day ⚡</span>
                          <p className="text-sm font-bold text-white">
                            {wrapped.busiestDay.count} swipes in 24 hours
                          </p>
                          <p className="text-xs text-amber-300">
                            <Amount value={wrapped.busiestDay.total} currency={currency} /> on {wrappedDate(wrapped.busiestDay.date)}
                          </p>
                        </div>
                      </div>
                    )}

                    {wrapped.kilometres !== undefined && (
                      <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                          <Icon name="car-01" size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-white/60">Road Warrior 🛣️</span>
                          <p className="text-sm font-bold text-white">
                            {wrapped.kilometres.toLocaleString()} km traversed
                          </p>
                          <p className="text-xs text-purple-300">Logged on your journey</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {currentSlide === 6 && (
                <motion.div
                  key="slide-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center text-center space-y-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">Official Certificate</p>
                  
                  {/* Shareable Card Canvas */}
                  <div className="w-full rounded-2xl border-2 border-white/20 bg-gradient-to-b from-white/15 to-white/5 p-5 text-left backdrop-blur-xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 size-28 rounded-full bg-primary/30 blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{archetype.badge}</span>
                        <div>
                          <h4 className="text-base font-bold text-white">{archetype.title}</h4>
                          <span className="text-[11px] text-white/60">{archetype.tagline}</span>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-mono font-bold text-white">
                        {wrapped.year}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-4">
                      <div>
                        <span className="text-[10px] text-white/50 uppercase">Net Saved</span>
                        <p className="text-lg font-extrabold text-white">
                          <Amount value={wrapped.saved} currency={currency} />
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/50 uppercase">Savings Rate</span>
                        <p className="text-lg font-extrabold text-emerald-400">
                          {wrapped.savingsRate !== undefined ? `${Math.round(wrapped.savingsRate * 100)}%` : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/50 uppercase">Top Merchant</span>
                        <p className="text-sm font-bold text-white truncate">
                          {wrapped.topMerchants[0]?.label || 'None'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/50 uppercase">Freeze Streak</span>
                        <p className="text-sm font-bold text-cyan-300">
                          {wrapped.longestNoSpendStreak.days} Days
                        </p>
                      </div>
                      {wrapped.lifeEvents.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-white/50 uppercase">Moments</span>
                          <p className="text-sm font-bold text-white">
                            {wrapped.lifeEvents.slice(0, 3).map(event => event.title).join(' · ')}{wrapped.lifeEvents.length > 3 ? ` · +${wrapped.lifeEvents.length - 3} more` : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-white/40">
                      <span>Crystal Financial Operating System</span>
                      <span>100% Private & On-Device</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex w-full flex-col gap-2 pt-2">
                    <Button
                      variant="primary"
                      className="w-full justify-center shadow-lg shadow-primary/30"
                      icon="copy-01"
                      onPress={copyShareText}
                    >
                      Copy Story Recap
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 justify-center text-white/80 hover:text-white"
                        icon="refresh"
                        onPress={() => {
                          setCurrentSlide(0);
                          setProgress(0);
                          elapsedBeforePauseRef.current = 0;
                        }}
                      >
                        Replay
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1 justify-center"
                        onPress={onClose}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Tap Instruction indicator */}
          <div className="relative z-20 flex items-center justify-between px-6 pb-4 text-[11px] text-white/40">
            <span>Tap left to rewind</span>
            <span>Tap right to advance</span>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
};

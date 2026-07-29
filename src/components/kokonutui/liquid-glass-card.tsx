"use client";

/**
 * @author: @dorianbaffier
 * @description: Liquid Glass Card - Optimized with Shadcn UI
 * @version: 2.0.0
 * @date: 2025-10-11
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Pause,
  Play,
} from "lucide-react";
import React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Modern Glassmorphism styling
const GLASS_SHADOW =
  "shadow-xl shadow-black/5 dark:shadow-black/20 border border-white/30 dark:border-white/10";

// Glass Button - extends shadcn Button with glassmorphism effect
const liquidButtonVariants = cva(
  "relative transition-all duration-200 backdrop-blur-md bg-white/40 dark:bg-white/10 hover:bg-white/60 dark:hover:bg-white/20 border border-white/20 dark:border-white/10 text-foreground active:scale-[0.97]",
  {
    variants: {
      liquidVariant: {
        default:
          "motion-reduce:active:scale-100 motion-reduce:hover:scale-100 [@media(hover:hover)]:hover:scale-105",
        none: "",
      },
    },
    defaultVariants: {
      liquidVariant: "default",
    },
  }
);

export type LiquidButtonProps = ButtonProps &
  VariantProps<typeof liquidButtonVariants>;

function LiquidButton({
  className,
  liquidVariant = "default",
  children,
  ...props
}: LiquidButtonProps) {
  return (
    <Button
      className={cn(liquidButtonVariants({ liquidVariant }), className)}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </Button>
  );
}

// Glassmorphism Card - extends shadcn Card with clean glassmorphism effect
const liquidGlassCardVariants = cva(
  "group relative overflow-hidden bg-white/40 dark:bg-neutral-900/50 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-xl",
  {
    variants: {
      glassSize: {
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      glassSize: "default",
    },
  }
);

export type LiquidGlassCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof liquidGlassCardVariants> & {
    glassEffect?: boolean;
  };

function LiquidGlassCard({
  className,
  glassSize,
  glassEffect = true,
  children,
  ...props
}: LiquidGlassCardProps) {
  return (
    <Card
      className={cn(liquidGlassCardVariants({ glassSize }), className)}
      {...props}
    >
      <div className="relative z-10">{children}</div>
      <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 dark:via-white/5" />
    </Card>
  );
}

// Demo: Music Player Card
const TOTAL_DURATION = 45;
const VOLUME_BAR_COUNT = 8;
const SEEK_JUMP_SECONDS = 5;
const TIMER_INTERVAL_MS = 1000;
const STATIC_BAR_HEIGHT = "6px";
const MIN_TIME = 0;
const BAR_DELAY_INCREMENT = 0.1;
const PROGRESS_PERCENTAGE_MULTIPLIER = 100;

const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface VolumeBarsProps {
  isPlaying: boolean;
}

const VolumeBars = React.memo(({ isPlaying }: VolumeBarsProps) => {
  const bars = Array.from({ length: VOLUME_BAR_COUNT }, (_, i) => ({
    id: `bar-${i}`,
    delay: i * BAR_DELAY_INCREMENT,
  }));

  return (
    <div className="pointer-events-none flex h-8 w-10 items-end gap-0.5">
      {bars.map((bar) => (
        <div
          className={cn(
            "w-[3px] rounded-sm",
            isPlaying && "animate-bounce-music motion-reduce:animate-none"
          )}
          key={bar.id}
          style={{
            height: isPlaying ? undefined : STATIC_BAR_HEIGHT,
            animationDelay: `${bar.delay}s`,
            background: "linear-gradient(to top, #FF2E55, #FF6B88)",
          }}
        />
      ))}
    </div>
  );
});
VolumeBars.displayName = "VolumeBars";

interface ProgressBarProps {
  currentTime: number;
  totalDuration: number;
  onSeek: (newTime: number) => void;
}

const ProgressBar = React.memo(
  ({ currentTime, totalDuration, onSeek }: ProgressBarProps) => {
    const progress =
      (currentTime / totalDuration) * PROGRESS_PERCENTAGE_MULTIPLIER;

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = e.currentTarget;
      const rect = bar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      const newTime = Math.min(
        Math.max(MIN_TIME, percent * totalDuration),
        totalDuration
      );
      onSeek(newTime);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          onSeek(Math.min(currentTime + SEEK_JUMP_SECONDS, totalDuration));
          break;
        case "ArrowLeft":
          e.preventDefault();
          onSeek(Math.max(currentTime - SEEK_JUMP_SECONDS, MIN_TIME));
          break;
        case "Home":
          e.preventDefault();
          onSeek(MIN_TIME);
          break;
        case "End":
          e.preventDefault();
          onSeek(totalDuration);
          break;
        default:
          break;
      }
    };

    return (
      <>
        <div className="flex justify-between font-medium text-xs text-zinc-500 dark:text-zinc-400">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <span className="tabular-nums">{formatTime(totalDuration)}</span>
        </div>
        <div
          aria-label="Seek progress bar"
          aria-valuemax={totalDuration}
          aria-valuemin={MIN_TIME}
          aria-valuenow={currentTime}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(totalDuration)}`}
          className="relative z-10 h-1 w-full cursor-pointer overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="slider"
          tabIndex={0}
        >
          <div
            className="h-full bg-gradient-to-r from-[#FF2E55] to-[#FF6B88] transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </>
    );
  }
);
ProgressBar.displayName = "ProgressBar";

export function NotificationCenter() {
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(MIN_TIME);

  React.useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentTime((prev) =>
        prev + 1 >= TOTAL_DURATION ? TOTAL_DURATION : prev + 1
      );
    }, TIMER_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isPlaying]);

  React.useEffect(() => {
    if (currentTime >= TOTAL_DURATION) {
      setIsPlaying(false);
    }
  }, [currentTime]);

  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (newTime < TOTAL_DURATION && !isPlaying) {
      setIsPlaying(true);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <LiquidGlassCard className="gap-3.5 rounded-3xl border border-zinc-200/60 bg-gradient-to-br from-zinc-50 to-zinc-100 p-4 shadow-xl dark:border-zinc-700/60 dark:from-zinc-900 dark:to-black">
        <div className="flex items-center gap-3">
          <div className="relative mr-2 mb-4 h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-400 via-pink-300 to-rose-200 shadow-lg ring-1 ring-black/5 dark:shadow-xl">
            <img
              alt="Album Art for Glow by Echo"
              className="h-full w-full object-cover"
              height={64}
              src="https://ferf1mheo22r9ira.public.blob.vercel-storage.com/portrait2-x5MjJSaQ9ed0HZrewEhH7TkZwjZ66K.jpeg"
              width={64}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <h3 className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-lg text-zinc-900 dark:text-white">
              Glow
            </h3>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Echo
            </p>
          </div>

          <VolumeBars isPlaying={isPlaying} />
        </div>

        <div className="flex flex-col gap-2">
          <ProgressBar
            currentTime={currentTime}
            onSeek={handleSeek}
            totalDuration={TOTAL_DURATION}
          />

          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center justify-center gap-2">
              <LiquidButton
                aria-label="Previous track"
                className="h-10 w-10 rounded-full bg-transparent text-zinc-700 transition-colors hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                size="icon"
                variant="ghost"
              >
                <ArrowLeft className="size-4" />
              </LiquidButton>
              <LiquidButton
                aria-label={isPlaying ? "Pause" : "Play"}
                className="h-11 w-11 rounded-full bg-transparent text-zinc-700 transition-colors hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                onClick={handlePlayPause}
                size="icon"
                variant="ghost"
              >
                {isPlaying ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5" />
                )}
              </LiquidButton>
              <LiquidButton
                aria-label="Next track"
                className="h-10 w-10 rounded-full bg-transparent text-zinc-700 transition-colors hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                size="icon"
                variant="ghost"
              >
                <ArrowRight className="size-4" />
              </LiquidButton>
            </div>
            <LiquidButton
              aria-label="More options"
              className="h-10 w-10 rounded-full bg-transparent text-zinc-700 transition-colors hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </LiquidButton>
          </div>
        </div>
      </LiquidGlassCard>
    </div>
  );
}

export { LiquidButton, LiquidGlassCard };
export default NotificationCenter;

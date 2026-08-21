"use client";

import { cn } from '@/lib/utils';

export type GameLoadStatus = 'idle' | 'loading' | 'playing';

interface GamePlayButtonProps {
  gameTitle: string;
  status: GameLoadStatus;
  onClick: () => void;
  onTransitionComplete: () => void;
  nudgeToken?: number;
}

export function GamePlayButton({
  gameTitle,
  status,
  onClick,
  onTransitionComplete,
  nudgeToken = 0,
}: GamePlayButtonProps) {
  const isLoading = status === 'loading';
  const isNudged = status === 'idle' && nudgeToken > 0;
  const label = isLoading ? 'Loading game...' : 'Play now';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      aria-label={`${label} - ${gameTitle}`}
      aria-busy={isLoading}
      className={cn(
        'group relative mx-auto inline-flex min-h-11 w-[150px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl',
        'bg-gradient-to-r from-green-700 via-green-600 to-green-500 px-5 py-2.5 text-sm font-bold text-white',
        'shadow-[0_5px_16px_rgba(22,101,52,0.28)] transition-all duration-200 ease-out',
        'hover:scale-[1.04] hover:shadow-[0_9px_28px_rgba(34,197,94,0.38)]',
        'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-700',
        'sm:min-h-[52px] sm:w-[170px] sm:px-7 sm:py-3 sm:text-base',
        'motion-reduce:transform-none motion-reduce:animate-none',
        isLoading
          ? 'cursor-wait hover:scale-100'
          : 'motion-safe:animate-pulse-subtle [animation-iteration-count:3] hover:animate-none',
      )}
    >
      {isNudged && (
        <span
          key={`play-nudge-color-${nudgeToken}`}
          aria-hidden="true"
          className="play-nudge-color pointer-events-none absolute inset-0 rounded-2xl"
        />
      )}
      <span className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 group-hover:bg-white/10" />
      <span
        className="relative z-10 flex items-center justify-center gap-2 sm:gap-2.5"
      >
        <span
          key={`play-icon-${nudgeToken}`}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-green-700 shadow-sm sm:h-7 sm:w-7',
            isLoading && 'animate-play-button-icon-exit',
            isNudged && 'play-nudge-icon',
          )}
          onAnimationEnd={() => {
            if (isLoading) onTransitionComplete();
          }}
        >
          <span
            aria-hidden="true"
            className="translate-x-px text-[11px] transition-transform duration-200 group-hover:translate-x-[3px] sm:text-xs"
          >
            ▶
          </span>
        </span>
        <span className={isLoading ? 'invisible' : undefined}>Play now</span>
      </span>

      <span className="sr-only" aria-live="polite">{label}</span>
    </button>
  );
}

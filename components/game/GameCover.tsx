"use client";

import Image from "next/image";
import type { GameLoadStatus } from "@/components/YouXi/GamePlayButton";
import { GamePlayButton } from "@/components/YouXi/GamePlayButton";

interface GameCoverProps {
  title: string;
  description?: string;
  tagline?: string;
  logoImage: string;
  backgroundImage: string;
  status: GameLoadStatus;
  playNudgeToken?: number;
  onStart: () => void;
  onTransitionComplete: () => void;
}

function createCoverTagline(title: string, description?: string) {
  const normalizedDescription = description?.replace(/\s+/g, " ").trim();
  if (!normalizedDescription) return `Play ${title} online.`;

  const firstSentence = normalizedDescription.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()
    ?? normalizedDescription;

  return firstSentence.length > 64
    ? `${firstSentence.slice(0, 61).trimEnd()}...`
    : firstSentence;
}

export function GameCover({
  title,
  description,
  tagline,
  logoImage,
  backgroundImage,
  status,
  playNudgeToken = 0,
  onStart,
  onTransitionComplete,
}: GameCoverProps) {
  const coverTagline = tagline || createCoverTagline(title, description);
  const canStart = status === "idle";

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${canStart ? "cursor-pointer" : ""}`}
      onClick={canStart ? onStart : undefined}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${JSON.stringify(backgroundImage)})` }}
      />

      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800/60 to-gray-900/60">
        <div className="flex max-h-full w-full max-w-lg flex-col items-center justify-center gap-1.5 rounded-2xl bg-gray-900/20 px-3 py-2 text-center transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] sm:gap-3 sm:px-5 sm:py-4 md:p-6">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl sm:h-16 sm:w-16 md:h-20 md:w-20 md:rounded-2xl">
            <Image
              src={logoImage}
              alt={`${title} Logo`}
              width={64}
              height={64}
              className="h-9 w-9 transform rounded-lg object-cover brightness-110 drop-shadow-2xl ring-2 ring-white ring-offset-0 transition-all duration-300 hover:scale-105 hover:brightness-125 sm:h-14 sm:w-14 sm:rounded-xl sm:ring-4 md:h-16 md:w-16"
            />
          </div>

          <div className="max-w-full truncate text-lg font-bold leading-tight text-white drop-shadow-lg sm:overflow-visible sm:whitespace-normal sm:text-clip sm:text-2xl md:text-3xl">
            {title}
          </div>

          <p
            className="hidden max-w-md truncate text-sm leading-5 text-white/80 drop-shadow sm:block"
            title={description}
          >
            {coverTagline}
          </p>

          <div onClick={(event) => event.stopPropagation()}>
            <GamePlayButton
              gameTitle={title}
              status={status}
              onClick={onStart}
              onTransitionComplete={onTransitionComplete}
              nudgeToken={playNudgeToken}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

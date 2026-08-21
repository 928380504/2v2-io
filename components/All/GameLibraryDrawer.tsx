"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Heart, X } from "lucide-react";
import { useEffect } from "react";
import {
  type LibraryGame,
  removeFavoriteGame,
  removeRecentGame,
} from "@/lib/game-library";

export type GameLibraryTab = "recent" | "favorites";

interface GameLibraryDrawerProps {
  isOpen: boolean;
  activeTab: GameLibraryTab;
  favorites: LibraryGame[];
  recents: LibraryGame[];
  onClose: () => void;
  onTabChange: (tab: GameLibraryTab) => void;
}

export function GameLibraryDrawer({
  isOpen,
  activeTab,
  favorites,
  recents,
  onClose,
  onTabChange,
}: GameLibraryDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const games = activeTab === "favorites" ? favorites : recents;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/40"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-library-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl dark:bg-[#103b22] lg:w-[18vw]"
      >
        <div className="relative flex h-[66px] shrink-0 items-center justify-center border-b border-gray-100 px-14 dark:border-white/10">
          <h2
            id="game-library-title"
            className="text-lg font-bold text-gray-950 dark:text-white"
          >
            My games
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close My games"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="My games sections"
          className="grid h-[58px] shrink-0 grid-cols-2 border-b border-gray-200 px-4 dark:border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "recent"}
            onClick={() => onTabChange("recent")}
            className={`relative flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
              activeTab === "recent"
                ? "text-green-700 dark:text-green-300"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Clock3 className="h-4 w-4" />
            Recent
            {activeTab === "recent" && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-green-600 dark:bg-green-400" />
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "favorites"}
            onClick={() => onTabChange("favorites")}
            className={`relative flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
              activeTab === "favorites"
                ? "text-red-500 dark:text-red-300"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Heart className="h-4 w-4" />
            Favorites
            {activeTab === "favorites" && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {games.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {games.map((game) => (
                <div key={game.id} className="group relative pt-1 pr-1">
                  <Link
                    href={game.url}
                    onClick={onClose}
                    className="relative block aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-green-400 group-hover:shadow-md dark:border-white/10 dark:bg-black/20 dark:group-hover:border-green-400/70"
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    <Image
                      src={game.image}
                      alt={game.title}
                      fill
                      sizes="(max-width: 1023px) 50vw, 18vw"
                      className="object-contain"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pb-2.5 pt-9">
                      <span className="block truncate text-sm font-bold text-white drop-shadow-sm">
                        {game.title}
                      </span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === "favorites") {
                        removeFavoriteGame(game.id);
                      } else {
                        removeRecentGame(game.id);
                      }
                    }}
                    aria-label={`Remove ${game.title} from ${
                      activeTab === "favorites" ? "favorites" : "recent games"
                    }`}
                    title="Remove"
                    className="absolute -right-0.5 -top-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-950 bg-rose-600 text-white shadow-md transition-all hover:scale-110 hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                  >
                    <X className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
                {activeTab === "favorites" ? (
                  <Heart className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                ) : (
                  <Clock3 className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <p className="mt-4 text-base font-bold text-gray-800 dark:text-gray-100">
                {activeTab === "favorites"
                  ? "No favorite games yet"
                  : "No recently played games yet"}
              </p>
              <p className="mt-1 max-w-[280px] text-sm leading-5 text-gray-500 dark:text-gray-400">
                {activeTab === "favorites"
                  ? "Tap the heart in a game’s control bar to save it here."
                  : "Games you visit will automatically appear here."}
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

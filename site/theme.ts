import type { CSSProperties } from "react";
import manifest from "@/site/manifest.json";

export const SITE_THEME = manifest.theme;

export const SITE_THEME_STYLE = {
  "--site-container-base-max-width": SITE_THEME.layout.gameBaseMaxWidth,
  "--site-container-desktop-width": SITE_THEME.layout.gameDesktopWidth,
  "--site-container-desktop-max-width": SITE_THEME.layout.gameDesktopMaxWidth,
  // Compatibility aliases for older site overrides.
  "--site-list-max-width": SITE_THEME.layout.listMaxWidth,
  "--site-game-base-max-width": SITE_THEME.layout.gameBaseMaxWidth,
  "--site-game-desktop-width": SITE_THEME.layout.gameDesktopWidth,
  "--site-game-desktop-max-width": SITE_THEME.layout.gameDesktopMaxWidth,
  "--site-page-light": SITE_THEME.colors.pageLight,
  "--site-page-dark": SITE_THEME.colors.pageDark,
  "--site-primary-light": SITE_THEME.colors.primaryLight,
  "--site-primary-dark": SITE_THEME.colors.primaryDark,
} as CSSProperties;

export const SITE_TAG_COLOR_CLASSES: Record<string, string> = {
  "1v1": "bg-green-100 text-green-700 ring-green-200 dark:bg-green-900/70 dark:text-green-200 dark:ring-green-700",
  "2v2": "bg-teal-100 text-teal-700 ring-teal-200 dark:bg-teal-900/70 dark:text-teal-200 dark:ring-teal-700",
  "3v3": "bg-cyan-100 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/70 dark:text-cyan-200 dark:ring-cyan-700",
  fps: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/70 dark:text-red-200 dark:ring-red-700",
  pvp: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/70 dark:text-red-200 dark:ring-red-700",
  building: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/70 dark:text-amber-200 dark:ring-amber-700",
  shooter: "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-900/70 dark:text-orange-200 dark:ring-orange-700",
  "battle royale": "bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-900/70 dark:text-purple-200 dark:ring-purple-700",
  competitive: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/70 dark:text-rose-200 dark:ring-rose-700",
  multiplayer: "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-900/70 dark:text-blue-200 dark:ring-blue-700",
  arena: "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/70 dark:text-indigo-200 dark:ring-indigo-700",
  action: "bg-pink-100 text-pink-700 ring-pink-200 dark:bg-pink-900/70 dark:text-pink-200 dark:ring-pink-700",
  time: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-900/70 dark:text-sky-200 dark:ring-sky-700",
  puzzle: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-900/70 dark:text-violet-200 dark:ring-violet-700",
  voxel: "bg-lime-100 text-lime-700 ring-lime-200 dark:bg-lime-900/70 dark:text-lime-200 dark:ring-lime-700",
  zombies: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/70 dark:text-emerald-200 dark:ring-emerald-700",
  survival: "bg-yellow-100 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/70 dark:text-yellow-200 dark:ring-yellow-700",
  story: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-900/70 dark:text-violet-200 dark:ring-violet-700",
  tanks: "bg-slate-200 text-slate-700 ring-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600",
};

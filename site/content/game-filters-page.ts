import type { Metadata } from "next";
import { SITE_ROUTES } from "@/site/routes";
import { SITE_CONFIG, siteUrl } from "@/site/site";

export const GAME_FILTERS_PAGE = {
  path: SITE_ROUTES.gameFilters, legacyPath: SITE_ROUTES.legacyTags,
  heading: "Shooting Games", filteredHeadingSuffix: "Shooting Games",
  description: "Play free shooting games online. Filter by player mode, controls, load speed, gameplay, and perspective to find the right game faster.", resultNoun: "shooting game",
  attributesTitle: "Game Attributes", attributesDescription: "Combine the five fixed attributes to find matching games.",
  resultsTitle: "Available Games", emptyTitle: "No games match this combination yet.", clearLabel: "Clear filters", clearAllLabel: "Clear all",
  legacyMessage: "Game filters have moved.", legacyLinkLabel: "Open Shooting Games", siteName: SITE_CONFIG.brandName,
  metadataTitle: "Shooting Games - Play Free Online | 1v1-lol.cc", metadataDescription: "Play free shooting games online. Filter by player mode, controls, load speed, gameplay, and perspective to find the right game faster.",
  legacyMetadataTitle: "Shooting Games - 1v1-lol.cc", legacyMetadataDescription: "Browse free online shooting games by player mode, controls, load speed, gameplay, and perspective.",
} as const;

export type GameFiltersPageDefinition = typeof GAME_FILTERS_PAGE;
export function createGameFiltersMetadata(): Metadata { return { title: GAME_FILTERS_PAGE.metadataTitle, description: GAME_FILTERS_PAGE.metadataDescription, alternates: { canonical: siteUrl(GAME_FILTERS_PAGE.path) } }; }
export function createLegacyTagsMetadata(): Metadata { return { title: GAME_FILTERS_PAGE.legacyMetadataTitle, description: GAME_FILTERS_PAGE.legacyMetadataDescription, alternates: { canonical: siteUrl(GAME_FILTERS_PAGE.path) }, robots: { index: false, follow: true } }; }

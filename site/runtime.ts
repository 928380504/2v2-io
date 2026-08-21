import { SITE_CONFIG } from "@/site/site";

const namespace = SITE_CONFIG.id.replace(/[^a-z0-9]/gi, "").toLowerCase();

/**
 * Browser-facing identifiers that must be unique per deployed site.
 * Their generated 1v1 values intentionally match the historical keys so
 * existing visitors keep their local profile, ratings and game library.
 */
export const SITE_RUNTIME = {
  namespace,
  bridge: {
    gameSource: `${SITE_CONFIG.id}-game`,
    siteSource: `${SITE_CONFIG.id}-site`,
  },
  storage: {
    gameCardStats: `${namespace}.game-card-stats.v1`,
    visitor: `${namespace}.site.visitor.v1`,
    ratings: `${namespace}.game-ratings.v1`,
    remoteRatings: `${namespace}.remote-game-ratings.v1`,
    remoteRatingsFetchedAt: `${namespace}.remote-game-ratings-fetched-at.v1`,
    engagement: `${namespace}.game-engagement.v1`,
    favorites: `${namespace}:favorite-games:v1`,
    recents: `${namespace}:recent-games:v1`,
    profile: `${namespace}.site.profile.v1`,
    ticker: `${namespace}.site.ticker.v1`,
    tickerCollapsed: `${namespace}.site.ticker.collapsed.v1`,
    leaderboard: `${namespace}.site.leaderboard.v4`,
  },
  events: {
    ratingChanged: `${namespace}:game-rating-changed`,
    engagementChanged: `${namespace}:game-engagement-changed`,
    libraryChanged: `${namespace}:game-library-changed`,
    profileReady: `${namespace}:profile-ready`,
    matchesUploaded: `${namespace}:matches-uploaded`,
    commentNudge: `${namespace}:comment-nudge`,
  },
  moderation: {
    allowedLinkLikeTerms: ["1v1.lol"],
  },
} as const;


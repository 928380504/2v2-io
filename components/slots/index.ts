import DefaultNavbar from "@/components/All/Navbar";
import { Footer as DefaultFooter } from "@/components/All/Footer";
import { LeaderboardPanel as DefaultLeaderboard } from "@/components/All/LeaderboardPanel";
import { MakeThisBetterWidget as DefaultFeedbackWidget } from "@/components/All/MakeThisBetterWidget";
import { MarqueeBar as DefaultActivityFeed } from "@/components/All/MarqueeBar";
import { GamePlayer as DefaultGamePlayer } from "@/components/game/GamePlayer";
import { LinkFooter as DefaultFriendLinks } from "@/components/link-footer";
import { GameIntro2 as DefaultGameArticle } from "@/components/templates-3/GameIntro3";
import { RelatedGamesPanel as DefaultGameRankingPanel } from "@/components/templates-3/RelatedGamesPanel3";
import { RelatedGames as DefaultRelatedGames } from "@/components/YouXi/Games-Related";
import { SITE_COMPONENT_OVERRIDES } from "@/site/overrides/components";

export const SiteNavbar = SITE_COMPONENT_OVERRIDES.Navbar ?? DefaultNavbar;
export const SiteActivityFeed =
  SITE_COMPONENT_OVERRIDES.ActivityFeed ?? DefaultActivityFeed;
export const SiteFooter = SITE_COMPONENT_OVERRIDES.Footer ?? DefaultFooter;
export const SiteFeedbackWidget =
  SITE_COMPONENT_OVERRIDES.FeedbackWidget ?? DefaultFeedbackWidget;
export const SiteGamePlayer =
  SITE_COMPONENT_OVERRIDES.GamePlayer ?? DefaultGamePlayer;
export const SiteLeaderboard =
  SITE_COMPONENT_OVERRIDES.Leaderboard ?? DefaultLeaderboard;
export const SiteRelatedGames =
  SITE_COMPONENT_OVERRIDES.RelatedGames ?? DefaultRelatedGames;
export const SiteGameRankingPanel =
  SITE_COMPONENT_OVERRIDES.GameRankingPanel ?? DefaultGameRankingPanel;
export const SiteGameArticle =
  SITE_COMPONENT_OVERRIDES.GameArticle ?? DefaultGameArticle;
export const SiteFriendLinks =
  SITE_COMPONENT_OVERRIDES.FriendLinks ?? DefaultFriendLinks;


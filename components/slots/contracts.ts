import type Navbar from "@/components/All/Navbar";
import type { Footer } from "@/components/All/Footer";
import type { LeaderboardPanel } from "@/components/All/LeaderboardPanel";
import type { MakeThisBetterWidget } from "@/components/All/MakeThisBetterWidget";
import type { MarqueeBar } from "@/components/All/MarqueeBar";
import type { GamePlayer } from "@/components/game/GamePlayer";
import type { LinkFooter } from "@/components/link-footer";
import type { GameIntro2 } from "@/components/templates-3/GameIntro3";
import type { RelatedGamesPanel } from "@/components/templates-3/RelatedGamesPanel3";
import type { RelatedGames } from "@/components/YouXi/Games-Related";

/** Public component slots that an individual site may replace. */
export interface SiteComponentSlots {
  Navbar: typeof Navbar;
  ActivityFeed: typeof MarqueeBar;
  Footer: typeof Footer;
  FeedbackWidget: typeof MakeThisBetterWidget;
  GamePlayer: typeof GamePlayer;
  Leaderboard: typeof LeaderboardPanel;
  RelatedGames: typeof RelatedGames;
  GameRankingPanel: typeof RelatedGamesPanel;
  GameArticle: typeof GameIntro2;
  FriendLinks: typeof LinkFooter;
}

export type SiteComponentOverrides = Partial<SiteComponentSlots>;


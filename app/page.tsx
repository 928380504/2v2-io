import { DisplayAdSlot } from "@/components/All/DisplayAdSlot";
import { GameStructuredData } from "@/components/All/GameStructuredData";
import { ContentSection } from "@/components/ContentSection";
import { VideoPlayer } from "@/components/sj/VideoPlayer";
import { GameArticleNav } from "@/components/templates-3/GameArticleNav3";
import { GameSideListY } from "@/components/templates-3/GameSideList-y3";
import { SquareGameRecommendations } from "@/components/templates-3/SquareGameRecommendations";
import {
  SiteFriendLinks,
  SiteGameArticle,
  SiteGamePlayer,
  SiteGameRankingPanel,
  SiteLeaderboard,
  SiteRelatedGames,
} from "@/components/slots";
import { SITE_FEATURES } from "@/config/features";
import { getGame, getGamePageContext } from "@/config/game-catalog";
import { SITE_CONFIG, siteUrl } from "@/config/site";
import { getPrimaryGameAttributeValues } from "@/config/game-filters";
import { isGameRankingEligible } from "@/config/popular-games";
import { HOME_PAGE } from "@/site/content/home-page";
import { STYLES } from "@/styles/constants";

const homepageUrl = siteUrl();
const homepageGameEntityId = `${homepageUrl}#game`;
const homepageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_CONFIG.url}/#webpage`,
  url: homepageUrl,
  name: SITE_CONFIG.seo.title,
  mainEntity: {
    "@id": homepageGameEntityId,
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: siteUrl(SITE_CONFIG.assets.logo),
    contentUrl: siteUrl(SITE_CONFIG.assets.logo),
    width: 100,
    height: 100,
    caption: HOME_PAGE.structuredImageCaption,
  },
};

export default function Home() {
  const pageContext = getGamePageContext(SITE_CONFIG.primaryGameId);
  if (!pageContext) return null;

  const { game, category, detail, playableGame, relatedGames } = pageContext;
  const homeRelatedGames = HOME_PAGE.player.relatedGameIds.flatMap((gameId) => {
    const relatedGame = getGame(gameId);
    return relatedGame
      ? [{ ...relatedGame, image: relatedGame.detail.coverImage }]
      : [];
  });
  const homepageSidebarGames = category.games.filter(
    (sidebarGame) =>
      sidebarGame.id !== game.id && isGameRankingEligible(sidebarGame.id),
  );
  const rightSidebarGames = homepageSidebarGames.slice(0, 4);
  const rightSidebarGameIds = rightSidebarGames.map(
    (sidebarGame) => sidebarGame.id,
  );
  const leftSidebarGames = homepageSidebarGames
    .filter((sidebarGame) => !rightSidebarGameIds.includes(sidebarGame.id))
    .slice(0, 2);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageStructuredData).replace(/</g, "\\u003c"),
        }}
      />
      <GameStructuredData game={game} pageUrl={homepageUrl} />

      <ContentSection
        id="game"
        className="px-3 py-3"
        style={STYLES.container}
      >
        <div className="site-container-width mx-auto">
          <div className="grid grid-cols-1 gap-y-3 min-[1200px]:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] min-[1200px]:gap-x-0">
            <SiteGamePlayer
              game={playableGame}
              backgroundImage={HOME_PAGE.player.backgroundImage}
              coverTagline={HOME_PAGE.player.coverTagline}
              aspectRatio="16 / 9"
              className="w-full"
            />

            <div className="relative hidden min-h-0 min-[1200px]:block">
              {SITE_FEATURES.leaderboard ? (
                <SiteLeaderboard className="absolute inset-0 flex" />
              ) : (
                <SiteGameRankingPanel
                  games={category.games}
                  currentGameId={game.id}
                  className="absolute inset-0"
                />
              )}
            </div>

            {SITE_FEATURES.advertising && (
              <DisplayAdSlot
                placement="gameBelow"
                className="min-[1200px]:col-span-2"
              />
            )}

            <div className="min-[1200px]:col-span-2">
              <SiteRelatedGames games={homeRelatedGames} />
            </div>
          </div>
        </div>
      </ContentSection>

      <div className="h-17" />

      <ContentSection className="pb-8" style={STYLES.container}>
        <div className="site-container-width mx-auto mb-8">
          <div className="grid grid-cols-1 min-[1200px]:grid-cols-[20%_60%_20%]">
            <aside className="hidden min-[1200px]:block min-[1200px]:pr-2 min-[1536px]:pr-4">
              <div className="sticky top-4 space-y-3">
                {SITE_FEATURES.advertising ? (
                  <DisplayAdSlot
                    placement="homeSide"
                    variant="vertical"
                    fallback={<GameSideListY games={[]} />}
                  />
                ) : (
                  <GameSideListY games={[]} />
                )}
                <SquareGameRecommendations
                  games={leftSidebarGames}
                  currentGameId={game.id}
                  excludeGameIds={rightSidebarGameIds}
                  limit={2}
                  ariaLabel="More recommended games"
                  className="hidden min-[1440px]:block"
                />
              </div>
            </aside>

            <div>
              <SiteGameArticle
                gameId={game.id}
                title={game.title}
                description={HOME_PAGE.article.description}
                categories={[{ name: category.title, href: category.path }]}
                similarityAttributes={getPrimaryGameAttributeValues(game)}
                rating={{ score: game.rating || 4.5, votes: game.ratingCount ?? 0 }}
                logoImage={game.image}
                developer={game.developer}
                siteAddedAt={game.siteAddedAt}
                technology={game.technology}
                platforms={game.platforms}
                videoComponent={
                  <img
                    src={detail.coverImage}
                    alt={HOME_PAGE.article.heroAlt}
                  />
                }
                youtubeComponent={
                  <VideoPlayer
                    videoId={HOME_PAGE.article.youtube.videoId}
                    title={HOME_PAGE.article.youtube.title}
                    description={HOME_PAGE.article.youtube.description}
                  />
                }
                relatedGames={relatedGames}
                faqItems={HOME_PAGE.article.faqItems.map((item) => ({ ...item }))}
              />
            </div>

            <aside className="hidden min-[1200px]:block min-[1200px]:pl-2 min-[1536px]:pl-4">
              <div className="sticky top-4 space-y-3">
                <GameArticleNav
                  hasVideo
                  hasSimilarGames={category.games.length > 1}
                  hasComments={SITE_FEATURES.comments}
                />
                <SquareGameRecommendations
                  games={rightSidebarGames}
                  currentGameId={game.id}
                  limit={4}
                  ariaLabel="Recommended games below the article navigation"
                  className="hidden min-[1440px]:block"
                />
              </div>
            </aside>
          </div>
        </div>
      </ContentSection>

      {SITE_FEATURES.friendLinks && <SiteFriendLinks />}
    </>
  );
}

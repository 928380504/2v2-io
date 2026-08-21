"use client";

import { ContentSection } from '@/components/ContentSection';
import { STYLES } from '@/styles/constants';
import { Game } from '@/config/game-catalog';
import { HotYouxi } from '@/components/YouXi/Game-Fang';
import { DisplayAdSlot } from '@/components/All/DisplayAdSlot';
import { GameStructuredData } from '@/components/All/GameStructuredData';
import { GameArticleNav } from './GameArticleNav3';
import {
  SiteGameArticle,
  SiteGamePlayer,
  SiteGameRankingPanel,
  SiteRelatedGames,
} from '@/components/slots';
import type { ReactNode } from 'react';
import { getPrimaryGameAttributeValues } from '@/config/game-filters';
import { SITE_FEATURES } from '@/config/features';
import { SITE_ROUTES } from '@/config/routes';
import { isGameRankingEligible } from '@/config/popular-games';
import { SquareGameRecommendations } from './SquareGameRecommendations';

interface ExtendedGame extends Game {
  playUrl: string;
  category?: string;
  categoryUrl?: string;
}

interface GameDetailTemplate3Props {
  game: ExtendedGame;
  relatedGames: Game[];
  sideGamesY: Game[];
  videoComponent?: ReactNode;
  youtubeComponent?: ReactNode;
  description?: string;
}

export function GameDetailTemplate3({
  game,
  relatedGames,
  sideGamesY,
  videoComponent,
  youtubeComponent,
  description
}: GameDetailTemplate3Props) {
  const rightSidebarGames = relatedGames
    .filter((relatedGame) =>
      relatedGame.id !== game.id && isGameRankingEligible(relatedGame.id)
    )
    .slice(0, 4);
  const rightSidebarGameIds = rightSidebarGames.map((relatedGame) => relatedGame.id);
  const leftSidebarGames = sideGamesY
    .filter((sideGame) =>
      sideGame.id !== game.id &&
      !rightSidebarGameIds.includes(sideGame.id) &&
      isGameRankingEligible(sideGame.id)
    )
    .slice(0, 2);

  return (
    <main>
      <GameStructuredData game={game} />
      {/* 游戏区域 */}
      <ContentSection 
        id="game" 
        className="px-3 py-3"
        style={STYLES.container}
      >
        <div className="site-container-width mx-auto">
          <div className="grid grid-cols-1 gap-y-3 min-[1200px]:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] min-[1200px]:gap-x-0">
            <SiteGamePlayer
              game={game}
              aspectRatio="16 / 9"
              className="w-full"
            />

            <div className="relative hidden min-h-0 min-[1200px]:block">
              <SiteGameRankingPanel
                games={[game, ...relatedGames]}
                currentGameId={game.id}
                className="absolute inset-0"
              />
            </div>

            {SITE_FEATURES.advertising && (
              <DisplayAdSlot
                placement="gameBelow"
                className="min-[1200px]:col-span-2"
              />
            )}

            <div className="min-[1200px]:col-span-2">
              <SiteRelatedGames
                games={relatedGames.map((relatedGame) => ({
                  ...relatedGame,
                  image: relatedGame.image.replace('-logo.webp', '-bj.webp'),
                }))}
              />
            </div>
          </div>
        </div>
      </ContentSection>
        {/* 热门游戏区域 */}
        <div className="site-container-width mx-auto mb-4 min-[1200px]:hidden">
          <HotYouxi />
        </div>
      {/* 内容区域 */}
      <ContentSection className="pb-8" style={STYLES.container}>
        <div className="site-container-width mx-auto mb-8">
          <div className="grid grid-cols-1 min-[1200px]:grid-cols-[20%_60%_20%]">
            {/* 左侧游戏列表 */}
            <aside className="hidden min-[1200px]:block min-[1200px]:pr-2 min-[1536px]:pr-4">
              <div className="sticky top-4 space-y-3">
                {SITE_FEATURES.advertising ? (
                  <DisplayAdSlot
                    placement="detailSide"
                    variant="vertical"
                  />
                ) : null}
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

            {/* 中间内容 */}
            <div>
              <SiteGameArticle 
                gameId={game.id}
                title={game.title}
                description={description || game.description || ""}
                categories={[
                  { name: game.category || "Games", href: game.categoryUrl || SITE_ROUTES.gameCategory }
                ]}
                similarityAttributes={getPrimaryGameAttributeValues(game)}
                rating={{ score: game.rating || 4.5, votes: game.ratingCount ?? 0 }}
                logoImage={game.image}
                developer={game.developer}
                siteAddedAt={game.siteAddedAt}
                technology={game.technology}
                platforms={game.platforms}
                videoComponent={videoComponent}
                youtubeComponent={youtubeComponent}
                relatedGames={relatedGames}
              />
            </div>

            {/* 右侧游戏列表 */}
            <aside className="hidden min-[1200px]:block min-[1200px]:pl-2 min-[1536px]:pl-4">
              <div className="sticky top-4 space-y-3">
                <GameArticleNav
                  hasVideo={Boolean(youtubeComponent)}
                  hasSimilarGames={relatedGames.length > 0}
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
    </main>
  );
}

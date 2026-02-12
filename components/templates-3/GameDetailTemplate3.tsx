"use client";

import { useMemo } from 'react';
import { GameSection } from './GameSection3';
import { RelatedGames } from './RelatedGames3';
// 移除 GameCategories3 导入
import { GameSideListZ } from './GameSideList-z3';
import { GameSideListY } from './GameSideList-y3';
import { GameIntro2 } from './GameIntro3';
import { ContentSection } from '@/components/ContentSection';
import { STYLES } from '@/styles/constants';
import { Game, gameCategories } from '@/config/games';
import { HotYouxi } from '@/components/YouXi/Game-Fang';
import { RelatedGames as RelatedGamesMain } from '@/components/YouXi/Games-Related';
import type { ReactNode } from 'react';

interface ExtendedGame extends Game {
  playUrl: string;
  category?: string;
  categoryUrl?: string;
}

interface GameDetailTemplate3Props {
  game: ExtendedGame;
  relatedGames: Game[];
  sideGamesZ: Game[];
  sideGamesY: Game[];
  videoComponent?: ReactNode;
  description?: string;
}

export function GameDetailTemplate3({
  game,
  relatedGames: initialRelatedGames,
  sideGamesZ,
  sideGamesY,
  videoComponent,
  description
}: GameDetailTemplate3Props) {

  // 获取同类游戏作为相关游戏
  const relatedGames = useMemo(() => {
    // 找到当前游戏所属的分类
    const currentCategory = gameCategories.find(category => 
      category.games.some(g => g.id === game.id)
    );

    if (currentCategory) {
      // 从同一分类中获取其他游戏
      return currentCategory.games
        .filter(g => g.id !== game.id) // 排除当前游戏
        .map(g => ({
          ...g,
          category: currentCategory.title,
          categoryUrl: currentCategory.path,
          // 添加默认的预览图，如果没有视频则使用游戏的背景图
          previewUrl: g.videoUrl || g.image
        }));
    }

    // 如果找不到分类，则使用传入的相关游戏，同样添加预览图
    return initialRelatedGames.map(g => ({
      ...g,
      previewUrl: g.videoUrl || g.image
    }));
  }, [game.id, initialRelatedGames]);

  return (
    <main>
      {/* 游戏区域 */}
      <ContentSection 
        id="game" 
        className="py-4" 
        style={STYLES.container}
      >
        <div className="max-w-[980px] mx-auto">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="w-full xl:flex-1">
              <GameSection 
                game={game}
                height="500px"
                className="w-full"
              />
            </div>
           
          </div>
        </div>
      </ContentSection>
      
      {/* 内容区域 */}
      <ContentSection className="pb-8" style={STYLES.container}>
        <div className="max-w-[980px] mx-auto mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-[195px_1fr_195px] gap-4">
            {/* 左侧游戏列表 */}
            <aside className="hidden lg:block">
              <div className="sticky top-4">
                <GameSideListZ games={sideGamesZ} />
              </div>
            </aside>

            {/* 中间内容 */}
            <div>
              <GameIntro2 
                title={game.title}
                description={description || game.description || ""}
                categories={[
                  { name: "Clicker Games", href: "/clicker-games" },
                  { name: game.category || "Incremental Games", href: game.categoryUrl || "/clicker-games/incremental-clicker-games" }
                ]}
                rating={{ score: game.rating || 4.5, votes: 1234 }}
                views={50000}
                createdAt={game.createdAt}
                videoComponent={videoComponent}
              />
            </div>

            {/* 右侧游戏列表 */}
            <aside className="hidden lg:block">
              <div className="sticky top-4">
                <GameSideListY games={sideGamesY} />
              </div>
            </aside>
          </div>
        </div>


      </ContentSection>
    </main>
  );
}
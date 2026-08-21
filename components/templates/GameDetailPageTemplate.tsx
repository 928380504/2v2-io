import { VideoPlayer } from "@/components/sj/VideoPlayer";
import { GameDetailTemplate3 } from "@/components/templates-3/GameDetailTemplate3";
import {
  getGamePageContext,
  type GameDetailPageId,
} from "@/config/game-catalog";

export function GameDetailPageTemplate({
  gameId,
}: {
  gameId: GameDetailPageId;
}) {
  const pageContext = getGamePageContext(gameId);
  if (!pageContext) return null;

  const { detail, playableGame, relatedGames } = pageContext;

  return (
    <main className="flex-1">
      <div className="w-full">
        <GameDetailTemplate3
          game={playableGame}
          relatedGames={relatedGames}
          sideGamesY={relatedGames.slice(5, 10)}
          videoComponent={
            <img
              src={detail.coverImage}
              alt={detail.coverAlt}
              className="mb-6 w-[35%] rounded-lg"
            />
          }
          youtubeComponent={
            detail.youtube ? (
              <VideoPlayer
                videoId={detail.youtube.videoId}
                title={detail.youtube.title}
                description={detail.youtube.description}
              />
            ) : undefined
          }
          description={detail.description}
        />
      </div>
    </main>
  );
}

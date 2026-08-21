"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCover } from "@/components/game/GameCover";
import { GameControls } from "@/components/YouXi/IF-Controls";
import type { GameLoadStatus } from "@/components/YouXi/GamePlayButton";
import type { Game } from "@/config/game-catalog";
import { SITE_FEATURES } from "@/config/features";
import { useGameEngagement } from "@/hooks/use-game-engagement";
import {
  createBridgeRequestMessage,
  createMatchAcknowledgementMessage,
  type GameProfileSummary,
  MATCHES_UPLOADED_EVENT,
  parseGameBridgeMessage,
  PROFILE_READY_EVENT,
  SITE_PROFILE_CACHE_KEY,
} from "@/lib/game-bridge";
import { cn } from "@/lib/utils";
import { uploadMatchBatch } from "@/lib/data/game-data-client";

export interface PlayableGame extends Game {
  playUrl: string;
}

interface GamePlayerProps {
  game: PlayableGame;
  backgroundImage?: string;
  coverTagline?: string;
  height?: string;
  aspectRatio?: string;
  className?: string;
}

function defaultBackgroundImage(game: PlayableGame) {
  return game.image.includes("-logo.webp")
    ? game.image.replace("-logo.webp", "-bj.webp")
    : game.image;
}

export function GamePlayer({
  game,
  backgroundImage = defaultBackgroundImage(game),
  coverTagline,
  height = "675px",
  aspectRatio,
  className,
}: GamePlayerProps) {
  const matchBridgeEnabled = SITE_FEATURES.matchEvents && Boolean(game.matchBridge);
  const [loadStatus, setLoadStatus] = useState<GameLoadStatus>("idle");
  const [playNudgeToken, setPlayNudgeToken] = useState(0);
  const engagement = useGameEngagement(game.id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inFlightEventIds = useRef(new Set<string>());
  const iframeId = `game-frame-${game.id}`;
  const gameOrigin = useMemo(() => {
    if (!matchBridgeEnabled) return null;
    try {
      return new URL(game.playUrl).origin;
    } catch {
      return null;
    }
  }, [game.playUrl, matchBridgeEnabled]);

  const postToGame = useCallback(
    (message: unknown) => {
      if (!gameOrigin || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(message, gameOrigin);
    },
    [gameOrigin],
  );

  const publishProfile = useCallback((profile: GameProfileSummary) => {
    const detail = { ...profile, receivedAt: Date.now() };
    try {
      window.localStorage.setItem(SITE_PROFILE_CACHE_KEY, JSON.stringify(detail));
    } catch {
      // The live message remains usable when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent(PROFILE_READY_EVENT, { detail }));
  }, []);

  useEffect(() => {
    if (!matchBridgeEnabled) return;

    const handleMessage = async (event: MessageEvent<unknown>) => {
      if (
        !gameOrigin
        || event.origin !== gameOrigin
        || event.source !== iframeRef.current?.contentWindow
      ) {
        return;
      }

      const message = parseGameBridgeMessage(event.data);
      if (!message) return;

      if (message.type === "profile.ready") {
        publishProfile(message.profile);
        return;
      }

      const events = message.events.filter((matchEvent) => {
        const eventId = String(matchEvent.eventId);
        if (inFlightEventIds.current.has(eventId)) return false;
        inFlightEventIds.current.add(eventId);
        return true;
      });
      if (!events.length) return;

      try {
        const result = await uploadMatchBatch<{
          acknowledgedEventIds?: unknown;
        }>(events);
        const submittedIds = new Set(
          events.map((matchEvent) => String(matchEvent.eventId)),
        );
        const acknowledgedEventIds = Array.isArray(result.acknowledgedEventIds)
          ? result.acknowledgedEventIds.filter(
              (eventId): eventId is string =>
                typeof eventId === "string" && submittedIds.has(eventId),
            )
          : [];

        if (acknowledgedEventIds.length) {
          postToGame(
            createMatchAcknowledgementMessage(
              message.profileId,
              acknowledgedEventIds,
            ),
          );
          window.dispatchEvent(
            new CustomEvent(MATCHES_UPLOADED_EVENT, {
              detail: { acknowledgedEventIds },
            }),
          );
        }
      } catch {
        // Leave events in the game's IndexedDB outbox for a later retry.
      } finally {
        events.forEach((matchEvent) => {
          inFlightEventIds.current.delete(String(matchEvent.eventId));
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [gameOrigin, matchBridgeEnabled, postToGame, publishProfile]);

  useEffect(() => {
    if (!matchBridgeEnabled || loadStatus === "idle") return;

    const requestPendingState = () => postToGame(createBridgeRequestMessage());
    const requestWhenVisible = () => {
      if (document.visibilityState === "visible") requestPendingState();
    };
    const retryId = window.setInterval(requestPendingState, 60_000);

    window.addEventListener("online", requestPendingState);
    document.addEventListener("visibilitychange", requestWhenVisible);
    return () => {
      window.clearInterval(retryId);
      window.removeEventListener("online", requestPendingState);
      document.removeEventListener("visibilitychange", requestWhenVisible);
    };
  }, [loadStatus, matchBridgeEnabled, postToGame]);

  const handleStartGame = () => {
    if (loadStatus === "loading") return;
    void engagement.recordPlay();
    setLoadStatus("loading");
  };

  const handlePlayTransitionComplete = () => {
    setLoadStatus((currentStatus) =>
      currentStatus === "loading" ? "playing" : currentStatus,
    );
  };

  const shouldLoad = loadStatus !== "idle";
  const showCover = loadStatus !== "playing";

  return (
    <section className={cn("relative", className)}>
      <div className="overflow-hidden rounded-t-3xl bg-white dark:bg-[#0d4021] min-[1200px]:rounded-tr-none">
        <div
          className="relative overflow-hidden bg-white dark:bg-[#0d4021]"
          style={aspectRatio ? { aspectRatio } : { height }}
        >
          {shouldLoad && (
            <iframe
              ref={iframeRef}
              id={iframeId}
              src={game.playUrl}
              onLoad={matchBridgeEnabled
                ? () => postToGame(createBridgeRequestMessage())
                : undefined}
              className="h-full w-full"
              style={{
                visibility: showCover ? "hidden" : "visible",
                border: "none",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="eager"
            />
          )}

          {showCover && (
            <GameCover
              title={game.title}
              description={game.description}
              tagline={coverTagline}
              logoImage={game.image}
              backgroundImage={backgroundImage}
              status={loadStatus}
              playNudgeToken={playNudgeToken}
              onStart={handleStartGame}
              onTransitionComplete={handlePlayTransitionComplete}
            />
          )}
        </div>
      </div>

      <GameControls
        title={game.title}
        logoSrc={game.image}
        iframeId={iframeId}
        embedUrl={game.playUrl}
        gameId={game.id}
        gamePageUrl={game.url}
        commentsTargetId={SITE_FEATURES.comments ? "game-comments" : undefined}
        canFullscreen={loadStatus !== "idle"}
        onFullscreenBlocked={() =>
          setPlayNudgeToken((currentToken) => currentToken + 1)
        }
      />
    </section>
  );
}

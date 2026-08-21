"use client";

import Image from "next/image";
import {
  Check,
  Code2,
  Heart,
  Maximize2,
  MessageCircle,
  RotateCcw,
  Share2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaFacebookF,
  FaPinterestP,
  FaRedditAlien,
  FaTelegramPlane,
  FaWhatsapp,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import {
  FAVORITE_GAMES_STORAGE_KEY,
  GAME_LIBRARY_CHANGED_EVENT,
  isFavoriteGame,
  toggleFavoriteGame,
} from "@/lib/game-library";
import { useGameEngagement } from "@/hooks/use-game-engagement";
import { SITE_CONFIG } from "@/site/site";
import { SITE_RUNTIME } from "@/site/runtime";

interface GameControlsProps {
  title: string;
  logoSrc?: string;
  displayTitle?: string;
  iframeId?: string;
  embedUrl?: string;
  gameId?: string;
  gamePageUrl?: string;
  commentsTargetId?: string;
  canFullscreen?: boolean;
  onFullscreenBlocked?: () => void;
}

type ActiveDialog = "share" | "embed" | null;
type CopyTarget = "share-url" | "embed-url" | "embed-code" | null;
type ReactionNudge = "like" | "dislike";
type VoteBurst = {
  id: number;
  reaction: ReactionNudge;
  offset: number;
};

const COMMENT_NUDGE_EVENT = SITE_RUNTIME.events.commentNudge;
const REACTION_NUDGE_THRESHOLD = 5;
const REACTION_NUDGE_WINDOW_MS = 5000;
const REACTION_NUDGE_DURATION_MS = 2600;
const REACTION_NUDGE_COOLDOWN_MS = 3000;
const MAX_VISIBLE_VOTE_BURSTS = 8;

type FullscreenIframe = HTMLIFrameElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

const getFullscreenElement = (documentElement: FullscreenDocument) =>
  documentElement.fullscreenElement ??
  documentElement.webkitFullscreenElement ??
  documentElement.mozFullScreenElement ??
  documentElement.msFullscreenElement ??
  null;

const escapeHtmlAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export const GameControls = ({
  title,
  logoSrc = SITE_CONFIG.assets.logo,
  displayTitle,
  iframeId = "gameFrame",
  embedUrl = "",
  gameId,
  gamePageUrl,
  commentsTargetId,
  canFullscreen = true,
  onFullscreenBlocked,
}: GameControlsProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [resolvedEmbedUrl, setResolvedEmbedUrl] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget>(null);
  const [commentNudgeReaction, setCommentNudgeReaction] =
    useState<ReactionNudge | null>(null);
  const [commentNudgeToken, setCommentNudgeToken] = useState(0);
  const [voteBursts, setVoteBursts] = useState<VoteBurst[]>([]);
  const [votePulseTokens, setVotePulseTokens] = useState({
    like: 0,
    dislike: 0,
  });
  const [fullscreenHintToken, setFullscreenHintToken] = useState(0);
  const voteBurstIdRef = useRef(0);
  const reactionTapTimestampsRef = useRef<number[]>([]);
  const lastCommentNudgeAtRef = useRef(0);
  const commentNudgeTimeoutRef = useRef<number | null>(null);
  const fullscreenHintTimeoutRef = useRef<number | null>(null);

  const gameTitle = displayTitle ?? title;
  const favoriteId = gameId ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const engagement = useGameEngagement(favoriteId);
  const formatCount = (value: number) => new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

  const embedCode = useMemo(() => {
    if (!resolvedEmbedUrl) return "";
    const safeUrl = escapeHtmlAttribute(resolvedEmbedUrl);
    return `<iframe src="${safeUrl}" width="1280" height="720" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`;
  }, [resolvedEmbedUrl]);

  const socialLinks = useMemo(() => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(gameTitle);
    const encodedMessage = encodeURIComponent(`${gameTitle} ${shareUrl}`);

    return [
      {
        name: "Facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        color: "bg-[#4676ed]",
        icon: <FaFacebookF />,
      },
      {
        name: "X",
        href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
        color: "bg-[#171717]",
        icon: <FaXTwitter />,
      },
      {
        name: "Reddit",
        href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
        color: "bg-[#f16d4d]",
        icon: <FaRedditAlien />,
      },
      {
        name: "Pinterest",
        href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
        color: "bg-[#d52d3a]",
        icon: <FaPinterestP />,
      },
      {
        name: "WhatsApp",
        href: `https://wa.me/?text=${encodedMessage}`,
        color: "bg-[#5cc66a]",
        icon: <FaWhatsapp />,
      },
      {
        name: "Telegram",
        href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
        color: "bg-[#229bd3]",
        icon: <FaTelegramPlane />,
      },
    ];
  }, [gameTitle, shareUrl]);

  const openSharePopup = (href: string, platformName: string) => {
    const popupWidth = 640;
    const popupHeight = 560;
    const popupLeft = Math.max(
      0,
      window.screenX + (window.outerWidth - popupWidth) / 2,
    );
    const popupTop = Math.max(
      0,
      window.screenY + (window.outerHeight - popupHeight) / 2,
    );
    const popupName = `share-${platformName.toLowerCase()}`;
    const popupFeatures = [
      "popup=yes",
      `width=${popupWidth}`,
      `height=${popupHeight}`,
      `left=${Math.round(popupLeft)}`,
      `top=${Math.round(popupTop)}`,
      "resizable=yes",
      "scrollbars=yes",
    ].join(",");

    window.open(href, popupName, popupFeatures)?.focus();
  };

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
    setCopiedTarget(null);
  }, []);

  useEffect(() => {
    if (!activeDialog) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };

    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDialog, closeDialog]);

  const syncFavoriteState = useCallback(() => {
    setIsFavorite(isFavoriteGame(favoriteId));
  }, [favoriteId]);

  useEffect(() => {
    syncFavoriteState();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAVORITE_GAMES_STORAGE_KEY) syncFavoriteState();
    };

    window.addEventListener(GAME_LIBRARY_CHANGED_EVENT, syncFavoriteState);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GAME_LIBRARY_CHANGED_EVENT, syncFavoriteState);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncFavoriteState]);

  useEffect(() => {
    return () => {
      if (commentNudgeTimeoutRef.current) {
        window.clearTimeout(commentNudgeTimeoutRef.current);
      }
      if (fullscreenHintTimeoutRef.current) {
        window.clearTimeout(fullscreenHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fullscreenDocument = document as FullscreenDocument;
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(getFullscreenElement(fullscreenDocument)));
    };
    const eventNames = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ];

    eventNames.forEach((eventName) =>
      document.addEventListener(eventName, syncFullscreenState),
    );
    return () => {
      eventNames.forEach((eventName) =>
        document.removeEventListener(eventName, syncFullscreenState),
      );
    };
  }, []);

  const copyText = async (value: string, target: Exclude<CopyTarget, null>) => {
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    setCopiedTarget(target);
    window.setTimeout(() => {
      setCopiedTarget((current) => (current === target ? null : current));
    }, 2000);
  };

  const openShareDialog = () => {
    if (typeof window === "undefined") return;
    setShareUrl(`${window.location.origin}${window.location.pathname}`);
    setCopiedTarget(null);
    setActiveDialog("share");
  };

  const scrollToComments = () => {
    if (!commentsTargetId) return;
    document.getElementById(commentsTargetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const openEmbedDialog = () => {
    if (typeof window === "undefined") return;
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    setResolvedEmbedUrl(embedUrl || iframe?.src || window.location.href);
    setCopiedTarget(null);
    setActiveDialog("embed");
  };

  const handleFavorite = () => {
    if (typeof window === "undefined") return;
    const nextState = toggleFavoriteGame({
      id: favoriteId,
      title: gameTitle,
      image: logoSrc,
      url: gamePageUrl || window.location.pathname,
    });
    setIsFavorite(nextState);
    void engagement.recordFavorite();
  };

  const triggerCommentNudge = useCallback(
    (reaction: ReactionNudge) => {
      if (!commentsTargetId) return;

      setCommentNudgeReaction(reaction);
      setCommentNudgeToken((current) => current + 1);

      window.dispatchEvent(
        new CustomEvent(COMMENT_NUDGE_EVENT, {
          detail: {
            reaction,
            firedAt: Date.now(),
            source: "game-controls",
          },
        }),
      );

      if (navigator.vibrate) {
        navigator.vibrate(reaction === "dislike" ? [12, 30, 12] : 16);
      }

      if (commentNudgeTimeoutRef.current) {
        window.clearTimeout(commentNudgeTimeoutRef.current);
      }
      commentNudgeTimeoutRef.current = window.setTimeout(() => {
        setCommentNudgeReaction(null);
      }, REACTION_NUDGE_DURATION_MS);
    },
    [commentsTargetId],
  );

  const registerReactionTap = useCallback(
    (reaction: ReactionNudge) => {
      if (!commentsTargetId) return;

      const now = Date.now();
      const recentTaps = reactionTapTimestampsRef.current
        .filter((timestamp) => now - timestamp <= REACTION_NUDGE_WINDOW_MS)
        .concat(now);

      reactionTapTimestampsRef.current = recentTaps;

      if (
        recentTaps.length < REACTION_NUDGE_THRESHOLD ||
        now - lastCommentNudgeAtRef.current < REACTION_NUDGE_COOLDOWN_MS
      ) {
        return;
      }

      lastCommentNudgeAtRef.current = now;
      reactionTapTimestampsRef.current = [];
      triggerCommentNudge(reaction);
    },
    [commentsTargetId, triggerCommentNudge],
  );

  const showVoteFeedback = useCallback((reaction: ReactionNudge) => {
    const id = ++voteBurstIdRef.current;
    const offset = ((id % 3) - 1) * 8;
    setVoteBursts((current) => [
      ...current.slice(-(MAX_VISIBLE_VOTE_BURSTS - 1)),
      { id, reaction, offset },
    ]);
    setVotePulseTokens((current) => ({
      ...current,
      [reaction]: current[reaction] + 1,
    }));
  }, []);

  const removeVoteBurst = useCallback((id: number) => {
    setVoteBursts((current) => current.filter((burst) => burst.id !== id));
  }, []);

  const handleLike = () => {
    showVoteFeedback("like");
    registerReactionTap("like");
    void engagement.recordLike();
  };

  const handleDislike = () => {
    showVoteFeedback("dislike");
    registerReactionTap("dislike");
    void engagement.recordDislike();
  };

  const toggleFullscreen = useCallback(async () => {
    if (!canFullscreen) {
      setFullscreenHintToken((currentToken) => currentToken + 1);
      onFullscreenBlocked?.();

      if (fullscreenHintTimeoutRef.current) {
        window.clearTimeout(fullscreenHintTimeoutRef.current);
      }
      fullscreenHintTimeoutRef.current = window.setTimeout(() => {
        setFullscreenHintToken(0);
      }, 2000);
      return;
    }

    const iframe = document.getElementById(iframeId) as FullscreenIframe | null;
    if (!iframe) return;

    const fullscreenDocument = document as FullscreenDocument;

    try {
      if (!getFullscreenElement(fullscreenDocument)) {
        const requestFullscreen =
          (typeof iframe.requestFullscreen === "function" &&
            iframe.requestFullscreen.bind(iframe)) ||
          (typeof iframe.webkitRequestFullscreen === "function" &&
            iframe.webkitRequestFullscreen.bind(iframe)) ||
          (typeof iframe.webkitRequestFullScreen === "function" &&
            iframe.webkitRequestFullScreen.bind(iframe)) ||
          (typeof iframe.mozRequestFullScreen === "function" &&
            iframe.mozRequestFullScreen.bind(iframe)) ||
          (typeof iframe.msRequestFullscreen === "function" &&
            iframe.msRequestFullscreen.bind(iframe));

        if (!requestFullscreen) {
          console.warn("Fullscreen is not supported by this mobile browser.");
          return;
        }

        await Promise.resolve(requestFullscreen());
        setIsFullscreen(true);
        return;
      }

      const exitFullscreen =
        (typeof fullscreenDocument.exitFullscreen === "function" &&
          fullscreenDocument.exitFullscreen.bind(fullscreenDocument)) ||
        (typeof fullscreenDocument.webkitExitFullscreen === "function" &&
          fullscreenDocument.webkitExitFullscreen.bind(fullscreenDocument)) ||
        (typeof fullscreenDocument.webkitCancelFullScreen === "function" &&
          fullscreenDocument.webkitCancelFullScreen.bind(fullscreenDocument)) ||
        (typeof fullscreenDocument.mozCancelFullScreen === "function" &&
          fullscreenDocument.mozCancelFullScreen.bind(fullscreenDocument)) ||
        (typeof fullscreenDocument.msExitFullscreen === "function" &&
          fullscreenDocument.msExitFullscreen.bind(fullscreenDocument));

      if (!exitFullscreen) return;
      await Promise.resolve(exitFullscreen());
      setIsFullscreen(false);
    } catch (error) {
      console.error("Unable to change fullscreen mode:", error);
    }
  }, [canFullscreen, iframeId, onFullscreenBlocked]);

  const resetGame = useCallback(() => {
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (!iframe) return;
    iframe.src = iframe.src;
  }, [iframeId]);

  return (
    <>
      <div className="bg-white/95 px-2 py-1 shadow-[0_8px_30px_rgb(0,0,0,0.2)] backdrop-blur-sm dark:bg-[#0d4021] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] sm:px-3 sm:py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src={logoSrc}
              alt={gameTitle}
              width={30}
              height={30}
              className="rounded-md object-cover"
            />
            <div className="whitespace-nowrap text-base font-semibold tracking-[0.08em] text-gray-700 dark:text-gray-200 sm:text-lg">
              {gameTitle}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                className="relative hidden items-center gap-1 overflow-visible rounded-lg p-1 text-gray-600 transition hover:bg-gray-100 active:scale-90 dark:text-gray-300 dark:hover:bg-gray-800 sm:p-1.5 md:flex"
                onClick={handleLike}
                aria-label="Like"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-full h-0 overflow-visible"
                >
                  {voteBursts
                    .filter((burst) => burst.reaction === "like")
                    .map((burst) => (
                      <span
                        key={burst.id}
                        className="vote-feedback vote-feedback-like"
                        style={{ left: `calc(50% + ${burst.offset}px)` }}
                        onAnimationEnd={() => removeVoteBurst(burst.id)}
                      >
                        +1
                      </span>
                    ))}
                </span>
                <ThumbsUp
                  key={`like-${votePulseTokens.like}`}
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${
                    votePulseTokens.like > 0 ? "vote-icon-like-pulse" : ""
                  }`}
                />
                <span className="text-xs">{formatCount(engagement.counts.likes)}</span>
              </button>

              <button
                className="relative hidden items-center gap-1 overflow-visible rounded-lg p-1 text-gray-600 transition hover:bg-gray-100 active:scale-90 dark:text-gray-300 dark:hover:bg-gray-800 sm:p-1.5 md:flex"
                onClick={handleDislike}
                aria-label="Dislike"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-full h-0 overflow-visible"
                >
                  {voteBursts
                    .filter((burst) => burst.reaction === "dislike")
                    .map((burst) => (
                      <span
                        key={burst.id}
                        className="vote-feedback vote-feedback-dislike"
                        style={{ left: `calc(50% + ${burst.offset}px)` }}
                        onAnimationEnd={() => removeVoteBurst(burst.id)}
                      >
                        -1
                      </span>
                    ))}
                </span>
                <ThumbsDown
                  key={`dislike-${votePulseTokens.dislike}`}
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${
                    votePulseTokens.dislike > 0
                      ? "vote-icon-dislike-pulse"
                      : ""
                  }`}
                />
                <span className="text-xs">{formatCount(engagement.counts.dislikes)}</span>
              </button>

              <button
                className={`flex items-center rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 sm:p-1.5 ${
                  isFavorite
                    ? "text-red-500 dark:text-red-400"
                    : "text-gray-600 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400"
                }`}
                onClick={handleFavorite}
                aria-label={
                  isFavorite ? "Remove from favorites" : "Add to favorites"
                }
                aria-pressed={isFavorite}
                title={
                  isFavorite ? "Remove from favorites" : "Add to favorites"
                }
              >
                <Heart
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${
                    isFavorite ? "fill-current" : ""
                  }`}
                />
              </button>

              <button
                className="flex items-center rounded-lg p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-green-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-green-400 sm:p-1.5"
                onClick={openShareDialog}
                aria-label="Share"
                title="Share"
              >
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {commentsTargetId && (
                <button
                  className={`flex items-center rounded-lg p-1 transition-all duration-200 sm:p-1.5 ${
                    commentNudgeReaction
                      ? "comment-nudge-link bg-gradient-to-r from-fuchsia-500 via-amber-400 to-emerald-400 text-white shadow-[0_10px_24px_rgba(16,185,129,0.35)] hover:text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-green-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-green-400"
                  }`}
                  onClick={scrollToComments}
                  aria-label="Go to comments"
                  title={
                    commentNudgeReaction === "dislike"
                      ? "Tell us what went wrong"
                      : commentNudgeReaction === "like"
                        ? "Share what felt great"
                        : "Comments"
                  }
                >
                  <MessageCircle
                    key={commentNudgeToken}
                    className={`h-4 w-4 sm:h-5 sm:w-5 ${
                      commentNudgeReaction ? "comment-nudge-icon" : ""
                    }`}
                  />
                </button>
              )}

              <button
                className="hidden items-center rounded-lg p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-green-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-green-400 sm:p-1.5"
                onClick={openEmbedDialog}
                aria-label="Embed game"
                title="Embed"
              >
                <Code2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-300/25" />

            <button
              className="hidden h-[32px] w-[48px] items-center justify-center gap-1 rounded-lg p-1 text-gray-600 transition-colors hover:bg-blue-600 hover:text-white dark:text-gray-300 dark:hover:bg-blue-600 dark:hover:text-white md:flex sm:p-1.5"
              onClick={resetGame}
              aria-label="Reset Game"
            >
              <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <div className="relative flex">
              {fullscreenHintToken > 0 && (
                <div
                  key={`fullscreen-hint-${fullscreenHintToken}`}
                  role="status"
                  className="fullscreen-play-hint pointer-events-none absolute bottom-[calc(100%+8px)] right-0 z-30 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg dark:bg-white dark:text-gray-900 sm:text-xs"
                >
                  Start the game to enable fullscreen.
                  <span className="absolute right-4 top-full h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-gray-900 dark:border-t-white" />
                </div>
              )}
              <button
                className="group flex h-[32px] w-[48px] items-center justify-center rounded-lg bg-gray-200 p-1.5 transition-all duration-200 hover:scale-105 hover:bg-green-600 active:scale-95 dark:bg-gray-700 dark:hover:bg-green-600 sm:p-2"
                onClick={toggleFullscreen}
                aria-label={
                  canFullscreen
                    ? "Fullscreen"
                    : "Start the game to enable fullscreen"
                }
                aria-pressed={isFullscreen}
              >
                <Maximize2 className="h-5 w-5 text-gray-700 group-hover:text-white dark:text-gray-100 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeDialog === "share" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
            className="relative w-full max-w-[600px] rounded-[20px] bg-white px-5 pb-6 pt-6 shadow-2xl dark:bg-[#123e25] sm:px-6"
          >
            <button
              type="button"
              onClick={closeDialog}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close share dialog"
            >
              <X className="h-6 w-6" />
            </button>

            <h2
              id="share-dialog-title"
              className="px-9 text-center text-xl font-bold text-gray-950 dark:text-white sm:text-2xl"
            >
              Share {gameTitle}
            </h2>

            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-4">
              {socialLinks.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => openSharePopup(item.href, item.name)}
                  aria-label={`Share on ${item.name}`}
                  title={item.name}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-xl text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 sm:h-14 sm:w-14 sm:text-2xl ${item.color}`}
                >
                  {item.icon}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border-2 border-gray-200 bg-white p-1.5 dark:border-white/15 dark:bg-[#0d321d]">
              <input
                type="text"
                value={shareUrl}
                readOnly
                aria-label="Share URL"
                className="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-gray-500 outline-none dark:text-gray-200 sm:text-base"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => copyText(shareUrl, "share-url")}
                className="flex min-w-[74px] items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#477be9] to-[#3158bb] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                {copiedTarget === "share-url" && <Check className="h-4 w-4" />}
                {copiedTarget === "share-url" ? "Copied" : "Copy"}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeDialog === "embed" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="embed-dialog-title"
            className="relative w-full max-w-[900px] rounded-[20px] bg-white px-5 pb-6 pt-6 shadow-2xl dark:bg-[#123e25] sm:px-7 sm:pb-8"
          >
            <button
              type="button"
              onClick={closeDialog}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close embed dialog"
            >
              <X className="h-6 w-6" />
            </button>

            <h2
              id="embed-dialog-title"
              className="pr-10 text-xl font-bold text-gray-950 dark:text-white sm:text-2xl"
            >
              Embed {gameTitle}
            </h2>

            <div className="mt-6">
              <label
                htmlFor="game-embed-url"
                className="text-base font-bold text-[#ff4b16] sm:text-lg"
              >
                Embed URL
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="game-embed-url"
                  type="text"
                  value={resolvedEmbedUrl}
                  readOnly
                  className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm text-gray-950 outline-none ring-orange-500 focus:ring-2 dark:bg-[#0d321d] dark:text-gray-100 sm:text-base"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => copyText(resolvedEmbedUrl, "embed-url")}
                  className="flex min-w-[84px] items-center justify-center gap-1.5 rounded-full bg-[#ff4b16] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#e83d0b]"
                >
                  {copiedTarget === "embed-url" && <Check className="h-4 w-4" />}
                  {copiedTarget === "embed-url" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="mt-7">
              <label
                htmlFor="game-embed-code"
                className="text-base font-bold text-[#ff4b16] sm:text-lg"
              >
                Embed Code
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="game-embed-code"
                  type="text"
                  value={embedCode}
                  readOnly
                  className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm text-gray-950 outline-none ring-orange-500 focus:ring-2 dark:bg-[#0d321d] dark:text-gray-100 sm:text-base"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => copyText(embedCode, "embed-code")}
                  className="flex min-w-[84px] items-center justify-center gap-1.5 rounded-full bg-[#ff4b16] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#e83d0b]"
                >
                  {copiedTarget === "embed-code" && <Check className="h-4 w-4" />}
                  {copiedTarget === "embed-code" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

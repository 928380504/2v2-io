"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code2,
  Gamepad2,
  Heart,
  Play,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import type { Game } from "@/config/game-catalog";
import { GameTags } from "@/components/All/GameTags";
import { GameComments } from "./GameComments3";
import { GameFaq } from "./GameFaq3";
import type { GameFaqItem } from "./GameFaq3";
import { useGameRating } from "@/hooks/use-game-rating";
import { getPublicRatingCount } from "@/lib/game-rating-store";
import { useGameEngagement } from "@/hooks/use-game-engagement";
import { useGameCardStats } from "@/hooks/use-game-card-stats";
import { GameCard } from "@/components/templates/GameCard";
import {
  getPrimaryGameAttributeLabel,
  getPrimaryGameAttributeValues,
} from "@/config/game-filters";
import { SITE_FEATURES } from "@/config/features";
import { SITE_ROUTES } from "@/config/routes";

interface Category {
  name: string;
  href: string;
}

interface Rating {
  score: number;
  votes: number;
}

interface ParsedSection {
  title: string;
  body: string;
}

interface GameIntro2Props {
  gameId: string;
  title: string;
  description: string;
  categories: Category[];
  similarityAttributes?: string[];
  rating?: Rating;
  logoImage: string;
  developer?: string;
  siteAddedAt?: string;
  technology?: string;
  platforms?: string[];
  videoComponent?: ReactNode;
  youtubeComponent?: ReactNode;
  relatedGames?: Game[];
  faqItems?: GameFaqItem[];
}

const HEADING_PATTERN = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i;

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDescription(description: string) {
  const sectionMatches = Array.from(
    description.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi),
  );

  const sections: ParsedSection[] = sectionMatches.map((match) => {
    const content = match[1];
    const heading = content.match(HEADING_PATTERN);

    return {
      title: heading ? stripHtml(heading[1]) : "",
      body: content.replace(HEADING_PATTERN, "").trim(),
    };
  });

  if (sections.length === 0) {
    return {
      introduction: { title: "", body: description },
      gameplay: [] as ParsedSection[],
      controls: [] as ParsedSection[],
    };
  }

  const introductionIndex = Math.max(
    0,
    sections.findIndex((section) =>
      /welcome|about|introduction|overview/i.test(section.title),
    ),
  );
  const introduction = sections[introductionIndex];
  const remaining = sections.filter((_, index) => index !== introductionIndex);
  const controls = remaining.filter((section) =>
    /how to play|controls?|instructions?|操作/i.test(section.title),
  );
  const gameplay = remaining.filter((section) => !controls.includes(section));

  return { introduction, gameplay, controls };
}

function formatSiteAddedDate(value?: string) {
  if (!value) return "Not specified";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const [, year, month, day] = match;
  const monthName = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(Date.UTC(2024, Number(month) - 1, 1)),
  );
  return `${monthName} ${Number(day)}, ${year}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 100_000 ? 0 : 1,
  }).format(Math.max(0, value));
}

function getRatingProgress(value: number) {
  const normalizedValue = Math.min(5, Math.max(0, value));

  if (normalizedValue <= 4.5) {
    return (normalizedValue / 4.5) * 70;
  }

  return 70 + ((normalizedValue - 4.5) / 0.5) * 30;
}

function ContentHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
      <span className="h-6 w-1 rounded-full bg-green-600 dark:bg-green-400" />
      {children}
    </h2>
  );
}

function RichContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-900 prose-a:text-green-700 prose-li:marker:text-green-600 dark:prose-invert dark:text-gray-200 dark:prose-headings:text-white dark:prose-a:text-green-300 sm:prose-base"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function GameIntro2({
  gameId,
  title,
  description,
  categories,
  similarityAttributes = [],
  rating,
  logoImage,
  developer,
  siteAddedAt,
  technology,
  platforms,
  videoComponent,
  youtubeComponent,
  relatedGames = [],
  faqItems,
}: GameIntro2Props) {
  const content = parseDescription(description);
  const liveRating = useGameRating(gameId, {
    score: rating?.score ?? 0,
    votes: rating?.votes ?? 0,
  });
  const gameEngagement = useGameEngagement(gameId);
  const score = liveRating.score;
  const publicRatingCount = getPublicRatingCount(liveRating.votes);
  const [animatedScore, setAnimatedScore] = useState(0);
  const ratingRingRef = useRef<HTMLDivElement>(null);
  const similarGamesTrackRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasPlayedRatingAnimation = useRef(false);
  const animatedScoreRef = useRef(0);
  const latestScoreRef = useRef(score);
  const similarGamesControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canScrollSimilarGamesLeft, setCanScrollSimilarGamesLeft] = useState(false);
  const [canScrollSimilarGamesRight, setCanScrollSimilarGamesRight] = useState(false);
  const [isSimilarGamesHovered, setIsSimilarGamesHovered] = useState(false);
  const [isSimilarGamesInteracting, setIsSimilarGamesInteracting] = useState(false);
  const availableSimilarityAttributes = useMemo(() => {
    const seen = new Set<string>();

    return similarityAttributes.filter((slug) => {
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);

      return relatedGames.some((relatedGame) =>
        getPrimaryGameAttributeValues(relatedGame).includes(slug),
      );
    });
  }, [similarityAttributes, relatedGames]);
  const [selectedSimilarityAttribute, setSelectedSimilarityAttribute] = useState(
    availableSimilarityAttributes[0] ?? "",
  );
  const similarityAttributeLabels = useMemo(
    () => availableSimilarityAttributes.map(getPrimaryGameAttributeLabel),
    [availableSimilarityAttributes],
  );
  const similarityAttributeCounts = useMemo(
    () =>
      Object.fromEntries(
        availableSimilarityAttributes.map((slug) => [
          getPrimaryGameAttributeLabel(slug),
          relatedGames.filter((game) =>
            getPrimaryGameAttributeValues(game).includes(slug),
          ).length,
        ]),
      ),
    [availableSimilarityAttributes, relatedGames],
  );
  const visualScoreProgress = getRatingProgress(animatedScore);
  const scoreProgress = `${visualScoreProgress} 100`;
  const scoreHue = Math.min(100, visualScoreProgress);
  const engagement = SITE_FEATURES.engagement ? [
    {
      label: "Plays",
      value: gameEngagement.counts.plays,
      icon: Play,
    },
    {
      label: "Favorites",
      value: gameEngagement.counts.favorites,
      icon: Heart,
    },
    {
      label: "Likes",
      value: gameEngagement.counts.likes,
      icon: ThumbsUp,
    },
  ] : [];
  const similarGames = useMemo(() => {
    const matchingGames = selectedSimilarityAttribute
      ? relatedGames.filter((relatedGame) =>
          getPrimaryGameAttributeValues(relatedGame).includes(
            selectedSimilarityAttribute,
          ),
        )
      : relatedGames;

    return matchingGames.slice(0, 12);
  }, [relatedGames, selectedSimilarityAttribute]);
  const { items: similarGameStats } = useGameCardStats(
    similarGames.map((game) => game.id),
  );

  const gameBackground = [
    {
      label: "Developer",
      value: developer || "Independent Studio",
      icon: UserRound,
    },
    {
      label: "Added to Site",
      value: formatSiteAddedDate(siteAddedAt),
      icon: CalendarDays,
    },
    {
      label: "Technology",
      value: technology || "HTML5 / WebGL",
      icon: Code2,
    },
    {
      label: "Platform",
      value: platforms?.join(", ") || "Web Browser",
      icon: Gamepad2,
    },
  ];

  const updateSimilarGamesControls = useCallback(() => {
    const track = similarGamesTrackRef.current;
    if (!track) return;

    setCanScrollSimilarGamesLeft(track.scrollLeft > 2);
    setCanScrollSimilarGamesRight(
      track.scrollLeft + track.clientWidth < track.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    setSelectedSimilarityAttribute((currentSlug) => {
      const stillAvailable = availableSimilarityAttributes.includes(currentSlug);

      return stillAvailable
        ? currentSlug
        : (availableSimilarityAttributes[0] ?? "");
    });
  }, [availableSimilarityAttributes]);

  const revealSimilarGamesControls = useCallback(() => {
    setIsSimilarGamesInteracting(true);
    if (similarGamesControlsTimerRef.current !== null) {
      clearTimeout(similarGamesControlsTimerRef.current);
    }
    similarGamesControlsTimerRef.current = setTimeout(() => {
      setIsSimilarGamesInteracting(false);
      similarGamesControlsTimerRef.current = null;
    }, 1600);
  }, []);

  const areSimilarGamesControlsVisible =
    isSimilarGamesHovered || isSimilarGamesInteracting;

  const scrollSimilarGames = (direction: -1 | 1) => {
    const track = similarGamesTrackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction * Math.max(180, track.clientWidth * 0.82),
      behavior: "smooth",
    });
    revealSimilarGamesControls();
  };

  useEffect(() => {
    const track = similarGamesTrackRef.current;
    if (!track) return;

    track.scrollTo({ left: 0, behavior: "auto" });

    updateSimilarGamesControls();
    const handleScroll = () => {
      updateSimilarGamesControls();
      revealSimilarGamesControls();
    };
    track.addEventListener("scroll", handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(updateSimilarGamesControls);
    resizeObserver.observe(track);

    return () => {
      track.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [
    revealSimilarGamesControls,
    selectedSimilarityAttribute,
    similarGames.length,
    updateSimilarGamesControls,
  ]);

  useEffect(() => {
    return () => {
      if (similarGamesControlsTimerRef.current !== null) {
        clearTimeout(similarGamesControlsTimerRef.current);
      }
    };
  }, []);

  const animateRating = useCallback((targetScore: number, duration: number) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startScore = animatedScoreRef.current;
    const startTime = performance.now();
    const updateScore = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = progress * progress * (3 - 2 * progress);
      const nextScore = startScore + ((targetScore - startScore) * easedProgress);

      animatedScoreRef.current = nextScore;
      setAnimatedScore(nextScore);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateScore);
      } else {
        animatedScoreRef.current = targetScore;
        setAnimatedScore(targetScore);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateScore);
  }, []);

  useEffect(() => {
    latestScoreRef.current = score;
    if (!hasPlayedRatingAnimation.current) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      animatedScoreRef.current = score;
      setAnimatedScore(score);
      return;
    }

    animateRating(score, 550);
  }, [animateRating, score]);

  useEffect(() => {
    const ratingRing = ratingRingRef.current;
    if (!ratingRing) return;

    hasPlayedRatingAnimation.current = false;
    animatedScoreRef.current = 0;
    setAnimatedScore(0);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      hasPlayedRatingAnimation.current = true;
      animatedScoreRef.current = latestScoreRef.current;
      setAnimatedScore(latestScoreRef.current);
      return;
    }

    const playAnimation = () => {
      if (hasPlayedRatingAnimation.current) return;
      hasPlayedRatingAnimation.current = true;

      animateRating(latestScoreRef.current, 1900);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        playAnimation();
      },
      { threshold: 0.45 },
    );

    observer.observe(ratingRing);

    return () => {
      observer.disconnect();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animateRating, gameId]);

  return (
    <article className="overflow-hidden rounded-2xl bg-white/90 shadow-lg ring-1 ring-green-100/80 backdrop-blur-sm dark:bg-[#0d4021]/95 dark:ring-green-700/30">
      <div className="p-5 sm:p-7 lg:p-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-300 sm:text-sm"
        >
          <Link href={SITE_ROUTES.home} className="text-green-700 hover:underline dark:text-green-300">
            Home
          </Link>
          {categories.map((category) => (
            <span key={category.href} className="flex items-center gap-2">
              <span aria-hidden="true" className="text-gray-300 dark:text-green-700">/</span>
              <Link
                href={category.href}
                className="text-green-700 hover:underline dark:text-green-300"
              >
                {category.name}
              </Link>
            </span>
          ))}
          <span aria-hidden="true" className="text-gray-300 dark:text-green-700">/</span>
          <span className="max-w-full truncate text-gray-600 dark:text-gray-200">{title}</span>
        </nav>

        <h1 className="mb-6 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
          {title}
        </h1>

        <div className="grid gap-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-stretch">
          <div className="mx-auto w-[150px] max-w-[150px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-green-100 dark:bg-[#123f24] dark:ring-green-700/40 sm:mx-0 sm:flex sm:h-full sm:w-full sm:flex-col">
            <div
              className="relative w-full overflow-hidden bg-green-50 dark:bg-green-950/50"
              style={{ aspectRatio: "1 / 1" }}
            >
              <Image
                src={logoImage}
                alt={`${title} logo`}
                fill
                priority
                sizes="150px"
                className="object-cover"
              />
            </div>

            <div className="-mt-px flex items-center justify-center border-t border-green-100 bg-green-50/60 px-[clamp(0.4rem,0.55vw,0.625rem)] py-[clamp(0.45rem,0.62vw,0.625rem)] dark:border-green-700/35 dark:bg-green-950/30 sm:flex-1">
              <div className="flex w-full items-center justify-center gap-[clamp(0.4rem,0.65vw,0.75rem)]">
                {SITE_FEATURES.ratings && (
                  <div
                    ref={ratingRingRef}
                    role="img"
                    aria-label={`Rating ${score.toFixed(1)} out of 5 from ${publicRatingCount} ratings`}
                    className="relative h-[clamp(2.75rem,3.5vw,3.375rem)] w-[clamp(2.75rem,3.5vw,3.375rem)] shrink-0"
                  >
                  <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="22" cy="22" r="14" className="fill-white" />
                    <circle cx="22" cy="22" r="18" fill="none" strokeWidth="6" className="stroke-green-100 dark:stroke-green-900" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="none"
                      strokeWidth="6"
                      pathLength="100"
                      strokeDasharray={scoreProgress}
                      strokeLinecap="round"
                      style={{
                        stroke: `hsl(${scoreHue} 78% 46%)`,
                        transition: "stroke 120ms linear",
                      }}
                    />
                  </svg>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 grid place-items-center text-[clamp(0.625rem,0.72vw,0.75rem)] font-black tabular-nums text-gray-800"
                  >
                    {animatedScore.toFixed(1)}
                  </span>
                  </div>
                )}

                {engagement.length > 0 && (
                  <div className={`min-w-0 space-y-[clamp(0.1rem,0.22vw,0.25rem)] ${SITE_FEATURES.ratings ? "border-l border-green-100 pl-[clamp(0.4rem,0.65vw,0.75rem)] dark:border-green-700/40" : ""}`}>
                    {engagement.map(({ label, value, icon: Icon }) => (
                      <div
                        key={label}
                        title={`${label}: ${new Intl.NumberFormat("en-US").format(value)}`}
                        className="flex items-center gap-[clamp(0.2rem,0.35vw,0.375rem)] text-[clamp(9px,0.72vw,11px)] font-semibold leading-[clamp(1rem,1.25vw,1.25rem)] text-gray-600 dark:text-gray-200"
                      >
                        <Icon className="h-[clamp(0.7rem,0.9vw,0.875rem)] w-[clamp(0.7rem,0.9vw,0.875rem)] shrink-0 text-green-700 dark:text-green-300" />
                        <span>{formatCompactNumber(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <dl
            aria-label="Game background"
            className="divide-y divide-green-100 overflow-hidden rounded-2xl bg-green-50/60 shadow-sm ring-1 ring-green-100 dark:divide-green-700/35 dark:bg-green-950/30 dark:ring-green-700/35 sm:grid sm:h-full sm:grid-rows-4"
          >
            {gameBackground.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex min-h-[54px] flex-col justify-center px-[clamp(0.7rem,0.95vw,1rem)] py-[clamp(0.3rem,0.35vw,0.45rem)] sm:min-h-0"
              >
                <dt className="flex items-center gap-[clamp(0.3rem,0.45vw,0.5rem)] text-[clamp(9.5px,0.68vw,11px)] font-bold uppercase tracking-[0.1em] text-green-700 dark:text-green-300">
                  <Icon className="h-[clamp(0.75rem,0.9vw,0.9rem)] w-[clamp(0.75rem,0.9vw,0.9rem)]" />
                  {label}
                </dt>
                <dd className="mt-[clamp(0.15rem,0.2vw,0.25rem)] break-words text-[clamp(8.5px,0.65vw,10px)] font-medium leading-[clamp(0.95rem,1.05vw,1.125rem)] text-gray-700 dark:text-gray-200">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

      </div>

      <div className="border-t border-green-100 px-5 py-8 dark:border-green-700/35 sm:px-7 lg:px-8">
        <section id="game-introduction" className="mb-9 scroll-mt-24">
          <ContentHeading>Game Introduction</ContentHeading>
          <RichContent html={content.introduction.body} />
        </section>

        {videoComponent && (
          <figure className="mx-auto mb-9 w-fit max-w-full overflow-hidden rounded-2xl bg-green-50 ring-1 ring-green-100 dark:bg-green-950/40 dark:ring-green-700/35 [&_img]:!mb-0 [&_img]:!h-auto [&_img]:!w-auto [&_img]:max-w-full [&_img]:rounded-none [&_img]:block">
            {videoComponent}
          </figure>
        )}

        <section id="gameplay" className="mb-9 scroll-mt-24">
          <ContentHeading>Gameplay</ContentHeading>
          <div className="space-y-7">
            {content.gameplay.length > 0 ? (
              content.gameplay.map((section, index) => (
                <div key={`${section.title}-${index}`}>
                  {section.title && (
                    <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
                      {section.title}
                    </h3>
                  )}
                  <RichContent html={section.body} />
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-gray-600 dark:text-gray-200">
                Jump into the game to explore its mechanics, modes, and challenges.
              </p>
            )}
          </div>
        </section>

        <section id="game-controls" className="mb-9 scroll-mt-24">
          <ContentHeading>Game Controls</ContentHeading>
          <div className="space-y-7">
            {content.controls.length > 0 ? (
              content.controls.map((section, index) => (
                <div key={`${section.title}-${index}`}>
                  <RichContent html={section.body} />
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-gray-600 dark:text-gray-200">
                Controls are shown in-game and may vary between desktop and mobile devices.
              </p>
            )}
          </div>
        </section>

        {youtubeComponent && (
          <section id="game-video" className="mb-9 scroll-mt-24">
            {youtubeComponent}
          </section>
        )}

        <section id="game-faq" className="mb-9 scroll-mt-24">
          <ContentHeading>Frequently Asked Questions</ContentHeading>
          <GameFaq gameTitle={title} items={faqItems} />
        </section>

        {similarGames.length > 0 && (
          <section id="similar-games" className="mb-9 scroll-mt-24">
            <ContentHeading>Similar Games</ContentHeading>
            {availableSimilarityAttributes.length > 0 && (
              <div className="mb-4 flex items-start gap-3">
                <GameTags
                  tags={similarityAttributeLabels}
                  maxTags={null}
                  wrap
                  showCount
                  tagCounts={similarityAttributeCounts}
                  selectedTag={getPrimaryGameAttributeLabel(
                    selectedSimilarityAttribute,
                  )}
                  onTagSelect={(label) => {
                    const selectedSlug = availableSimilarityAttributes.find(
                      (slug) => getPrimaryGameAttributeLabel(slug) === label,
                    );
                    if (selectedSlug) setSelectedSimilarityAttribute(selectedSlug);
                  }}
                  className="min-w-0 flex-1 gap-x-3 gap-y-2.5 [&>*]:px-3 [&>*]:py-1.5 [&>*]:text-[10px] sm:[&>*]:text-xs"
                />
                <Link
                  href={SITE_ROUTES.gameFilters}
                  className="mt-1 shrink-0 text-xs font-bold text-green-700 underline-offset-2 transition hover:underline dark:text-green-300"
                >
                  All filters
                </Link>
              </div>
            )}
            <div
              className="relative"
              onMouseEnter={() => setIsSimilarGamesHovered(true)}
              onMouseLeave={() => setIsSimilarGamesHovered(false)}
              onPointerDown={revealSimilarGamesControls}
              onFocusCapture={revealSimilarGamesControls}
            >
              <div
                ref={similarGamesTrackRef}
                className="similar-games-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-3"
              >
                {similarGames.map((game) => (
                  <div
                    key={game.id}
                    className="w-[76%] shrink-0 snap-start sm:w-[46%] lg:w-[31.5%]"
                  >
                    <GameCard
                      game={game}
                      engagementStats={similarGameStats[game.id]}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollSimilarGames(-1)}
                disabled={!canScrollSimilarGamesLeft}
                aria-label="Previous similar games"
                title="Previous games"
                className={`absolute left-1 top-[calc(50%-0.75rem)] z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 text-white shadow-md transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 ${
                  areSimilarGamesControlsVisible && canScrollSimilarGamesLeft
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => scrollSimilarGames(1)}
                disabled={!canScrollSimilarGamesRight}
                aria-label="Next similar games"
                title="Next games"
                className={`absolute right-1 top-[calc(50%-0.75rem)] z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 text-white shadow-md transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 ${
                  areSimilarGamesControlsVisible && canScrollSimilarGamesRight
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {SITE_FEATURES.comments && (
          <section id="game-comments" className="scroll-mt-24">
            <GameComments gameId={gameId} gameTitle={title} />
          </section>
        )}
      </div>
    </article>
  );
}

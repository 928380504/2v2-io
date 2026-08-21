"use client";

import { ChevronUp, Clock3, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CachedGameProfile,
  PROFILE_READY_EVENT,
  readCachedGameProfile,
} from "@/lib/game-bridge";
import {
  readLocalApiCacheEntry,
  writeLocalApiCache,
} from "@/lib/local-api-cache";
import { SITE_TIME_ZONE } from "@/config/site-time";
import { DATA_PROVIDER } from "@/config/data-provider";
import { SITE_RUNTIME } from "@/site/runtime";
import { siteDayKey, siteDayStart } from "@/lib/site-time";
import {
  fetchLeaderboard,
  fetchLeaderboardContext,
  fetchLiveLeaderboard,
} from "@/lib/data/game-data-client";
import {
  competitionMetricLabel,
  competitionMetricValue,
  competitionPreviousPeriodMetric,
  formatPreviousPeriodMetric,
  isCompetitionMode,
  previousPodiumPlaceholderLabel,
} from "@/lib/data/competition-adapter";

type RankingPeriod = "daily" | "allTime";
type SlotDirection = "up" | "down" | null;

interface CountryInfo {
  code: string;
  name: string;
}

interface ApiLeaderboardEntry {
  [key: string]: unknown;
  rank: number;
  profileId: string;
  nickname: string;
  countryCode: string;
  lastPlayedAt: number;
  previousDayRank?: 1 | 2 | 3 | null;
  medals?: {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
}

interface LeaderboardEntry extends ApiLeaderboardEntry {
  name: string;
  country: CountryInfo;
  isCurrentUser?: boolean;
}

interface LeaderboardResponse {
  ok: boolean;
  period: RankingPeriod;
  mode: string;
  day: string | null;
  resetAt: number | null;
  generatedAt: number;
  dataSource: "snapshot" | "live";
  totalPlayers: number;
  entries: ApiLeaderboardEntry[];
  currentPlayer: ApiLeaderboardEntry | null;
  currentWindow: ApiLeaderboardEntry[];
  lastPlayer: ApiLeaderboardEntry | null;
  liveRefresh?: {
    refreshCount: number;
    dailyLimit: number;
    remaining: number;
    retryAt: number;
  };
}

interface LeaderboardContextResponse {
  ok: boolean;
  period: RankingPeriod;
  mode: string;
  day: string | null;
  generatedAt: number;
  dataSource: "snapshot" | "live";
  totalPlayers: number;
  currentPlayer: ApiLeaderboardEntry | null;
  currentWindow: ApiLeaderboardEntry[];
}

interface LeaderboardPanelProps {
  className?: string;
}

const DAILY_AUTO_REFRESH_MS = DATA_PROVIDER.cache.leaderboardDailyMs;
const ALL_TIME_AUTO_REFRESH_MS = DATA_PROVIDER.cache.leaderboardAllTimeMs;
const LIVE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const LIVE_REFRESH_DAILY_LIMIT = 12;
const MAX_VISIBLE_RANKS = DATA_PROVIDER.limits.leaderboardRanks;
const LEADERBOARD_CACHE_PREFIX = SITE_RUNTIME.storage.leaderboard;
const EMPTY_RESPONSE: LeaderboardResponse = {
  ok: true,
  period: "daily",
  mode: DATA_PROVIDER.competition.mode,
  day: null,
  resetAt: null,
  generatedAt: 0,
  dataSource: "snapshot",
  totalPlayers: 0,
  entries: [],
  currentPlayer: null,
  currentWindow: [],
  lastPlayer: null,
};
const regionNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function formatRefreshTime(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function formatRefreshCountdown(timestamp: number, now = Date.now()) {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((timestamp - now) / 1000),
  );
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function leaderboardRefreshMs(period: RankingPeriod) {
  return period === "daily"
    ? DAILY_AUTO_REFRESH_MS
    : ALL_TIME_AUTO_REFRESH_MS;
}

function liveRefreshStorageKey(
  period: RankingPeriod,
  profileId: string,
) {
  return `${LEADERBOARD_CACHE_PREFIX}:live:${period}:${profileId}`;
}

function liveRefreshLimitStorageKey(
  period: RankingPeriod,
  profileId: string,
) {
  return `${LEADERBOARD_CACHE_PREFIX}:live-limit:${period}:${profileId}`;
}

function liveRefreshUsageStorageKey(
  period: RankingPeriod,
  profileId: string,
) {
  return `${LEADERBOARD_CACHE_PREFIX}:live-usage:${period}:${profileId}`;
}

function readLiveRefreshUsage(period: RankingPeriod, profileId: string) {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        liveRefreshUsageStorageKey(period, profileId),
      ) || "null",
    ) as { day?: unknown; count?: unknown } | null;
    const count = Number(stored?.count);
    return stored?.day === siteDayKey() && Number.isInteger(count)
      ? Math.max(0, Math.min(LIVE_REFRESH_DAILY_LIMIT, count))
      : 0;
  } catch {
    return 0;
  }
}

function writeLiveRefreshUsage(
  period: RankingPeriod,
  profileId: string,
  count: number,
) {
  window.localStorage.setItem(
    liveRefreshUsageStorageKey(period, profileId),
    JSON.stringify({
      day: siteDayKey(),
      count: Math.max(0, Math.min(LIVE_REFRESH_DAILY_LIMIT, count)),
    }),
  );
}

function latestPodiumFinalizationAt(timestamp = Date.now()) {
  return siteDayStart(siteDayKey(timestamp));
}

function isCurrentAllTimeMedalCache(generatedAt: number) {
  return generatedAt >= latestPodiumFinalizationAt();
}

function leaderboardCacheKey(
  period: RankingPeriod,
) {
  return `${LEADERBOARD_CACHE_PREFIX}:page:${period}`;
}

function leaderboardContextCacheKey(
  period: RankingPeriod,
  profileId: string,
) {
  return `${LEADERBOARD_CACHE_PREFIX}:context:${period}:${profileId}`;
}

function isLeaderboardResponse(value: unknown): value is LeaderboardResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<LeaderboardResponse>;
  return (
    response.ok === true &&
    (response.period === "daily" || response.period === "allTime") &&
    isCompetitionMode(response.mode) &&
    typeof response.generatedAt === "number" &&
    (response.dataSource === "snapshot" || response.dataSource === "live") &&
    typeof response.totalPlayers === "number" &&
    Array.isArray(response.entries) &&
    Array.isArray(response.currentWindow) &&
    (response.lastPlayer === null || typeof response.lastPlayer === "object") &&
    (response.currentPlayer === null ||
      typeof response.currentPlayer === "object")
  );
}

function readLeaderboardCache(
  period: RankingPeriod,
) {
  const cachedEntry = readLocalApiCacheEntry(
    leaderboardCacheKey(period),
    isLeaderboardResponse,
  );
  const cached = cachedEntry?.value || null;
  if (!cached || cached.period !== period || cached.totalPlayers <= 0) {
    return null;
  }
  if (period === "daily" && cached.day !== siteDayKey()) return null;
  if (
    period === "allTime" &&
    !isCurrentAllTimeMedalCache(cached.generatedAt)
  ) return null;
  return cached;
}

function readFreshLeaderboardCache(period: RankingPeriod) {
  const cached = readLocalApiCacheEntry(
    leaderboardCacheKey(period),
    isLeaderboardResponse,
  );
  if (
    !cached ||
    Date.now() - cached.savedAt >= leaderboardRefreshMs(period) ||
    cached.value.period !== period ||
    cached.value.totalPlayers <= 0 ||
    (period === "daily" && cached.value.day !== siteDayKey()) ||
    (period === "allTime" &&
      !isCurrentAllTimeMedalCache(cached.value.generatedAt))
  ) {
    return null;
  }
  return cached.value;
}

function isLeaderboardContextResponse(
  value: unknown,
): value is LeaderboardContextResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<LeaderboardContextResponse>;
  return (
    response.ok === true &&
    (response.period === "daily" || response.period === "allTime") &&
    isCompetitionMode(response.mode) &&
    typeof response.generatedAt === "number" &&
    (response.dataSource === "snapshot" || response.dataSource === "live") &&
    typeof response.totalPlayers === "number" &&
    Array.isArray(response.currentWindow) &&
    (response.currentPlayer === null ||
      typeof response.currentPlayer === "object")
  );
}

function deriveContextFromEntries(
  entries: ApiLeaderboardEntry[],
  profileId: string,
  totalPlayers: number,
) {
  const currentPlayer = entries.find(
    (entry) => entry.profileId === profileId,
  ) || null;
  if (!currentPlayer) return null;
  if (currentPlayer.rank <= 3) {
    return { currentPlayer, currentWindow: [] as ApiLeaderboardEntry[] };
  }
  const currentWindow = entries.filter(
    (entry) => Math.abs(entry.rank - currentPlayer.rank) <= 1,
  );
  const expectedWindowSize = currentPlayer.rank === totalPlayers ? 2 : 3;
  return currentWindow.length === expectedWindowSize
    ? { currentPlayer, currentWindow }
    : null;
}

function getResetCountdown(resetAt: number | null) {
  if (!resetAt) return "--:--:--";
  const remainingSeconds = Math.max(
    0,
    Math.ceil((resetAt - Date.now()) / 1000),
  );
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

const flagVisuals: Record<
  string,
  { background: string; mark?: string; markClass?: string }
> = {
  cn: {
    background: "#de2910",
    mark: "★",
    markClass: "left-[2px] top-[1px] text-[6px] text-yellow-300",
  },
  us: {
    background:
      "repeating-linear-gradient(to bottom, #b22234 0 1.2px, #ffffff 1.2px 2.4px)",
    mark: "★",
    markClass:
      "left-0 top-0 flex h-[7px] w-[8px] items-center justify-center bg-[#3c3b6e] text-[4px] text-white",
  },
  gb: {
    background:
      "linear-gradient(90deg, transparent 42%, #fff 42% 58%, transparent 58%), linear-gradient(transparent 34%, #fff 34% 66%, transparent 66%), linear-gradient(90deg, transparent 47%, #c8102e 47% 53%, transparent 53%), linear-gradient(transparent 42%, #c8102e 42% 58%, transparent 58%), #012169",
  },
  ca: {
    background:
      "linear-gradient(to right, #d80621 0 27%, #fff 27% 73%, #d80621 73%)",
    mark: "◆",
    markClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[5px] text-[#d80621]",
  },
  au: {
    background: "#012169",
    mark: "✦",
    markClass:
      "right-[2px] top-1/2 -translate-y-1/2 text-[7px] text-white",
  },
  kr: {
    background: "#fff",
    mark: "◉",
    markClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] text-[#cd2e3a]",
  },
  de: {
    background:
      "linear-gradient(to bottom, #171717 0 33%, #dd0000 33% 66%, #ffce00 66%)",
  },
  fr: {
    background:
      "linear-gradient(to right, #0055a4 0 33%, #fff 33% 66%, #ef4135 66%)",
  },
  br: {
    background: "#009739",
    mark: "◆",
    markClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] text-[#ffdf00]",
  },
  jp: {
    background: "#fff",
    mark: "●",
    markClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] text-[#bc002d]",
  },
  es: {
    background:
      "linear-gradient(to bottom, #aa151b 0 25%, #f1bf00 25% 75%, #aa151b 75%)",
  },
  tr: {
    background: "#e30a17",
    mark: "☾",
    markClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] text-white",
  },
  pl: {
    background: "linear-gradient(to bottom, #fff 0 50%, #dc143c 50%)",
  },
  nl: {
    background:
      "linear-gradient(to bottom, #ae1c28 0 33%, #fff 33% 66%, #21468b 66%)",
  },
  se: {
    background:
      "linear-gradient(to right, transparent 0 30%, #fecc00 30% 42%, transparent 42%), linear-gradient(to bottom, transparent 0 42%, #fecc00 42% 58%, transparent 58%), #006aa7",
  },
  sg: {
    background: "linear-gradient(to bottom, #ef3340 0 50%, #fff 50%)",
    mark: "☾",
    markClass: "left-[3px] top-[1px] text-[6px] text-white",
  },
  mx: {
    background:
      "linear-gradient(to right, #006847 0 33%, #fff 33% 66%, #ce1126 66%)",
    mark: "•",
    markClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] text-[#6b4f2a]",
  },
  it: {
    background:
      "linear-gradient(to right, #009246 0 33%, #fff 33% 66%, #ce2b37 66%)",
  },
  fi: {
    background:
      "linear-gradient(to right, transparent 0 31%, #003580 31% 43%, transparent 43%), linear-gradient(to bottom, transparent 0 40%, #003580 40% 60%, transparent 60%), #fff",
  },
};

function toDisplayEntry(
  entry: ApiLeaderboardEntry,
  profileId: string | null,
): LeaderboardEntry {
  const countryCode = /^[A-Z]{2}$/i.test(entry.countryCode)
    ? entry.countryCode.toUpperCase()
    : "XX";
  return {
    ...entry,
    name: entry.nickname,
    country: {
      code: countryCode.toLowerCase(),
      name: regionNames?.of(countryCode) || countryCode,
    },
    isCurrentUser: entry.profileId === profileId,
  };
}

function uniqueRankedEntries(entries: LeaderboardEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.profileId)) return false;
    seen.add(entry.profileId);
    return true;
  });
}

function getCollapsedEntries(
  entries: LeaderboardEntry[],
  currentWindow: LeaderboardEntry[],
  lastPlayer: LeaderboardEntry | null,
) {
  const topThree = entries.slice(0, 3);
  const prioritized = uniqueRankedEntries([
    ...topThree,
    ...currentWindow,
    ...(lastPlayer ? [lastPlayer] : []),
  ]);
  const lastProfileId = lastPlayer?.profileId;
  const withoutLast = prioritized.filter(
    (entry) => entry.profileId !== lastProfileId,
  );
  const fillers = entries.filter(
    (entry) =>
      entry.profileId !== lastProfileId &&
      !withoutLast.some((candidate) => candidate.profileId === entry.profileId),
  );
  const visible = uniqueRankedEntries([
    ...withoutLast,
    ...fillers.slice(0, Math.max(0, 6 - withoutLast.length)),
    ...(lastPlayer ? [lastPlayer] : []),
  ]);
  return visible.slice(0, 7);
}

function CountryFlag({ country }: { country: CountryInfo }) {
  const visual = flagVisuals[country.code] ?? {
    background: "linear-gradient(135deg, #cbd5e1, #64748b)",
    mark: "?",
    markClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] font-black text-white",
  };

  return (
    <span
      role="img"
      aria-label={`${country.name} flag`}
      title={country.name}
      className="leaderboard-country relative mr-2 inline-flex h-[10px] w-[15px] shrink-0 overflow-hidden rounded-[2px] shadow-sm ring-1 ring-black/10 dark:ring-white/15"
      style={{ background: visual.background }}
    >
      {visual.mark && (
        <span
          aria-hidden="true"
          className={`absolute leading-none ${visual.markClass ?? ""}`}
        >
          {visual.mark}
        </span>
      )}
    </span>
  );
}

function RankBadge({
  rank,
  isLast,
  isPreviousDayZeroWin,
}: {
  rank: number;
  isLast: boolean;
  isPreviousDayZeroWin: boolean;
}) {
  if (rank <= 3 && !isPreviousDayZeroWin) {
    const medals = ["🥇", "🥈", "🥉"];
    const labels = [
      "Gold medal, rank 1",
      "Silver medal, rank 2",
      "Bronze medal, rank 3",
    ];

    return (
      <span
        role="img"
        aria-label={labels[rank - 1]}
        className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none drop-shadow-sm"
      >
        {medals[rank - 1]}
      </span>
    );
  }

  return (
    <span
      aria-label={
        isPreviousDayZeroWin
          ? `Rank ${rank}, yesterday's podium placeholder`
          : `Rank ${rank}`
      }
      title={
        isPreviousDayZeroWin
          ? previousPodiumPlaceholderLabel()
          : undefined
      }
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
        isLast
          ? "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"
          : "bg-green-50 text-green-700 dark:bg-green-800/50 dark:text-green-200"
      }`}
    >
      {rank}
    </span>
  );
}

function PreviousDayMedal({
  rank,
  previousPeriodMetric,
}: {
  rank: 1 | 2 | 3;
  previousPeriodMetric: number;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  const labels = [
    "Yesterday's Champion",
    "Yesterday's Runner-Up",
    "Yesterday's Third Place",
  ];
  const awardLabel = labels[rank - 1];
  const label = `${awardLabel} · ${formatPreviousPeriodMetric(previousPeriodMetric)}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="leaderboard-yesterday-medal relative -top-1 inline-flex h-3 w-3 shrink-0 items-center justify-center text-[9px] leading-none drop-shadow-sm"
    >
      {medals[rank - 1]}
    </span>
  );
}

function HistoricalMedalTotal({
  medals,
}: {
  medals: ApiLeaderboardEntry["medals"];
}) {
  if (!medals || medals.total <= 0) return null;

  const details = `Daily medals — Gold: ${medals.gold} · Silver: ${medals.silver} · Bronze: ${medals.bronze}`;

  return (
    <span
      aria-label={details}
      title={details}
      className="leaderboard-medal-total inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[9px] font-black tabular-nums text-amber-700 dark:text-amber-300"
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        🏅
      </span>
      <span>{medals.total}</span>
    </span>
  );
}

export function LeaderboardPanel({ className = "" }: LeaderboardPanelProps) {
  const [period, setPeriod] = useState<RankingPeriod>("daily");
  const [profile, setProfile] = useState<CachedGameProfile | null>(null);
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardResponse>(EMPTY_RESPONSE);
  const [refreshCount, setRefreshCount] = useState(0);
  const [slotDirection, setSlotDirection] = useState<SlotDirection>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullRanking, setIsFullRanking] = useState(false);
  const [dailyCountdown, setDailyCountdown] = useState("--:--:--");
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState<number | null>(
    null,
  );
  const [liveRefreshReadyAt, setLiveRefreshReadyAt] = useState(0);
  const [liveRefreshLimitResetAt, setLiveRefreshLimitResetAt] = useState(0);
  const [liveRefreshUsageCount, setLiveRefreshUsageCount] = useState(0);
  const [liveRefreshNotice, setLiveRefreshNotice] = useState<string | null>(
    null,
  );
  const [refreshClock, setRefreshClock] = useState(0);
  const requestSequence = useRef(0);
  const previousRanks = useRef<Record<RankingPeriod, number | null>>({
    daily: null,
    allTime: null,
  });

  const entries = useMemo(
    () =>
      leaderboard.entries.map((entry) =>
        toDisplayEntry(entry, profile?.profileId || null),
      ),
    [leaderboard.entries, profile?.profileId],
  );
  const currentWindow = useMemo(
    () =>
      leaderboard.currentWindow.map((entry) =>
        toDisplayEntry(entry, profile?.profileId || null),
      ),
    [leaderboard.currentWindow, profile?.profileId],
  );
  const lastPlayer = useMemo(
    () =>
      leaderboard.lastPlayer
        ? toDisplayEntry(
            leaderboard.lastPlayer,
            profile?.profileId || null,
          )
        : null,
    [leaderboard.lastPlayer, profile?.profileId],
  );
  const collapsedEntries = useMemo(
    () => getCollapsedEntries(entries, currentWindow, lastPlayer),
    [currentWindow, entries, lastPlayer],
  );
  const fullEntries = useMemo(
    () =>
      uniqueRankedEntries([
        ...entries,
        ...currentWindow,
        ...(lastPlayer ? [lastPlayer] : []),
      ]).sort((left, right) => left.rank - right.rank),
    [currentWindow, entries, lastPlayer],
  );

  const refreshLeaderboard = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setIsRefreshing(true);
    try {
      let result: unknown = readFreshLeaderboardCache(period);
      if (!result) {
        result = await fetchLeaderboard<unknown>(period, MAX_VISIBLE_RANKS);
      }
      if (
        requestId !== requestSequence.current ||
        !isLeaderboardResponse(result) ||
        result.period !== period
      ) {
        return false;
      }

      let currentPlayer: ApiLeaderboardEntry | null = null;
      let currentWindow: ApiLeaderboardEntry[] = [];
      if (profile?.profileId) {
        const localContext = deriveContextFromEntries(
          result.entries,
          profile.profileId,
          result.totalPlayers,
        );
        if (localContext) {
          currentPlayer = localContext.currentPlayer;
          currentWindow = localContext.currentWindow;
        } else {
          const contextKey = leaderboardContextCacheKey(
            period,
            profile.profileId,
          );
          const cachedContext = readLocalApiCacheEntry(
            contextKey,
            isLeaderboardContextResponse,
          );
          let contextResult: unknown =
            cachedContext &&
            Date.now() - cachedContext.savedAt < leaderboardRefreshMs(period) &&
            cachedContext.value.period === period &&
            (period !== "allTime" ||
              isCurrentAllTimeMedalCache(cachedContext.value.generatedAt)) &&
            (period !== "daily" || cachedContext.value.day === result.day)
              ? cachedContext.value
              : null;
          if (!contextResult) {
            contextResult = await fetchLeaderboardContext<unknown>({
              period,
              profileId: profile.profileId,
              day: period === "daily" ? result.day : undefined,
            });
          }
          if (
            !isLeaderboardContextResponse(contextResult) ||
            contextResult.period !== period
          ) {
            throw new Error("Invalid leaderboard context response");
          }
          currentPlayer = contextResult.currentPlayer;
          currentWindow = contextResult.currentWindow;
          writeLocalApiCache(contextKey, contextResult);
        }
      }

      const resolvedResult: LeaderboardResponse = {
        ...result,
        currentPlayer,
        currentWindow,
      };

      const previousRank = previousRanks.current[period];
      const nextRank = resolvedResult.currentPlayer?.rank ?? null;
      setSlotDirection(
        previousRank && nextRank && previousRank !== nextRank
          ? nextRank < previousRank
            ? "up"
            : "down"
          : null,
      );
      previousRanks.current[period] = nextRank;
      setLeaderboard(resolvedResult);
      if (resolvedResult.totalPlayers > 0) {
        writeLocalApiCache(
          leaderboardCacheKey(period),
          {
            ...resolvedResult,
            currentPlayer: null,
            currentWindow: [],
          },
        );
      }
      setRefreshCount((count) => count + 1);
      return true;
    } catch {
      // Keep the last successful response visible during a transient failure.
      return false;
    } finally {
      if (requestId === requestSequence.current) setIsRefreshing(false);
    }
  }, [period, profile?.profileId]);

  const handleManualRefresh = useCallback(async () => {
    const now = Date.now();
    if (!profile?.profileId) {
      setLiveRefreshNotice("Play a match to unlock live rankings.");
      return;
    }
    if (now < liveRefreshLimitResetAt) {
      setLiveRefreshNotice(
        `Daily live refresh limit reached (${LIVE_REFRESH_DAILY_LIMIT}/${LIVE_REFRESH_DAILY_LIMIT}) · Resets at ${formatRefreshTime(liveRefreshLimitResetAt)}`,
      );
      return;
    }
    if (now < liveRefreshReadyAt) {
      setLiveRefreshNotice(
        `Live refresh is cooling down · Ready in ${formatRefreshCountdown(liveRefreshReadyAt, now)}`,
      );
      return;
    }

    const requestId = ++requestSequence.current;
    setIsRefreshing(true);
    setLiveRefreshNotice(null);
    try {
      const liveResult = await fetchLiveLeaderboard<unknown>({
        period,
        profileId: profile.profileId,
        limit: MAX_VISIBLE_RANKS,
        day: period === "daily" ? leaderboard.day : undefined,
      });
      const result = liveResult.data;
      if (!liveResult.ok) {
        const errorResult = result as {
          error?: {
            code?: string;
            message?: string;
            details?: {
              retryAt?: number;
              dailyLimit?: number;
              refreshCount?: number;
            };
          };
        };
        const retryAt = Number(errorResult.error?.details?.retryAt || 0);
        const serverRefreshCount = Number(
          errorResult.error?.details?.refreshCount,
        );
        if (Number.isInteger(serverRefreshCount)) {
          const nextUsageCount = Math.max(
            0,
            Math.min(LIVE_REFRESH_DAILY_LIMIT, serverRefreshCount),
          );
          setLiveRefreshUsageCount(nextUsageCount);
          writeLiveRefreshUsage(period, profile.profileId, nextUsageCount);
        }
        if (errorResult.error?.code === "live_refresh_daily_limit") {
          const resetAt = retryAt > Date.now() ? retryAt : 0;
          setLiveRefreshLimitResetAt(resetAt);
          setLiveRefreshReadyAt(0);
          if (resetAt > 0) {
            window.localStorage.setItem(
              liveRefreshLimitStorageKey(period, profile.profileId),
              String(resetAt),
            );
          }
        } else if (retryAt > Date.now()) {
          setLiveRefreshReadyAt(retryAt);
        }
        setLiveRefreshNotice(
          errorResult.error?.message || "Live refresh is unavailable.",
        );
        return;
      }
      if (
        requestId !== requestSequence.current ||
        !isLeaderboardResponse(result) ||
        result.period !== period ||
        result.dataSource !== "live"
      ) {
        setLiveRefreshNotice("The live ranking response was invalid.");
        return;
      }

      const previousRank = previousRanks.current[period];
      const nextRank = result.currentPlayer?.rank ?? null;
      setSlotDirection(
        previousRank && nextRank && previousRank !== nextRank
          ? nextRank < previousRank
            ? "up"
            : "down"
          : null,
      );
      previousRanks.current[period] = nextRank;
      setLeaderboard(result);
      if (result.totalPlayers > 0) {
        writeLocalApiCache(
          leaderboardCacheKey(period),
          {
            ...result,
            currentPlayer: null,
            currentWindow: [],
          },
        );
        writeLocalApiCache(
          leaderboardContextCacheKey(period, profile.profileId),
          {
            ok: result.ok,
            period: result.period,
            mode: result.mode,
            day: result.day,
            generatedAt: result.generatedAt,
            dataSource: result.dataSource,
            totalPlayers: result.totalPlayers,
            currentPlayer: result.currentPlayer,
            currentWindow: result.currentWindow,
          } satisfies LeaderboardContextResponse,
        );
      }
      setRefreshCount((count) => count + 1);

      const refreshedAt = Number(result.generatedAt || Date.now());
      const readyAt = refreshedAt + LIVE_REFRESH_COOLDOWN_MS;
      setLastManualRefreshAt(refreshedAt);
      const limitResetAt =
        result.liveRefresh?.remaining === 0
          ? Number(result.liveRefresh.retryAt || 0)
          : 0;
      setLiveRefreshLimitResetAt(limitResetAt);
      setLiveRefreshReadyAt(limitResetAt > refreshedAt ? 0 : readyAt);
      const nextUsageCount = Math.max(
        0,
        Math.min(
          LIVE_REFRESH_DAILY_LIMIT,
          Number(result.liveRefresh?.refreshCount || 0),
        ),
      );
      setLiveRefreshUsageCount(nextUsageCount);
      writeLiveRefreshUsage(period, profile.profileId, nextUsageCount);
      window.localStorage.setItem(
        liveRefreshStorageKey(period, profile.profileId),
        String(refreshedAt),
      );
      if (limitResetAt > refreshedAt) {
        window.localStorage.setItem(
          liveRefreshLimitStorageKey(period, profile.profileId),
          String(limitResetAt),
        );
      }
    } catch {
      setLiveRefreshNotice("Live refresh failed. Please try again.");
    } finally {
      if (requestId === requestSequence.current) setIsRefreshing(false);
    }
  }, [
    leaderboard.day,
    liveRefreshLimitResetAt,
    liveRefreshReadyAt,
    period,
    profile?.profileId,
  ]);

  useEffect(() => {
    const cached = readLeaderboardCache(
      period,
    );
    if (cached) setLeaderboard(cached);

    void refreshLeaderboard();
    const intervalId = window.setInterval(
      refreshLeaderboard,
      leaderboardRefreshMs(period),
    );
    return () => {
      window.clearInterval(intervalId);
    };
  }, [period, refreshLeaderboard]);

  useEffect(() => {
    const updateCountdown = () =>
      setDailyCountdown(getResetCountdown(leaderboard.resetAt));
    updateCountdown();
    const countdownId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(countdownId);
  }, [leaderboard.resetAt]);

  useEffect(() => {
    setProfile(readCachedGameProfile());
    const handleProfileReady = (event: Event) => {
      const nextProfile = (event as CustomEvent<CachedGameProfile>).detail;
      if (nextProfile?.profileId) {
        setProfile(nextProfile);
      }
    };
    window.addEventListener(PROFILE_READY_EVENT, handleProfileReady);
    return () =>
      window.removeEventListener(PROFILE_READY_EVENT, handleProfileReady);
  }, []);

  useEffect(() => {
    setLiveRefreshNotice(null);
    if (!profile?.profileId) {
      setLastManualRefreshAt(null);
      setLiveRefreshReadyAt(0);
      setLiveRefreshLimitResetAt(0);
      setLiveRefreshUsageCount(0);
      return;
    }
    const stored = Number(
      window.localStorage.getItem(
        liveRefreshStorageKey(period, profile.profileId),
      ) || 0,
    );
    const refreshedAt = Number.isFinite(stored) && stored > 0 ? stored : null;
    const storedUsageCount = readLiveRefreshUsage(period, profile.profileId);
    const storedLimitResetAt = Number(
      window.localStorage.getItem(
        liveRefreshLimitStorageKey(period, profile.profileId),
      ) || 0,
    );
    const limitResetAt =
      Number.isFinite(storedLimitResetAt) && storedLimitResetAt > Date.now()
        ? storedLimitResetAt
        : 0;
    setLastManualRefreshAt(refreshedAt);
    setLiveRefreshUsageCount(
      Math.max(storedUsageCount, refreshedAt ? 1 : 0),
    );
    const readyAt = refreshedAt
      ? refreshedAt + LIVE_REFRESH_COOLDOWN_MS
      : 0;
    setLiveRefreshLimitResetAt(limitResetAt);
    setLiveRefreshReadyAt(
      limitResetAt === 0 && readyAt > Date.now() ? readyAt : 0,
    );
  }, [period, profile?.profileId]);

  useEffect(() => {
    const remaining = liveRefreshReadyAt - Date.now();
    if (remaining <= 0) return;
    const timeoutId = window.setTimeout(
      () => setLiveRefreshReadyAt(0),
      remaining + 50,
    );
    return () => window.clearTimeout(timeoutId);
  }, [liveRefreshReadyAt]);

  useEffect(() => {
    const remaining = liveRefreshLimitResetAt - Date.now();
    if (remaining <= 0) return;
    const timeoutId = window.setTimeout(() => {
      setLiveRefreshLimitResetAt(0);
      if (profile?.profileId) {
        window.localStorage.removeItem(
          liveRefreshLimitStorageKey(period, profile.profileId),
        );
      }
    }, remaining + 50);
    return () => window.clearTimeout(timeoutId);
  }, [liveRefreshLimitResetAt, period, profile?.profileId]);

  useEffect(() => {
    const hasTimedRefreshState =
      liveRefreshReadyAt > Date.now() ||
      liveRefreshLimitResetAt > Date.now();
    if (!hasTimedRefreshState) {
      setRefreshClock(0);
      return;
    }

    setRefreshClock(Date.now());
    const intervalId = window.setInterval(
      () => setRefreshClock(Date.now()),
      1000,
    );
    return () => window.clearInterval(intervalId);
  }, [liveRefreshLimitResetAt, liveRefreshReadyAt]);

  useEffect(() => {
    if (!liveRefreshNotice) return;
    const timeoutId = window.setTimeout(
      () => setLiveRefreshNotice(null),
      5000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [liveRefreshNotice]);

  const handlePeriodChange = (nextPeriod: RankingPeriod) => {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
    setLeaderboard({ ...EMPTY_RESPONSE, period: nextPeriod });
    setSlotDirection(null);
    setIsFullRanking(false);
  };

  const displayedEntries = isFullRanking ? fullEntries : collapsedEntries;
  const isLiveRefreshLimited =
    refreshClock > 0 && liveRefreshLimitResetAt > refreshClock;
  const isLiveRefreshCoolingDown =
    refreshClock > 0 &&
    !isLiveRefreshLimited &&
    liveRefreshReadyAt > refreshClock;
  const refreshButtonLabel = isLiveRefreshLimited
    ? "12/12"
    : isLiveRefreshCoolingDown
      ? formatRefreshCountdown(liveRefreshReadyAt, refreshClock)
      : null;
  const refreshButtonTitle = isRefreshing
    ? "Refreshing live ranking…"
    : !profile?.profileId
      ? "Play a match to unlock live rankings"
      : isLiveRefreshLimited
        ? `Daily refresh limit: ${LIVE_REFRESH_DAILY_LIMIT}/${LIVE_REFRESH_DAILY_LIMIT} · Resets at ${formatRefreshTime(liveRefreshLimitResetAt)}`
        : isLiveRefreshCoolingDown
          ? `Daily refresh limit: ${liveRefreshUsageCount}/${LIVE_REFRESH_DAILY_LIMIT}`
          : lastManualRefreshAt
            ? `Refresh live ranking · Last used ${formatRefreshTime(lastManualRefreshAt)}`
            : "Refresh live ranking";

  return (
    <aside
      aria-label="Leaderboard"
      className={`leaderboard-panel h-full min-h-0 flex-col overflow-hidden rounded-tr-3xl bg-white/95 shadow-[0_12px_34px_rgba(21,128,61,0.13)] backdrop-blur-sm dark:bg-[#0d4021] dark:shadow-[0_12px_34px_rgba(0,0,0,0.28)] ${className}`}
    >
      <div className="leaderboard-header border-b border-green-100 px-3 py-2.5 dark:border-green-700/50">
        <div className="leaderboard-heading-row flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-base font-black uppercase tracking-tight text-gray-900 dark:text-white">
            <span aria-hidden="true" className="text-xl leading-none">
              🏆
            </span>
            Top players
          </div>

          <span
            className={`relative inline-flex shrink-0 ${
              isRefreshing
                ? "cursor-wait"
                : !profile?.profileId ||
                    isLiveRefreshCoolingDown ||
                    isLiveRefreshLimited
                  ? "cursor-not-allowed"
                  : ""
            }`}
            title={refreshButtonTitle}
          >
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={isRefreshing}
              aria-disabled={
                !profile?.profileId ||
                isLiveRefreshCoolingDown ||
                isLiveRefreshLimited
              }
              aria-label={refreshButtonTitle}
              className={`leaderboard-refresh inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border px-1.5 text-[9px] font-black tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 disabled:cursor-wait disabled:opacity-70 ${
                refreshButtonLabel
                  ? "min-w-[3.25rem] border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/45 dark:text-amber-200 dark:hover:bg-amber-900/60"
                  : "w-7 border-green-100 bg-green-50 text-green-700 hover:border-green-200 hover:bg-green-100 dark:border-green-700/60 dark:bg-green-900/50 dark:text-green-200 dark:hover:bg-green-800/70"
              } ${!profile?.profileId ? "opacity-60" : ""}`}
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {refreshButtonLabel && (
                <span aria-hidden="true">{refreshButtonLabel}</span>
              )}
            </button>
            {liveRefreshNotice && (
              <span
                role="status"
                aria-live="polite"
                className="absolute right-0 top-full z-30 mt-1.5 w-max max-w-[210px] rounded-md border border-green-100 bg-white px-2 py-1.5 text-right text-[9px] font-semibold leading-3 text-gray-600 shadow-lg dark:border-green-700 dark:bg-[#123d25] dark:text-gray-100"
              >
                {liveRefreshNotice}
              </span>
            )}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 rounded-lg bg-green-50 p-1 dark:bg-green-950/40">
          <button
            type="button"
            onClick={() => handlePeriodChange("daily")}
            className={`rounded-md px-1.5 py-1.5 text-[10px] font-bold transition ${
              period === "daily"
                ? "bg-white text-green-700 shadow-sm dark:bg-green-700 dark:text-white"
                : "text-gray-500 hover:text-green-700 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => handlePeriodChange("allTime")}
            className={`rounded-md px-1.5 py-1.5 text-[10px] font-bold transition ${
              period === "allTime"
                ? "bg-white text-green-700 shadow-sm dark:bg-green-700 dark:text-white"
                : "text-gray-500 hover:text-green-700 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            All-time
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-green-100 bg-green-50/70 px-3 py-2 text-[9px] text-gray-500 dark:border-green-700/50 dark:bg-green-950/25 dark:text-gray-300">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3 text-green-600 dark:text-green-300" />
          {period === "daily" ? (
            <time
              aria-label={`Time until the daily leaderboard resets: ${dailyCountdown}`}
              title={`Daily leaderboard resets at 00:00 ${SITE_TIME_ZONE}`}
              className="font-bold tabular-nums tracking-[0.06em] text-gray-700 dark:text-gray-100"
            >
              {dailyCountdown}
            </time>
          ) : (
            <span className="font-semibold text-gray-700 dark:text-gray-100">
              All seasons
            </span>
          )}
        </span>
        <span className="leaderboard-wins w-8 shrink-0 text-center font-black uppercase tracking-[0.08em] text-green-700 dark:text-green-300">
          {competitionMetricLabel()}
        </span>
      </div>

      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        {isFullRanking && (
          <div className="flex h-6 shrink-0 items-center justify-center border-b border-green-100 bg-green-50/45 dark:border-green-700/50 dark:bg-green-950/20">
            <button
              type="button"
              onClick={() => setIsFullRanking(false)}
              aria-label="Collapse full leaderboard"
              title="Collapse full leaderboard"
              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[8px] font-bold text-green-600 transition hover:bg-green-100 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 dark:text-green-300 dark:hover:bg-green-800/50 dark:hover:text-white"
            >
              <ChevronUp className="h-2.5 w-2.5" aria-hidden="true" />
              Collapse
            </button>
          </div>
        )}

        <ol
          className={`relative flex min-h-0 flex-1 flex-col ${
            isFullRanking
              ? "leaderboard-ranking-scrollbar overflow-y-scroll overscroll-contain"
              : "overflow-hidden"
          }`}
        >
          {displayedEntries.length === 0 && (
            <li className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-[10px] font-semibold text-gray-400 dark:text-gray-300">
              {isRefreshing ? "Loading leaderboard…" : "No matches yet"}
            </li>
          )}
          {displayedEntries.map(
            (entry, slotIndex) => {
              const isNeighborSlot =
                !isFullRanking &&
                Boolean(leaderboard.currentPlayer) &&
                Math.abs(
                  entry.rank - (leaderboard.currentPlayer?.rank || 0),
                ) === 1;
              const isLastSlot =
                entry.rank === leaderboard.totalPlayers &&
                leaderboard.totalPlayers > 0;
              const isPreviousDayZeroWin =
                period === "daily" &&
                competitionMetricValue(entry) === 0 &&
                Boolean(entry.previousDayRank);
              const animationClass =
                isNeighborSlot && slotDirection
                  ? slotDirection === "up"
                    ? "leaderboard-slot-up"
                    : "leaderboard-slot-down"
                  : "";

              return (
                <li
                  key={
                    isFullRanking
                      ? `${period}-rank-${entry.rank}`
                      : `${period}-slot-${slotIndex}`
                  }
                  className={`leaderboard-row group relative flex items-center gap-2 overflow-hidden px-3 py-1.5 transition-colors hover:bg-green-50/90 dark:hover:bg-green-800/25 ${
                    isFullRanking
                      ? "h-10 shrink-0"
                      : "min-h-0 flex-1"
                  } ${
                    slotIndex > 0
                      ? "border-t border-green-50 dark:border-green-800/45"
                      : ""
                  } ${
                    isLastSlot
                      ? "border-t border-dashed border-green-200 dark:border-green-700/70"
                      : ""
                  } ${
                    entry.isCurrentUser
                      ? "before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[2px] before:rounded-full before:bg-green-500 dark:before:bg-green-400"
                      : ""
                  }`}
                >
                  <div
                    key={
                      isNeighborSlot
                        ? `${period}-${slotIndex}-${refreshCount}`
                        : `${period}-${slotIndex}`
                    }
                    className={`leaderboard-row-content flex min-w-0 flex-1 items-center gap-2 ${
                      animationClass
                    } ${
                      entry.isCurrentUser && refreshCount > 1
                        ? "leaderboard-self-flash"
                        : ""
                    }`}
                  >
                    <RankBadge
                      rank={entry.rank}
                      isLast={isLastSlot}
                      isPreviousDayZeroWin={isPreviousDayZeroWin}
                    />

                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <p
                        title={entry.name}
                        className={`leaderboard-name min-w-0 max-w-[84px] truncate text-xs font-bold ${
                          entry.isCurrentUser
                            ? "text-green-700 dark:text-green-200"
                            : "text-gray-800 dark:text-gray-100"
                        }`}
                      >
                        {entry.name}
                      </p>
                      {period === "daily" && entry.previousDayRank && (
                        <PreviousDayMedal
                          rank={entry.previousDayRank}
                          previousPeriodMetric={competitionPreviousPeriodMetric(
                            entry,
                          )}
                        />
                      )}
                      {period === "allTime" && (
                        <HistoricalMedalTotal medals={entry.medals} />
                      )}
                      {entry.isCurrentUser && (
                        <span className="leaderboard-you-badge rounded bg-green-600 px-1 py-px text-[7px] font-black leading-none text-white">
                          YOU
                        </span>
                      )}
                    </div>

                    <CountryFlag country={entry.country} />

                    <span className="leaderboard-wins w-8 shrink-0 text-center text-xs font-black tabular-nums text-gray-900 dark:text-white">
                      {competitionMetricValue(entry)}
                    </span>
                  </div>
                </li>
              );
            },
          )}

          {!isFullRanking && fullEntries.length > collapsedEntries.length && (
            <button
              type="button"
              onClick={() => setIsFullRanking(true)}
              aria-label="View full leaderboard"
              title="View full leaderboard"
              className="absolute left-1/2 top-[85.714%] z-10 inline-flex h-5 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-green-100 bg-white px-2 text-[9px] font-black tracking-[0.18em] text-green-500 shadow-sm transition hover:border-green-300 hover:bg-green-50 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 dark:border-green-700 dark:bg-[#0d4021] dark:text-green-300 dark:hover:bg-green-800/70"
            >
              •••
            </button>
          )}
        </ol>
      </div>

      <div className="flex h-11 shrink-0 items-center justify-center gap-1.5 border-t border-green-100 px-3 text-center text-[8px] font-semibold leading-3 text-gray-400 dark:border-green-700/50 dark:text-gray-400">
        <Clock3 className="h-3 w-3 shrink-0 text-green-600 dark:text-green-300" />
        {period === "daily"
          ? "Auto-refreshes every 3 hours"
          : "Auto-refreshes every 24 hours"}
      </div>
    </aside>
  );
}

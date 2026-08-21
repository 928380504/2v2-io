import { DATA_PROVIDER } from "@/config/data-provider";

export type CompetitionBadgeTone =
  | "live"
  | "silver"
  | "green"
  | "blue"
  | "purple"
  | "gold";

export type CompetitionMessageTone =
  | "default"
  | "winner"
  | "loser"
  | "highlight"
  | "silver"
  | "green"
  | "blue"
  | "purple"
  | "gold";

export interface CompetitionMessageSegment {
  text: string;
  tone?: CompetitionMessageTone;
}

export interface CompetitionActivityItem {
  eventId: string;
  eventType: string;
  player: string;
  opponent: string | null;
  modeLabel: string | null;
  tier: CompetitionBadgeTone;
  achievementKey: string | null;
  achievementLabel: string | null;
  achievementValue: number | null;
  countryCode: string;
  occurredAt: number;
}

export interface CompetitionActivityResponse {
  ok: boolean;
  day: string;
  generatedAt: number;
  items: CompetitionActivityItem[];
}

export interface CompetitionFeedMessage {
  id: string;
  badge: string;
  badgeTone: CompetitionBadgeTone;
  segments: CompetitionMessageSegment[];
  time: string;
}

type CompetitionMetricSource = Record<string, unknown>;

function finiteMetric(value: unknown) {
  const metric = Number(value);
  return Number.isFinite(metric) ? Math.max(0, metric) : 0;
}

export function isCompetitionMode(mode: unknown): mode is string {
  return mode === DATA_PROVIDER.competition.mode;
}

export function competitionMetricValue(source: CompetitionMetricSource) {
  return finiteMetric(source[DATA_PROVIDER.competition.metricField]);
}

export function competitionPreviousPeriodMetric(
  source: CompetitionMetricSource,
) {
  return finiteMetric(
    source[DATA_PROVIDER.competition.previousPeriodMetricField],
  );
}

export function competitionMetricLabel() {
  return DATA_PROVIDER.competition.metricLabel;
}

export function formatPreviousPeriodMetric(value: number) {
  const noun = value === 1
    ? DATA_PROVIDER.competition.metricSingular
    : DATA_PROVIDER.competition.metricPlural;
  return `${value} ${noun} ${DATA_PROVIDER.competition.previousPeriodLabel}`;
}

export function previousPodiumPlaceholderLabel() {
  return DATA_PROVIDER.competition.previousPodiumPlaceholder;
}

function isBadgeTone(value: unknown): value is CompetitionBadgeTone {
  return value === "live" ||
    value === "silver" ||
    value === "green" ||
    value === "blue" ||
    value === "purple" ||
    value === "gold";
}

export function isCompetitionActivityResponse(
  value: unknown,
  expectedDay: string,
): value is CompetitionActivityResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<CompetitionActivityResponse>;
  const activity = DATA_PROVIDER.competition.activity;
  return (
    response.ok === true &&
    response.day === expectedDay &&
    typeof response.generatedAt === "number" &&
    Array.isArray(response.items) &&
    response.items.every((item) =>
      Boolean(item) &&
      typeof item.eventId === "string" &&
      (item.eventType === activity.resultType ||
        item.eventType === activity.streakType ||
        item.eventType === activity.rankingType) &&
      typeof item.player === "string" &&
      typeof item.occurredAt === "number" &&
      isBadgeTone(item.tier)
    )
  );
}

function achievementTone(
  tier: CompetitionBadgeTone,
): CompetitionMessageTone {
  return tier === "live" ? "highlight" : tier;
}

export function competitionWaitingMessage(): CompetitionFeedMessage {
  return {
    id: "waiting-for-competition-event",
    badge: DATA_PROVIDER.competition.activity.resultBadge,
    badgeTone: "live",
    segments: [{ text: DATA_PROVIDER.competition.activity.waitingText }],
    time: "Live updates",
  };
}

export function presentCompetitionActivity(
  item: CompetitionActivityItem,
  relativeTime: string,
): CompetitionFeedMessage {
  const activity = DATA_PROVIDER.competition.activity;

  if (item.eventType === activity.streakType) {
    return {
      id: item.eventId,
      badge: activity.streakBadge,
      badgeTone: item.tier,
      segments: [
        { text: item.player, tone: "winner" },
        {
          text: ` reached a ${item.achievementValue ?? 0}-${activity.streakNoun} — `,
        },
        {
          text: item.achievementLabel || activity.streakFallbackLabel,
          tone: achievementTone(item.tier),
        },
      ],
      time: relativeTime,
    };
  }

  if (item.eventType === activity.rankingType) {
    const rankText = item.achievementValue === 1
      ? " claimed Daily #1 — "
      : ` entered Daily Top ${item.achievementValue ?? 10} — `;
    return {
      id: item.eventId,
      badge: activity.rankingBadge,
      badgeTone: item.tier,
      segments: [
        { text: item.player, tone: "winner" },
        { text: rankText },
        {
          text: item.achievementLabel || activity.rankingFallbackLabel,
          tone: achievementTone(item.tier),
        },
      ],
      time: relativeTime,
    };
  }

  return {
    id: item.eventId,
    badge: activity.resultBadge,
    badgeTone: "live",
    segments: [
      { text: item.player, tone: "winner" },
      { text: ` ${activity.resultVerb} ` },
      { text: item.opponent || activity.defaultOpponent, tone: "loser" },
      { text: " in " },
      { text: item.modeLabel || activity.defaultModeLabel },
      ...(item.achievementKey === activity.revengeAchievementKey
        ? [{ text: ` — ${activity.revengeText}` }]
        : []),
    ],
    time: relativeTime,
  };
}

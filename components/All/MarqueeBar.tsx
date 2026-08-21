"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Clock3, History } from "lucide-react";
import {
  readLocalApiCache,
  writeLocalApiCache,
} from "@/lib/local-api-cache";
import { siteDayKey } from "@/lib/site-time";
import { fetchTicker } from "@/lib/data/game-data-client";
import { DATA_PROVIDER } from "@/config/data-provider";
import { SITE_RUNTIME } from "@/site/runtime";
import {
  competitionWaitingMessage,
  isCompetitionActivityResponse,
  presentCompetitionActivity,
  type CompetitionActivityItem as TickerItem,
  type CompetitionActivityResponse as TickerResponse,
  type CompetitionBadgeTone as BadgeTone,
  type CompetitionFeedMessage as MarqueeMessage,
  type CompetitionMessageTone as MessageTone,
} from "@/lib/data/competition-adapter";

interface MarqueeBarProps {
  messages?: MarqueeMessage[];
  rotateSeconds?: number;
  className?: string;
}

const TICKER_REFRESH_MS = DATA_PROVIDER.cache.tickerMs;
const TICKER_CACHE_KEY = SITE_RUNTIME.storage.ticker;
const TICKER_COLLAPSED_KEY = SITE_RUNTIME.storage.tickerCollapsed;
const waitingMessages: MarqueeMessage[] = [competitionWaitingMessage()];

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const badgeToneClasses: Record<BadgeTone, string> = {
  live:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  silver:
    "border-slate-300 bg-white text-slate-700 shadow-sm dark:border-slate-300/30 dark:bg-white/10 dark:text-slate-100",
  green:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-200",
  blue:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  purple:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-200",
  gold:
    "border-amber-300 bg-amber-50 text-amber-700 shadow-sm dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-200",
};

const segmentToneClasses: Record<MessageTone, string> = {
  default: "text-gray-700 dark:text-gray-100",
  winner: "font-extrabold text-red-600 dark:text-red-300",
  loser: "font-extrabold text-blue-600 dark:text-blue-300",
  highlight: "font-extrabold text-green-700 dark:text-green-300",
  silver: "font-extrabold text-slate-600 dark:text-slate-200",
  green: "font-extrabold text-green-600 dark:text-green-300",
  blue: "font-extrabold text-blue-600 dark:text-blue-300",
  purple: "font-extrabold text-purple-600 dark:text-purple-300",
  gold: "font-extrabold text-amber-600 dark:text-amber-300",
};

const timelineDotClasses: Record<BadgeTone, string> = {
  live: "bg-emerald-500",
  silver: "bg-slate-400",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  gold: "bg-amber-400",
};

export function MarqueeBar({
  messages,
  rotateSeconds = 6,
  className = "",
}: MarqueeBarProps) {
  const [remoteItems, setRemoteItems] = useState<TickerItem[]>([]);
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isToggleHovered, setIsToggleHovered] = useState(false);
  const [isToggleVisible, setIsToggleVisible] = useState(true);

  useEffect(() => {
    try {
      setIsCollapsed(window.localStorage.getItem(TICKER_COLLAPSED_KEY) === "1");
    } catch {
      // Keep the activity bar open when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (isToggleHovered) {
      setIsToggleVisible(true);
      return;
    }

    const hideId = window.setTimeout(() => setIsToggleVisible(false), 3_000);
    return () => window.clearTimeout(hideId);
  }, [isCollapsed, isToggleHovered]);

  useEffect(() => {
    if (messages) return;
    let active = true;
    const cached = readLocalApiCache(
      TICKER_CACHE_KEY,
      (value): value is TickerResponse =>
        isCompetitionActivityResponse(value, siteDayKey()),
    );
    if (cached) setRemoteItems(cached.items);

    const loadTicker = async () => {
      try {
        const result = await fetchTicker<unknown>(
          DATA_PROVIDER.limits.tickerItems,
        );
        if (
          !active ||
          !isCompetitionActivityResponse(result, siteDayKey())
        ) return;
        setRemoteItems(result.items);
        writeLocalApiCache(TICKER_CACHE_KEY, result);
      } catch {
        // Keep the last successful ticker response during a transient failure.
      }
    };

    void loadTicker();
    const refreshId = window.setInterval(loadTicker, TICKER_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(refreshId);
    };
  }, [messages]);

  useEffect(() => {
    const timeId = window.setInterval(
      () => setRelativeTimeTick((tick) => tick + 1),
      30_000,
    );
    return () => window.clearInterval(timeId);
  }, []);

  const items = useMemo(
    () =>
      messages?.length
        ? messages
        : remoteItems.length
          ? remoteItems.map((item) =>
              presentCompetitionActivity(item, relativeTime(item.occurredAt))
            )
          : waitingMessages,
    [messages, relativeTimeTick, remoteItems],
  );
  const recentItems = useMemo(() => items.slice(0, 20), [items]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1 || isTimelineOpen || isCollapsed) return;
    const id = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % items.length);
    }, rotateSeconds * 1000);
    return () => window.clearInterval(id);
  }, [isCollapsed, isTimelineOpen, items.length, rotateSeconds]);

  const activeMessage = items[activeIndex] ?? items[0];

  const collapseTicker = () => {
    setIsTimelineOpen(false);
    setIsCollapsed(true);
    setIsToggleVisible(true);
    try {
      window.localStorage.setItem(TICKER_COLLAPSED_KEY, "1");
    } catch {
      // The current view can still collapse without persistence.
    }
  };

  const expandTicker = () => {
    setIsCollapsed(false);
    setIsToggleVisible(true);
    try {
      window.localStorage.removeItem(TICKER_COLLAPSED_KEY);
    } catch {
      // The current view can still expand without persistence.
    }
  };

  return (
    <div
      className="relative z-40"
      onMouseEnter={() => {
        setIsToggleHovered(true);
        setIsToggleVisible(true);
      }}
      onMouseLeave={() => setIsToggleHovered(false)}
    >
      <div
        className={`relative z-40 transition-[max-height,transform,opacity] duration-300 ease-out ${
          isCollapsed
            ? "max-h-0 -translate-y-full overflow-hidden opacity-0"
            : "max-h-[30px] translate-y-0 overflow-visible opacity-100"
        }`}
      >
        <div
          className={`marquee-bar relative z-40 w-full border-b border-black/5 bg-white/70 backdrop-blur-sm dark:border-white/10 dark:bg-[#0d4021]/60 ${className}`}
        >
      <div className="site-container-width mx-auto px-2 sm:px-0">
        <div className="relative flex h-[30px] items-center overflow-hidden">
          <div
            key={activeMessage.id}
            className="marquee-track grid w-full grid-cols-[82px_minmax(0,1fr)_74px] items-center gap-2 sm:grid-cols-[110px_minmax(0,1fr)_108px] sm:gap-3"
          >
            <div className="flex h-full items-center justify-self-start">
              <span
                className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[9px] font-black tracking-[0.08em] sm:px-2.5 sm:text-[10px] ${badgeToneClasses[activeMessage.badgeTone]}`}
              >
                {activeMessage.badge}
              </span>
            </div>

            <p className="truncate text-center text-[11px] font-medium text-gray-700 dark:text-gray-100 sm:text-[13px]">
              {activeMessage.segments.map((segment, index) => (
                <span
                  key={`${activeMessage.id}-${index}`}
                  className={segmentToneClasses[segment.tone ?? "default"]}
                >
                  {segment.text}
                </span>
              ))}
            </p>

            <div className="flex items-center justify-self-end">
              <time className="whitespace-nowrap text-[9px] font-semibold tabular-nums text-gray-400 dark:text-gray-300 sm:text-[11px]">
                {activeMessage.time}
              </time>
              <button
                type="button"
                aria-expanded={isTimelineOpen}
                aria-controls="battle-report-timeline"
                aria-label={
                  isTimelineOpen ? "Collapse activity timeline" : "Open activity timeline"
                }
                title={
                  isTimelineOpen ? "Collapse activity timeline" : "View all activity"
                }
                onClick={() => setIsTimelineOpen((open) => !open)}
                className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-black/5 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-green-200 sm:ml-1.5"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition-transform duration-300 ${
                    isTimelineOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        id="battle-report-timeline"
        aria-hidden={!isTimelineOpen}
        className={`absolute inset-x-0 top-full z-50 grid bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-[grid-template-rows,opacity] duration-300 ease-out dark:bg-[#0a351b]/95 dark:shadow-[0_18px_40px_rgba(0,0,0,0.38)] ${
          isTimelineOpen
            ? "grid-rows-[1fr] border-t border-black/5 opacity-100 dark:border-white/10"
            : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="site-container-width mx-auto px-3 pb-3 pt-2.5 sm:px-0 sm:pb-4 sm:pt-3">
            <div className="mb-1.5 flex items-center justify-between px-0.5 sm:mb-2">
              <div className="flex items-center gap-1.5">
                <History
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-green-700 dark:text-green-300"
                />
                <h2 className="text-[11px] font-black tracking-wide text-gray-800 dark:text-gray-100 sm:text-xs">
                  Activity Timeline
                </h2>
              </div>
              <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-400 sm:text-[10px]">
                Latest {recentItems.length}
              </span>
            </div>

            <div className="timeline-scrollbar relative max-h-[320px] overflow-y-auto overscroll-contain pr-1 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-green-200 dark:before:bg-green-700/70 sm:max-h-[360px]">
              {recentItems.map((message) => (
                <article
                  key={message.id}
                  className="relative grid grid-cols-[74px_minmax(0,1fr)_58px] items-start gap-2 border-b border-black/5 py-2 pl-5 last:border-b-0 sm:grid-cols-[100px_minmax(0,1fr)_82px] sm:items-center sm:gap-3 sm:py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-[13px] h-[11px] w-[11px] rounded-full border-2 border-white shadow-sm dark:border-[#0a351b] sm:top-1/2 sm:-translate-y-1/2 ${timelineDotClasses[message.badgeTone]}`}
                  />

                  <span
                    className={`inline-flex w-fit max-w-full items-center rounded-full border px-2 py-0.5 text-[8px] font-black tracking-[0.06em] sm:px-2.5 sm:text-[9px] ${badgeToneClasses[message.badgeTone]}`}
                  >
                    {message.badge}
                  </span>

                  <p className="break-words text-[10px] font-medium leading-[15px] text-gray-700 dark:text-gray-100 sm:truncate sm:text-xs sm:leading-normal">
                    {message.segments.map((segment, segmentIndex) => (
                      <span
                        key={`${message.id}-${segmentIndex}`}
                        className={
                          segmentToneClasses[segment.tone ?? "default"]
                        }
                      >
                        {segment.text}
                      </span>
                    ))}
                  </p>

                  <time className="justify-self-end whitespace-nowrap text-[8px] font-semibold tabular-nums text-gray-400 dark:text-gray-400 sm:text-[10px]">
                    {message.time}
                  </time>
                </article>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-center gap-1.5 border-t border-black/5 pt-2 text-center text-[9px] font-semibold text-gray-400 dark:border-white/10 dark:text-gray-400 sm:text-[10px]">
              <Clock3
                aria-hidden="true"
                className="h-3 w-3 shrink-0 text-green-600 dark:text-green-300"
              />
              Updates every 15 minutes
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="site-container-width relative mx-auto">
          <button
            type="button"
            aria-label={isCollapsed ? "Show activity bar" : "Hide activity bar"}
            title={isCollapsed ? "Show activity bar" : "Hide activity bar"}
            onClick={isCollapsed ? expandTicker : collapseTicker}
            onFocus={() => setIsToggleVisible(true)}
            className={`pointer-events-auto absolute right-2 inline-flex h-5 w-8 items-center justify-center border border-green-200 bg-white/95 text-green-700 shadow-sm transition-[top,opacity,background-color,color,border-color] duration-300 hover:bg-green-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 dark:border-green-700 dark:bg-[#0d4021] dark:text-green-200 dark:hover:bg-green-800 min-[1200px]:left-full min-[1200px]:right-auto min-[1200px]:ml-1 min-[1200px]:w-5 min-[1200px]:rounded-md min-[1200px]:border-t ${
              isToggleVisible ? "opacity-100" : "opacity-0"
            } ${
              isCollapsed
                ? "top-0 rounded-b-md border-t-0"
                : "top-[30px] -translate-y-px rounded-b-md border-t-0"
            }`}
          >
            {isCollapsed ? (
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

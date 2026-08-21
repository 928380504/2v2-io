"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  CornerUpLeft,
  MessageSquare,
  Star,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  normalizeComparableComment,
  validateCommentText,
} from "@/lib/comment-moderation";
import {
  syncLocalCommentRatings,
  syncRemoteCommentRating,
} from "@/lib/game-rating-store";
import { getSiteVisitorId } from "@/lib/site-visitor";
import {
  fetchComments,
  reactToComment as saveCommentReaction,
  submitComment as createComment,
} from "@/lib/data/game-data-client";
import { SITE_RUNTIME } from "@/site/runtime";

interface PublicComment {
  id: string;
  gameId: string;
  parentId: string | null;
  author: string;
  content: string;
  rating: number | null;
  likes: number;
  dislikes: number;
  countryCode: string;
  createdAt: number;
  userReaction: "like" | "dislike" | null;
}

interface RatingSummary {
  score: number;
  votes: number;
}

interface CommentListResponse {
  ok: boolean;
  items: PublicComment[];
  nextOffset: number;
  hasMore: boolean;
  totalComments: number;
  ratingSummary: RatingSummary;
}

interface CommentSubmitResponse {
  ok: boolean;
  item: PublicComment;
  totalComments: number;
  ratingSummary: RatingSummary;
}

interface ReactionResponse {
  ok: boolean;
  commentId: string;
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
}

type CommentSort = "newest" | "oldest" | "popular";

const COMMENTS_PER_PAGE = 5;
const REACTION_NUDGE_THRESHOLD = 5;
const REACTION_NUDGE_WINDOW_MS = 5000;
const REACTION_NUDGE_COOLDOWN_MS = 20000;
const COMMENT_NUDGE_EVENT = SITE_RUNTIME.events.commentNudge;
const RATING_MOOD_LABELS: Record<number, { label: string; helper: string }> = {
  1: {
    label: "Not my vibe",
    helper: "Something felt really off. Tell us what made it frustrating.",
  },
  2: {
    label: "Kinda rough",
    helper: "A bit unhappy? Share what got in the way.",
  },
  3: {
    label: "It's okay",
    helper: "Right in the middle. What worked, and what did not?",
  },
  4: {
    label: "Pretty fun",
    helper: "Sounds like a good run. What made it click?",
  },
  5: {
    label: "Loved it",
    helper: "You had a blast. Drop a quick highlight.",
  },
};
const COMMENT_MOOD_CHIPS = [
  { emoji: "\u{1F600}", label: "Fun" },
  { emoji: "\u{1F525}", label: "Intense" },
  { emoji: "\u{1F3AF}", label: "Challenging" },
  { emoji: "\u{1F624}", label: "Frustrating" },
  { emoji: "\u{1F914}", label: "Confusing" },
  { emoji: "\u{1F60E}", label: "Cool" },
  { emoji: "\u{2764}\u{FE0F}", label: "Loved it" },
] as const;

interface GameCommentsProps {
  gameId: string;
  gameTitle: string;
}

function formatCommentDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function mergeComments(
  currentComments: PublicComment[],
  incomingComments: PublicComment[],
) {
  const comments = new Map(
    currentComments.map((comment) => [comment.id, comment]),
  );
  incomingComments.forEach((comment) => comments.set(comment.id, comment));
  return Array.from(comments.values());
}

export function GameComments({ gameId, gameTitle }: GameCommentsProps) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [sortOrder, setSortOrder] = useState<CommentSort>("newest");
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalComments, setTotalComments] = useState(0);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);
  const commentFormRef = useRef<HTMLFormElement>(null);
  const commentTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const reactionStreakRef = useRef({
    count: 0,
    startedAt: 0,
    lastNudgedAt: 0,
  });
  const reactionUploadAtRef = useRef(new Map<string, number>());
  const previewRating = hoveredRating || selectedRating;
  const activeMood = previewRating > 0 ? RATING_MOOD_LABELS[previewRating] : null;
  const commentBoxUnlocked = replyingToId !== null || selectedRating > 0;

  const sortedComments = useMemo(() => {
    return [...comments].sort((first, second) => {
      if (sortOrder === "oldest") {
        return first.createdAt - second.createdAt;
      }
      if (sortOrder === "popular") {
        return (
          (second.likes - second.dislikes) -
            (first.likes - first.dislikes) ||
          second.createdAt - first.createdAt
        );
      }
      return second.createdAt - first.createdAt;
    });
  }, [comments, sortOrder]);

  const commentChildren = useMemo(() => {
    const children = new Map<string, PublicComment[]>();
    sortedComments.forEach((comment) => {
      if (!comment.parentId) return;
      const siblings = children.get(comment.parentId) || [];
      siblings.push(comment);
      children.set(comment.parentId, siblings);
    });
    return children;
  }, [sortedComments]);

  const commentIds = useMemo(
    () => new Set(comments.map((comment) => comment.id)),
    [comments],
  );
  const visibleComments = sortedComments.filter(
    (comment) => !comment.parentId || !commentIds.has(comment.parentId),
  );
  const replyingToComment = comments.find(
    (comment) => comment.id === replyingToId,
  );

  useEffect(() => {
    let active = true;
    const loadInitialComments = async () => {
      setIsLoading(true);
      setLoadError(null);
      setReplyingToId(null);
      try {
        const visitorId = getSiteVisitorId();
        const result = await fetchComments<CommentListResponse>({
          gameId,
          visitorId,
          sort: sortOrder,
          limit: COMMENTS_PER_PAGE,
          offset: 0,
        }, "Comments are temporarily unavailable.");
        if (!active) return;
        setComments(Array.isArray(result.items) ? result.items : []);
        setNextOffset(Number(result.nextOffset) || 0);
        setHasMore(Boolean(result.hasMore));
        setTotalComments(Number(result.totalComments) || 0);
        syncLocalCommentRatings(gameId, []);
        syncRemoteCommentRating(gameId, result.ratingSummary);
      } catch (error) {
        if (!active) return;
        setComments([]);
        setNextOffset(0);
        setHasMore(false);
        setTotalComments(0);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Comments are temporarily unavailable.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadInitialComments();
    return () => {
      active = false;
    };
  }, [gameId, sortOrder]);

  const handleRatingSelect = (ratingValue: number) => {
    setSelectedRating(ratingValue);
    setHoveredRating(0);
    setSubmissionError(null);
    window.requestAnimationFrame(() => {
      commentTextAreaRef.current?.focus({ preventScroll: true });
    });
  };

  const insertMoodChip = (chip: (typeof COMMENT_MOOD_CHIPS)[number]) => {
    const textarea = commentTextAreaRef.current;
    if (!textarea) return;

    const insertion = `${chip.emoji} ${chip.label}`;
    const currentValue = textarea.value;
    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;
    const separatorBefore =
      currentValue.length === 0 || currentValue.slice(0, start).endsWith(" ")
        ? ""
        : " ";
    const separatorAfter =
      currentValue.slice(end).startsWith(" ") || end === currentValue.length
        ? ""
        : " ";
    const nextValue = `${currentValue.slice(0, start)}${separatorBefore}${insertion}${separatorAfter}${currentValue.slice(end)}`;
    const nextCursor = start + separatorBefore.length + insertion.length;

    textarea.value = nextValue;
    textarea.focus();
    textarea.setSelectionRange(nextCursor, nextCursor);
    setSubmissionError(null);
  };

  const loadMoreComments = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const result = await fetchComments<CommentListResponse>({
        gameId,
        visitorId: getSiteVisitorId(),
        sort: sortOrder,
        limit: COMMENTS_PER_PAGE,
        offset: nextOffset,
      }, "More comments could not be loaded.");
      setComments((current) => mergeComments(current, result.items || []));
      setNextOffset(Number(result.nextOffset) || nextOffset);
      setHasMore(Boolean(result.hasMore));
      setTotalComments(Number(result.totalComments) || 0);
      syncRemoteCommentRating(gameId, result.ratingSummary);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "More comments could not be loaded.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const author = String(formData.get("comment_author") || "").trim();
    const content = String(formData.get("comment_content") || "").trim();
    const acceptedTerms = formData.get("comment_terms") === "on";

    if (!author || !content || !acceptedTerms) return;
    if (!replyingToId && selectedRating < 1) {
      setSubmissionError("Please select a rating before submitting your comment.");
      return;
    }

    const moderationError = validateCommentText(author, content);
    if (moderationError) {
      setSubmissionError(moderationError);
      return;
    }

    const comparableContent = normalizeComparableComment(content);
    if (
      comparableContent &&
      comments.some(
        (comment) =>
          normalizeComparableComment(comment.content) === comparableContent,
      )
    ) {
      setSubmissionError("Please do not post the same comment repeatedly.");
      return;
    }

    const submitButton = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (submitButton) submitButton.disabled = true;

    try {
      const result = await createComment<CommentSubmitResponse>({
        visitorId: getSiteVisitorId(),
        gameId,
        parentId: replyingToId,
        author,
        content,
        rating: replyingToId ? null : selectedRating,
      });
      setComments((current) => mergeComments(current, [result.item]));
      setTotalComments(Number(result.totalComments) || totalComments + 1);
      syncRemoteCommentRating(gameId, result.ratingSummary);
      form.reset();
      setSelectedRating(0);
      setReplyingToId(null);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "The comment could not be submitted.",
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };

  const reactToComment = async (
    commentId: string,
    reaction: "like" | "dislike",
    interactionTime: number,
  ) => {
    const now = interactionTime;
    const currentStreak = reactionStreakRef.current;
    const isFreshStreak =
      currentStreak.startedAt > 0 &&
      now - currentStreak.startedAt <= REACTION_NUDGE_WINDOW_MS;
    const nextCount = isFreshStreak ? currentStreak.count + 1 : 1;

    reactionStreakRef.current = {
      ...currentStreak,
      count: nextCount,
      startedAt: isFreshStreak ? currentStreak.startedAt : now,
    };

    if (
      nextCount >= REACTION_NUDGE_THRESHOLD &&
      now - currentStreak.lastNudgedAt > REACTION_NUDGE_COOLDOWN_MS
    ) {
      reactionStreakRef.current = {
        count: 0,
        startedAt: 0,
        lastNudgedAt: now,
      };
      window.dispatchEvent(
        new CustomEvent(COMMENT_NUDGE_EVENT, {
          detail: { reaction, firedAt: now },
        }),
      );
      window.navigator.vibrate?.(12);
    }

    const lastUploadAt = reactionUploadAtRef.current.get(commentId) || 0;
    if (
      reactingCommentId ||
      (lastUploadAt > 0 && now - lastUploadAt < REACTION_NUDGE_WINDOW_MS)
    ) return;
    reactionUploadAtRef.current.set(commentId, now);
    setReactingCommentId(commentId);
    setLoadError(null);
    try {
      const result = await saveCommentReaction<ReactionResponse>(
        commentId,
        getSiteVisitorId(),
        reaction,
      );
      setComments((current) =>
        current.map((comment) =>
          comment.id === result.commentId
            ? {
                ...comment,
                likes: result.likes,
                dislikes: result.dislikes,
                userReaction: result.userReaction,
              }
            : comment,
        ),
      );
    } catch (error) {
      reactionUploadAtRef.current.delete(commentId);
      setLoadError(
        error instanceof Error
          ? error.message
          : "The reaction could not be saved.",
      );
    } finally {
      setReactingCommentId(null);
    }
  };

  const handleReply = (commentId: string) => {
    setReplyingToId(commentId);
    setSelectedRating(0);
    setSubmissionError(null);
    window.requestAnimationFrame(() => {
      commentFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      commentFormRef.current
        ?.querySelector<HTMLTextAreaElement>('textarea[name="comment_content"]')
        ?.focus();
    });
  };

  const renderComment = (comment: PublicComment, depth = 0): ReactNode => {
    const parentComment = comment.parentId
      ? comments.find((candidate) => candidate.id === comment.parentId)
      : undefined;
    const children = commentChildren.get(comment.id) || [];
    const isReacting = reactingCommentId === comment.id;

    return (
      <div
        key={comment.id}
        className={
          depth > 0
            ? "mt-3 border-l-2 border-green-200 pl-3 dark:border-green-700/50 sm:pl-5"
            : ""
        }
      >
        <article className="rounded-xl border border-green-100 bg-green-50/50 p-4 dark:border-green-700/35 dark:bg-green-950/25">
          <header className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-600 text-sm font-black uppercase text-white">
              {comment.author.charAt(0) || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                {comment.author}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                {formatCommentDate(comment.createdAt)}
              </p>
            </div>
          </header>

          {parentComment && (
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-300">
              <CornerUpLeft className="h-3.5 w-3.5" />
              Replying to {parentComment.author}
            </p>
          )}

          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-200">
            {comment.content}
          </p>

          <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-300">
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-disabled={isReacting}
                aria-pressed={comment.userReaction === "like"}
                onClick={(event) =>
                  void reactToComment(comment.id, "like", event.timeStamp)
                }
                className={`inline-flex items-center gap-1 transition active:scale-95 hover:text-green-700 dark:hover:text-green-300 ${
                  comment.userReaction === "like"
                    ? "font-bold text-green-700 dark:text-green-300"
                    : ""
                } ${
                  isReacting ? "opacity-60" : ""
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> {comment.likes}
              </button>
              <button
                type="button"
                aria-disabled={isReacting}
                aria-pressed={comment.userReaction === "dislike"}
                onClick={(event) =>
                  void reactToComment(comment.id, "dislike", event.timeStamp)
                }
                className={`inline-flex items-center gap-1 transition active:scale-95 hover:text-red-600 ${
                  comment.userReaction === "dislike"
                    ? "font-bold text-red-600 dark:text-red-300"
                    : ""
                } ${
                  isReacting ? "opacity-60" : ""
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> {comment.dislikes}
              </button>
              <button
                type="button"
                onClick={() => handleReply(comment.id)}
                className="inline-flex items-center gap-1 font-semibold hover:text-green-700 dark:hover:text-green-300"
              >
                <CornerUpLeft className="h-3.5 w-3.5" /> Reply
              </button>
            </div>

            {typeof comment.rating === "number" && comment.rating > 0 && (
              <div
                className="ml-auto flex items-center gap-0.5 text-[10px]"
                aria-label={`${comment.rating} out of 5 stars`}
              >
                {[1, 2, 3, 4, 5].map((ratingValue) => (
                  <Star
                    key={ratingValue}
                    aria-hidden="true"
                    className={`h-3 w-3 ${
                      comment.rating! >= ratingValue
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-gray-300 dark:text-gray-600"
                    }`}
                  />
                ))}
                <span className="ml-0.5 font-bold text-gray-600 dark:text-gray-300">
                  {comment.rating.toFixed(1)}
                </span>
              </div>
            )}
          </footer>
        </article>

        {children.map((child) => renderComment(child, depth + 1))}
      </div>
    );
  };

  return (
    <div id="comments_area">
      <form
        ref={commentFormRef}
        onSubmit={handleSubmit}
        onChange={() => submissionError && setSubmissionError(null)}
        className="mb-7 space-y-4"
      >
        <h2 className="mb-4 flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
          <span className="h-6 w-1 rounded-full bg-green-600 dark:bg-green-400" />
          Leave a Comment
        </h2>

        {!replyingToId && (
          <fieldset className="rounded-2xl border border-green-100 bg-green-50/55 p-4 dark:border-green-700/40 dark:bg-green-950/25">
            <legend className="px-1 text-sm font-black text-gray-900 dark:text-white">
              How did this game feel?
            </legend>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-300">
              Hover the stars to preview your mood. Pick one to unlock the comment box.
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="min-w-0"
                onPointerLeave={() => setHoveredRating(0)}
              >
                <div
                  className="relative w-fit rounded-xl bg-white/80 px-2 py-1.5 shadow-sm ring-1 ring-green-100 dark:bg-green-950/25 dark:ring-green-700/40"
                  role="radiogroup"
                  aria-label={`Rate ${gameTitle}`}
                >
                  <div className="pointer-events-none absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-green-100 dark:bg-green-900">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-lime-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${(previewRating / 5) * 100}%` }}
                    />
                  </div>
                  <div className="relative z-10 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((ratingValue) => {
                      const mood = RATING_MOOD_LABELS[ratingValue];

                      return (
                        <label
                          key={ratingValue}
                          className="cursor-pointer rounded-lg p-1 transition hover:scale-110 focus-within:ring-2 focus-within:ring-amber-400"
                          title={`${ratingValue} star${ratingValue > 1 ? "s" : ""}: ${mood.label}`}
                          onPointerEnter={() => setHoveredRating(ratingValue)}
                          onFocus={() => setHoveredRating(ratingValue)}
                          onBlur={() => setHoveredRating(0)}
                        >
                          <input
                            type="radio"
                            name="comment_rating"
                            value={ratingValue}
                            required
                            checked={selectedRating === ratingValue}
                            onChange={() => handleRatingSelect(ratingValue)}
                            className="sr-only"
                          />
                          <Star
                            className={`h-8 w-8 transition-all duration-300 ${
                              previewRating >= ratingValue
                                ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                                : "fill-transparent text-gray-300 dark:text-gray-500"
                            }`}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div
                className="min-w-0 rounded-xl bg-green-100/65 px-3 py-2 text-sm shadow-sm ring-1 ring-green-200/70 dark:bg-green-900/40 dark:ring-green-700/50 sm:min-w-[210px]"
                aria-live="polite"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-black text-gray-900 dark:text-white">
                    {activeMood?.label ?? "Pick a mood"}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-300">
                    {previewRating > 0 ? `${previewRating}.0 / 5` : "-"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-300">
                  {activeMood?.helper ?? "Your feeling sets the tone before you write."}
                </p>
              </div>
            </div>
          </fieldset>
        )}

        {replyingToComment && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-700/40 dark:bg-green-950/35 dark:text-green-200">
            <span className="min-w-0 truncate">
              Replying to <strong>{replyingToComment.author}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyingToId(null)}
              aria-label="Cancel reply"
              title="Cancel reply"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-green-100 dark:hover:bg-green-800/50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!commentBoxUnlocked && (
          <div className="rounded-xl border border-dashed border-green-200 bg-green-50/50 px-4 py-4 text-center text-sm font-semibold text-gray-500 dark:border-green-700/40 dark:bg-green-950/25 dark:text-gray-300">
            Pick a mood above, then the comment box opens here.
          </div>
        )}

        {commentBoxUnlocked && (
          <div className="comment-form-expand space-y-4">
            <input
              type="text"
              name="comment_author"
              required
              maxLength={40}
              autoComplete="name"
              className="w-full rounded-xl border border-green-100 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-green-700/40 dark:bg-green-950/30 dark:text-white"
              placeholder="Your name"
            />
            <div className="rounded-xl border border-green-100 bg-white transition focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20 dark:border-green-700/40 dark:bg-green-950/30">
              <textarea
                ref={commentTextAreaRef}
                name="comment_content"
                required
                maxLength={1000}
                rows={4}
                className="block w-full resize-y rounded-t-xl border-0 bg-transparent px-4 py-3 text-sm text-gray-900 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 dark:text-white"
                placeholder="Write a comment"
              />
              <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1">
                {COMMENT_MOOD_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => insertMoodChip(chip)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:-translate-y-0.5 hover:bg-green-100 hover:text-green-800 active:scale-95 dark:bg-green-900/45 dark:text-gray-200 dark:hover:bg-green-800/60"
                  >
                    <span aria-hidden="true">{chip.emoji}</span>
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {submissionError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-800/60 dark:bg-red-950/35 dark:text-red-200"
          >
            {submissionError}
          </p>
        )}

        {commentBoxUnlocked && (
          <div className="comment-form-expand flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                name="comment_terms"
                required
                className="mt-1 shrink-0 accent-green-600"
              />
              I agree to the Terms of Service.
            </label>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              <MessageSquare className="h-4 w-4" />
              Submit comment
            </button>
          </div>
        )}
      </form>

      <div className="flex items-center justify-between gap-4 pb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
          Comments{" "}
          <span className="text-base font-semibold text-gray-500 dark:text-gray-300">
            ({totalComments})
          </span>
        </h2>

        <label className="relative shrink-0">
          <span className="sr-only">Sort comments</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as CommentSort)}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
            className="h-9 rounded-lg border border-green-100 bg-white py-0 pl-3 pr-8 text-xs font-bold text-gray-700 outline-none transition hover:border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-green-700/40 dark:bg-green-950/30 dark:text-gray-100"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Popular</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500 dark:text-gray-300"
          />
        </label>
      </div>

      <div className="border-t border-green-100 pt-5 dark:border-green-700/40">
        {loadError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-800/60 dark:bg-red-950/35 dark:text-red-200"
          >
            {loadError}
          </p>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-green-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-green-700/40 dark:text-gray-300">
            Loading comments...
          </div>
        ) : totalComments === 0 && !loadError ? (
          <div className="rounded-xl border border-dashed border-green-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-green-700/40 dark:text-gray-300">
            No comments yet. Be the first to comment.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleComments.map((comment) => renderComment(comment))}

            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => void loadMoreComments()}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-green-200 bg-white px-5 py-2 text-sm font-bold text-green-700 transition hover:border-green-400 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 disabled:cursor-wait disabled:opacity-60 dark:border-green-700/50 dark:bg-green-950/25 dark:text-green-200 dark:hover:bg-green-900/40"
                >
                  {isLoadingMore ? "Loading..." : "Load more 5 comments"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

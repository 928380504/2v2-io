"use client";

import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { SITE_RUNTIME } from "@/site/runtime";

interface GameArticleNavProps {
  hasVideo?: boolean;
  hasSimilarGames?: boolean;
  hasComments?: boolean;
}

const COMMENT_NUDGE_EVENT = SITE_RUNTIME.events.commentNudge;
const COMMENT_NUDGE_DURATION_MS = 2600;

export function GameArticleNav({
  hasVideo = false,
  hasSimilarGames = false,
  hasComments = true,
}: GameArticleNavProps) {
  const [commentNudge, setCommentNudge] = useState<"like" | "dislike" | null>(
    null,
  );
  const [commentNudgeToken, setCommentNudgeToken] = useState(0);
  const links = [
    { label: "Introduction", href: "#game-introduction", visible: true },
    { label: "Gameplay", href: "#gameplay", visible: true },
    { label: "Controls", href: "#game-controls", visible: true },
    { label: "Video", href: "#game-video", visible: hasVideo },
    { label: "FAQ", href: "#game-faq", visible: true },
    {
      label: "Similar Games",
      href: "#similar-games",
      visible: hasSimilarGames,
    },
    { label: "Comments", href: "#game-comments", visible: hasComments },
  ].filter((link) => link.visible);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleCommentNudge = (event: Event) => {
      const detail = (event as CustomEvent<{
        reaction?: "like" | "dislike";
        firedAt?: number;
      }>).detail;
      const reaction = detail?.reaction;

      setCommentNudge(reaction === "dislike" ? "dislike" : "like");
      setCommentNudgeToken(detail?.firedAt ?? Date.now());
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setCommentNudge(null);
        timeoutId = null;
      }, COMMENT_NUDGE_DURATION_MS);
    };

    window.addEventListener(COMMENT_NUDGE_EVENT, handleCommentNudge);

    return () => {
      window.removeEventListener(COMMENT_NUDGE_EVENT, handleCommentNudge);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <nav
      aria-label="On this page"
      className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm dark:border-green-700/50 dark:bg-green-950/40"
    >
      <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-green-700 dark:text-green-300">
        Contents
      </p>

      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <a
              key={`${link.href}-${link.href === "#game-comments" ? commentNudgeToken : 0}`}
              href={link.href}
              className={`group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                link.href === "#game-comments" && commentNudge
                  ? "comment-nudge-link bg-gradient-to-r from-fuchsia-500 via-amber-400 to-emerald-400 text-white shadow-[0_10px_24px_rgba(16,185,129,0.35)]"
                  : "text-gray-700 hover:bg-green-50 hover:text-green-800 dark:text-gray-200 dark:hover:bg-green-800/60 dark:hover:text-white"
              }`}
            >
              <span>{link.label}</span>
              {link.href === "#game-comments" && (
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                    commentNudge
                      ? "comment-nudge-icon bg-white text-fuchsia-600 shadow-sm"
                      : "bg-green-50 text-green-700 group-hover:bg-white dark:bg-green-900/60 dark:text-green-200"
                  }`}
                  aria-hidden="true"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
              )}
            </a>
            {link.href === "#game-comments" && commentNudge && (
              <p
                key={`comment-nudge-copy-${commentNudgeToken}`}
                className="comment-nudge-copy px-3 pt-1 text-[10px] font-bold text-fuchsia-600 dark:text-amber-200"
              >
                {commentNudge === "dislike"
                  ? "Not your vibe? Tell us why."
                  : "Feeling it? Say it in the comments."}
              </p>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

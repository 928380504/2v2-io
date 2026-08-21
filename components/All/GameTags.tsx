import Link from "next/link";
import { getGameTagCount, getGameTagSlug } from "@/config/game-tags";
import { SITE_ROUTES } from "@/config/routes";
import { SITE_TAG_COLOR_CLASSES } from "@/config/theme";

interface GameTagsProps {
  tags?: string[];
  className?: string;
  maxTags?: number | null;
  wrap?: boolean;
  linkable?: boolean;
  showCount?: boolean;
  tagCounts?: Record<string, number>;
  selectedTag?: string;
  onTagSelect?: (tag: string) => void;
}

function getTagColorClasses(tag: string) {
  return SITE_TAG_COLOR_CLASSES[tag.trim().toLowerCase()] ||
    "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600";
}

export function GameTags({
  tags,
  className = "",
  maxTags = 2,
  wrap = false,
  linkable = false,
  showCount = false,
  tagCounts,
  selectedTag,
  onTagSelect,
}: GameTagsProps) {
  const visibleTags = maxTags === null
    ? (tags || [])
    : (tags || []).slice(0, maxTags);
  if (visibleTags.length === 0) return null;

  return (
    <div
      className={`flex min-w-0 gap-1 ${
        wrap ? "flex-wrap" : "overflow-hidden"
      } ${className}`}
    >
      {visibleTags.map((tag) => {
        const count = tagCounts?.[tag] ?? getGameTagCount(tag);
        const content = (
          <>
            <span className="truncate">{tag}</span>
            {showCount && count > 0 && (
              <span className="shrink-0 tabular-nums text-green-800 dark:text-green-200">
                {count}
              </span>
            )}
          </>
        );
        const classes = `inline-flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none ring-1 ring-inset min-[1440px]:text-[8px] ${getTagColorClasses(tag)}`;
        const isSelected = selectedTag?.trim().toLowerCase() === tag.trim().toLowerCase();

        if (onTagSelect) {
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onTagSelect(tag)}
              aria-label={`Show ${tag} games, ${count} ${count === 1 ? "game" : "games"}`}
              aria-pressed={isSelected}
              className={`${classes} transition-[opacity,transform,box-shadow] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                isSelected
                  ? "scale-[1.03] shadow-sm outline outline-2 outline-offset-1 outline-green-500 dark:outline-green-300"
                  : "opacity-75"
              }`}
            >
              {content}
            </button>
          );
        }

        return linkable ? (
          <Link
            key={tag}
            href={`${SITE_ROUTES.gameFilters}?tag=${encodeURIComponent(getGameTagSlug(tag))}`}
            aria-label={`${tag}, ${count} ${count === 1 ? "game" : "games"}`}
            className={`${classes} transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500`}
          >
            {content}
          </Link>
        ) : (
          <span key={tag} className={classes}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

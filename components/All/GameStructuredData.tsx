"use client";

import type { Game } from "@/config/game-catalog";
import { useGameRating } from "@/hooks/use-game-rating";
import { getPublicRatingCount } from "@/lib/game-rating-store";
import { siteUrl } from "@/config/site";
import { SITE_FEATURES } from "@/config/features";

interface GameStructuredDataProps {
  game: Game;
  pageUrl?: string;
}

export function GameStructuredData({
  game,
  pageUrl: pageUrlOverride,
}: GameStructuredDataProps) {
  const pageUrl = pageUrlOverride ?? siteUrl(game.url);
  const liveRating = useGameRating(game.id, {
    score: game.rating ?? 0,
    votes: game.ratingCount ?? 0,
  });
  const publicRatingCount = getPublicRatingCount(liveRating.votes);
  const hasAggregateRating =
    SITE_FEATURES.ratings &&
    Number.isFinite(liveRating.score) &&
    Number.isInteger(publicRatingCount) &&
    publicRatingCount > 0;

  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "WebApplication"],
    "@id": `${pageUrl}#game`,
    url: pageUrl,
    name: game.title,
    description: game.description,
    image: game.image,
    applicationCategory: "GameApplication",
    operatingSystem: game.platforms?.join(", ") || "Web Browser",
    gamePlatform: game.platforms || ["Web Browser"],
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      url: pageUrl,
      price: 0,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    ...(game.createdAt ? { datePublished: game.createdAt } : {}),
    ...(game.developer
      ? {
          author: {
            "@type": "Organization",
            name: game.developer,
          },
        }
      : {}),
    ...(hasAggregateRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(liveRating.score.toFixed(2)),
            ratingCount: publicRatingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}

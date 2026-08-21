import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameDetailPageTemplate } from "@/components/templates/GameDetailPageTemplate";
import {
  createGameDetailMetadata,
  getGameDetailPageIds,
  isGameDetailPageId,
} from "@/config/game-catalog";
import { SITE_ROUTE_SLUGS } from "@/config/routes";

interface GameDetailRouteProps {
  params: Promise<{ collectionSlug: string; gameId: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getGameDetailPageIds().map((gameId) => ({
    collectionSlug: SITE_ROUTE_SLUGS.gameCategory,
    gameId,
  }));
}

export async function generateMetadata({
  params,
}: GameDetailRouteProps): Promise<Metadata> {
  const { collectionSlug, gameId } = await params;

  if (
    collectionSlug !== SITE_ROUTE_SLUGS.gameCategory ||
    !isGameDetailPageId(gameId)
  ) {
    return {};
  }

  return createGameDetailMetadata(gameId);
}

export default async function GameDetailPage({
  params,
}: GameDetailRouteProps) {
  const { collectionSlug, gameId } = await params;

  if (
    collectionSlug !== SITE_ROUTE_SLUGS.gameCategory ||
    !isGameDetailPageId(gameId)
  ) {
    notFound();
  }

  return <GameDetailPageTemplate gameId={gameId} />;
}

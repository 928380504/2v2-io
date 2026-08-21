import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPageTemplate } from "@/components/templates/CategoryPageTemplate";
import { LegacyTagsRedirect } from "@/components/templates/LegacyTagsRedirect";
import { GameFiltersPageTemplate } from "@/components/templates/GameFiltersPageTemplate";
import {
  PRIMARY_CATEGORY_PAGE,
  createCategoryPageMetadata,
} from "@/config/category-pages";
import {
  getConfigurableCollectionSlugs,
  SITE_ROUTE_SLUGS,
} from "@/config/routes";
import {
  createLegacyTagsMetadata,
  createGameFiltersMetadata,
  GAME_FILTERS_PAGE,
} from "@/config/game-filters-page";

interface CollectionRouteProps {
  params: Promise<{ collectionSlug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getConfigurableCollectionSlugs().map((collectionSlug) => ({
    collectionSlug,
  }));
}

export async function generateMetadata({
  params,
}: CollectionRouteProps): Promise<Metadata> {
  const { collectionSlug } = await params;

  if (collectionSlug === SITE_ROUTE_SLUGS.gameCategory) {
    return createCategoryPageMetadata();
  }

  if (collectionSlug === SITE_ROUTE_SLUGS.gameFilters) {
    return createGameFiltersMetadata();
  }

  if (collectionSlug === SITE_ROUTE_SLUGS.legacyTags) {
    return createLegacyTagsMetadata();
  }

  return {};
}

export default async function CollectionPage({
  params,
}: CollectionRouteProps) {
  const { collectionSlug } = await params;

  if (collectionSlug === SITE_ROUTE_SLUGS.gameCategory) {
    return <CategoryPageTemplate page={PRIMARY_CATEGORY_PAGE} />;
  }

  if (collectionSlug === SITE_ROUTE_SLUGS.gameFilters) {
    return <GameFiltersPageTemplate />;
  }

  if (collectionSlug === SITE_ROUTE_SLUGS.legacyTags) {
    return <LegacyTagsRedirect page={GAME_FILTERS_PAGE} />;
  }

  notFound();
}

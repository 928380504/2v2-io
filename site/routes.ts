import manifest from "@/site/manifest.json";

export const SITE_ROUTES = manifest.routes;

export type SiteRouteKey = keyof typeof SITE_ROUTES;

function routeSlug(route: string): string {
  const slug = route.replace(/^\/+|\/+$/g, "");

  if (!slug || slug.includes("/")) {
    throw new Error(
      `Configurable route must contain exactly one path segment: ${route}`,
    );
  }

  return slug;
}

export const SITE_ROUTE_SLUGS = {
  gameCategory: routeSlug(SITE_ROUTES.gameCategory),
  gameFilters: routeSlug(SITE_ROUTES.gameFilters),
  legacyTags: routeSlug(SITE_ROUTES.legacyTags),
} as const;

const configurableSlugs = Object.values(SITE_ROUTE_SLUGS);

if (new Set(configurableSlugs).size !== configurableSlugs.length) {
  throw new Error("Configurable public routes must use distinct path segments.");
}

export function getConfigurableCollectionSlugs(): string[] {
  return [...configurableSlugs];
}

export function gameDetailPath(gameId: string): string {
  return `${SITE_ROUTES.gameCategory}/${gameId}`;
}

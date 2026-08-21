import manifest from "@/site/manifest.json";

type SiteRouteKey = keyof typeof manifest.routes;
type SiteConfiguration = Omit<typeof manifest.site, "navigation"> & {
  navigation: {
    links: Array<{ label: string; route: SiteRouteKey }>;
  };
};

export const SITE_CONFIG = manifest.site as SiteConfiguration;

export function siteUrl(path = "/"): string {
  return new URL(path, `${SITE_CONFIG.url}/`).toString();
}

export function gameAssetUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ""), `${SITE_CONFIG.assets.gameOrigin}/`).toString();
}

import type { SiteComponentOverrides } from "@/components/slots/contracts";

/**
 * Replace only the components that this site needs to customize.
 * Empty means that every slot uses the reusable template default.
 */
export const SITE_COMPONENT_OVERRIDES: SiteComponentOverrides = {};

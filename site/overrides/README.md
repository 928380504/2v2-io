# Site component overrides

`components.ts` is the only site-owned component registry. Leave it empty to
use every template default. To replace one area, import a compatible custom
component and assign only that slot:

```tsx
import type { SiteComponentOverrides } from "@/components/slots/contracts";
import { CustomNavbar } from "@/site/overrides/CustomNavbar";

export const SITE_COMPONENT_OVERRIDES = {
  Navbar: CustomNavbar,
} satisfies SiteComponentOverrides;
```

The replacement must accept the same props as the default component. Template
updates may add new slots without requiring changes here because every entry
is optional.


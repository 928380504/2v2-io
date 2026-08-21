"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { SITE_CONFIG } from "@/config/site";
import { SITE_THEME } from "@/config/theme";

const FEEDBACK_WIDGET_HOST_ID = "mtb-widget-host";

function keepFeedbackButtonVisible() {
  const host = document.getElementById(FEEDBACK_WIDGET_HOST_ID);
  const root = host?.shadowRoot;
  const button = root?.querySelector<HTMLButtonElement>(".mtb-tab");

  if (!host || !root || !button) return () => undefined;

  const style = document.createElement("style");
  style.dataset.siteFeedbackAlwaysVisible = "true";
  style.textContent = `
    .mtb-tab {
      opacity: 1 !important;
      transition: background .15s, box-shadow .15s, width .15s !important;
    }
  `;
  root.append(style);

  button.dataset.siteAutoHidden = "false";

  return () => {
    delete button.dataset.siteAutoHidden;
    style.remove();
  };
}

export function MakeThisBetterWidget() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;

    let isActive = true;
    let disableAlwaysVisible: () => void = () => undefined;

    import("makethisbetter")
      .then(({ MakeThisBetter }) => {
        if (!isActive) return;

        const widgetTheme = resolvedTheme === "dark" ? "dark" : "light";

        MakeThisBetter.init({
          projectKey: SITE_CONFIG.integrations.makeThisBetterProjectKey,
          theme: widgetTheme,
          brandColors: SITE_THEME.feedback[widgetTheme],
        });
        disableAlwaysVisible = keepFeedbackButtonVisible();
      })
      .catch((error) => {
        console.error("Failed to initialize Make This Better widget", error);
      });

    return () => {
      isActive = false;
      disableAlwaysVisible();
      import("makethisbetter")
        .then(({ MakeThisBetter }) => MakeThisBetter.destroy())
        .catch(() => undefined);
    };
  }, [resolvedTheme]);

  return null;
}

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import siteConfig from "@/site/generated/site.generated.json";

interface DisplayAdSlotProps {
  placement: string;
  className?: string;
  variant?: "horizontal" | "vertical";
  slotId?: string;
  fallback?: ReactNode;
}

const DISPLAY_AD_SLOT_ID = "5702073721";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function DisplayAdSlot({
  placement,
  className = "",
  variant = "horizontal",
  slotId = DISPLAY_AD_SLOT_ID,
  fallback,
}: DisplayAdSlotProps) {
  const adElementRef = useRef<HTMLModElement>(null);
  const [fillStatus, setFillStatus] = useState<"loading" | "filled" | "unfilled">(
    "loading",
  );
  const [isLocalPreview, setIsLocalPreview] = useState(
    process.env.NODE_ENV === "development",
  );
  const ads = siteConfig.ads;
  const clientId = ads.googleAdsense?.clientId?.trim();

  const isEnabled = Boolean(
    ads.enabled &&
      ads.googleAdsense?.enabled &&
      clientId,
  );

  useEffect(() => {
    const hostname = window.location.hostname;
    setIsLocalPreview(
      process.env.NODE_ENV === "development" ||
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1",
    );
  }, []);

  useEffect(() => {
    const adElement = adElementRef.current;
    if (!isEnabled || !adElement) {
      return;
    }

    const syncFillState = () => {
      const adStatus = adElement.dataset.adStatus;
      const renderStatus = adElement.dataset.adsbygoogleStatus;
      const hasRenderedContent = adElement.childElementCount > 0;

      if (adStatus === "unfilled") {
        setFillStatus("unfilled");
        return;
      }

      if (
        adStatus === "filled" ||
        (renderStatus === "done" && hasRenderedContent)
      ) {
        setFillStatus("filled");
      }
    };

    syncFillState();

    const statusObserver = new MutationObserver(syncFillState);
    statusObserver.observe(adElement, {
      attributes: true,
      attributeFilter: ["data-ad-status", "data-adsbygoogle-status"],
      childList: true,
      subtree: true,
    });

    const frameId = window.requestAnimationFrame(() => {
      if (!adElement.isConnected || adElement.dataset.adInitialized === "true") {
        return;
      }

      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        adElement.dataset.adInitialized = "true";
      } catch (error) {
        console.error(`Failed to initialize AdSense placement: ${placement}`, error);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      statusObserver.disconnect();
    };
  }, [isEnabled, placement]);

  if (!isEnabled && !isLocalPreview) {
    return fallback ? <>{fallback}</> : null;
  }

  if (fillStatus === "unfilled" && fallback) {
    return <>{fallback}</>;
  }

  const isVertical = variant === "vertical";
  const adHeight = isVertical ? "600px" : "90px";

  return (
    <aside
      aria-label="Advertisement"
      className={`relative flex items-center justify-center transition-colors ${
        isVertical
          ? "mx-auto h-[600px] min-h-[600px] w-full min-w-[120px] max-w-[300px]"
          : "h-[90px] min-w-0 w-full"
      } ${
        fillStatus === "filled"
          ? "bg-transparent"
          : "bg-[#303438]/70 dark:bg-[#202427]/70"
      } ${className}`}
    >
      {fillStatus !== "filled" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="rounded border border-gray-500 px-2 py-0.5 text-[9px] font-bold tracking-[0.18em] text-gray-400 dark:border-gray-600 dark:text-gray-500">
            ADS
          </span>
        </div>
      )}

      {isEnabled && clientId && (
        <ins
          ref={adElementRef}
          className="adsbygoogle relative z-10 block w-full"
          style={{ display: "block", width: "100%", height: adHeight }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format={isVertical ? "vertical" : "horizontal"}
          data-full-width-responsive="true"
        />
      )}
    </aside>
  );
}

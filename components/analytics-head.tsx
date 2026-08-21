import Script from "next/script"
import siteConfig from "@/site/generated/site.generated.json"

export function AnalyticsHead() {
  const analytics = siteConfig.analytics

  if (!analytics?.enabled) {
    return null
  }

  return (
    <>
      {analytics.googleAnalytics?.enabled &&
        analytics.googleAnalytics.measurementId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${analytics.googleAnalytics.measurementId}`}
              strategy="lazyOnload"
            />
            <Script id="google-analytics" strategy="lazyOnload">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${analytics.googleAnalytics.measurementId}');
              `}
            </Script>
          </>
        )}

      {analytics.clarity?.enabled && analytics.clarity.projectId && (
        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${analytics.clarity.projectId}");
          `}
        </Script>
      )}

      {analytics.customScripts
        ?.filter((script: any) => script.enabled && script.code)
        .map((script: any) => (
          <Script
            key={script.id}
            id={script.id}
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: script.code,
            }}
          />
        ))}
    </>
  )
}

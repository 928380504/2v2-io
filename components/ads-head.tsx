import siteConfig from "@/src/config/site.generated.json"

export function AdsHead() {
  const ads = siteConfig.ads

  if (!ads?.enabled) {
    return null
  }

  const scripts: any[] = []

  if (ads.googleAdsense?.enabled && ads.googleAdsense.clientId) {
    scripts.push({
      code: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.googleAdsense.clientId}" crossorigin="anonymous"></script>`
    })
  }

  scripts.push(...(ads.customAdScripts || []))
  if (ads.adsterra?.enabled) {
    scripts.push(...(ads.adsterra?.entries || []))
  }
  scripts.push(...(ads.monetag?.entries || []))

  const html = scripts
    .filter((script: any) => script.enabled !== false && script.code)
    .map((script: any) => script.code)
    .join('\n')

  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
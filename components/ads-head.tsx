import type { ScriptHTMLAttributes } from "react"
import siteConfig from "@/site/generated/site.generated.json"

interface ParsedScript {
  attributes: ScriptHTMLAttributes<HTMLScriptElement>
  content: string
}

const booleanAttributes = new Set(["async", "defer", "nomodule"])

const reactAttributeNames: Record<string, string> = {
  charset: "charSet",
  crossorigin: "crossOrigin",
  fetchpriority: "fetchPriority",
  nomodule: "noModule",
  referrerpolicy: "referrerPolicy",
}

function parseScriptAttributes(source: string) {
  const attributes: Record<string, string | boolean> = {}
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

  let match: RegExpExecArray | null
  while ((match = attributePattern.exec(source)) !== null) {
    const originalName = match[1]
    const lowerName = originalName.toLowerCase()
    const reactName = reactAttributeNames[lowerName] || originalName
    const value = match[2] ?? match[3] ?? match[4]
    attributes[reactName] = booleanAttributes.has(lowerName)
      ? true
      : value ?? ""
  }

  return attributes as ScriptHTMLAttributes<HTMLScriptElement>
}

function parseConfiguredScripts(code: string): ParsedScript[] {
  const parsed: ParsedScript[] = []
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi

  let match: RegExpExecArray | null
  while ((match = scriptPattern.exec(code)) !== null) {
    parsed.push({
      attributes: parseScriptAttributes(match[1]),
      content: match[2],
    })
  }

  const trimmedCode = code.trim()
  if (parsed.length === 0 && trimmedCode && !trimmedCode.includes("<")) {
    parsed.push({ attributes: {}, content: trimmedCode })
  }

  return parsed
}

export function AdsHead() {
  const ads = siteConfig.ads

  if (!ads?.enabled) {
    return null
  }

  const configuredEntries: Array<{ code: string; enabled?: boolean }> = []

  if (ads.googleAdsense?.enabled && ads.googleAdsense.clientId) {
    configuredEntries.push({
      code: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.googleAdsense.clientId}" crossorigin="anonymous"></script>`,
    })
  }

  configuredEntries.push(...(ads.customAdScripts || []))
  if (ads.adsterra?.enabled) {
    configuredEntries.push(...(ads.adsterra.entries || []))
  }
  configuredEntries.push(...(ads.monetag?.entries || []))

  const parsedScripts = configuredEntries
    .filter((entry) => entry.enabled !== false && entry.code)
    .flatMap((entry) => parseConfiguredScripts(entry.code))

  return (
    <>
      {parsedScripts.map((script, index) => (
        <script
          key={`configured-ad-script-${index}`}
          {...script.attributes}
          dangerouslySetInnerHTML={{ __html: script.content }}
        />
      ))}
    </>
  )
}

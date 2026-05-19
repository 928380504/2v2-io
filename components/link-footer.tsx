import siteConfig from "@/src/config/site.generated.json"

interface OutboundLink {
  domain: string
  keyword: string
  description: string
}

export function LinkFooter() {
  const friendLinks = (siteConfig as any).friendLinks

  if (!friendLinks?.enabled) {
    return null
  }

  const outbound = friendLinks?.outbound as OutboundLink[] | undefined

  if (!outbound || outbound.length === 0) {
    return null
  }

  return (
    <div className="w-full py-6">
      <div className="max-w-[1200px] mx-auto px-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Recommended Sites
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {outbound.map((link, index) => (
            <a
              key={index}
              href={`https://${link.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-black dark:hover:border-white transition-colors"
            >
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1 group-hover:scale-105 transition-transform">
                {link.keyword}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                {link.description}
              </p>
             
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
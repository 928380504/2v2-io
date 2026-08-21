const siteManifest = require('./site/manifest.json');

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: siteManifest.site.url,
  generateRobotsTxt: true,
  exclude: [siteManifest.routes.legacyTags],
  changefreq: 'daily',
  priority: 0.7,
  outDir: './out',
  generateIndexSitemap: false,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/private/']
      },
      {
        userAgent: [
          'GPTBot',
          'Claude-Web',
          'Anthropic-AI',
          'anthropic-ai',
          'PerplexityBot',
          'GoogleOther',
          'DuckAssistBot',
          'CCBot',
          'ChatGPT-User',
          'Google-Extended',
          'OAI-SearchBot'
        ],
        allow: [
          '/llms.txt',
          '/llms-full.txt',
          '/blog/',
          '/products/',
          '/about-us',
          '/contact-us',
          '/dmca',
          '/terms-of-service',
          '/privacy-policy'
        ],
        disallow: ['/user-content/']
      }
    ],
    additionalSitemaps: [
      `${siteManifest.site.url}/sitemap.xml`
    ],
    // 移除 Host 配置，因为它不是标准的 robots.txt 指令
  }
}

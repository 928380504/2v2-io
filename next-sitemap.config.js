/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://2v2-io.com/',
  generateRobotsTxt: true,
  exclude: [],
  changefreq: 'daily',
  priority: 0.7,
  outDir: './out',
  generateIndexSitemap: false,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      
      }
    ],
    additionalSitemaps: [
      'https://2v2-io.com/sitemap.xml'
    ]
  },
  transform: (config, path) => {
    // 自定义转换逻辑
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    }
  }
}
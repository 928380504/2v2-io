const fs = require('fs').promises;
const path = require('path');

async function generateSitemap() {
  try {
    // 基础 URL
    const baseUrl = 'https://ambigram-generator.org'
    
    // 页面配置
    const pages = [
      { url: '/', changefreq: 'weekly', priority: 1.0 },
      { url: '/generator', changefreq: 'daily', priority: 0.9 },
      { url: '/gallery', changefreq: 'daily', priority: 0.8 },
      { url: '/pricing', changefreq: 'monthly', priority: 0.7 },
      { url: '/about', changefreq: 'monthly', priority: 0.6 },
      { url: '/privacy', changefreq: 'monthly', priority: 0.5 },
      { url: '/terms', changefreq: 'monthly', priority: 0.5 },
    ]

    const date = new Date().toISOString().split('T')[0]

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`

    // 确保目录存在
    const publicDir = path.join(process.cwd(), 'public')
    await fs.mkdir(publicDir, { recursive: true }).catch(() => {})

    // 异步写入文件
    await fs.writeFile(
      path.join(publicDir, 'sitemap.xml'),
      sitemap
    )

    console.log('Sitemap generated successfully!')
  } catch (error) {
    console.error('Error generating sitemap:', error)
    process.exit(1)
  }
}

generateSitemap().catch(console.error) 
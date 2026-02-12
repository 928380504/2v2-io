const fs = require('fs');
const path = require('path');

// 网站基础URL
const BASE_URL = 'https://stimulation-clicker.org';

// 获取所有游戏路由
const games = [
  '/clicker-games/incremental-clicker-games/stimulation-clicker',
  '/clicker-games/incremental-clicker-games/capybara-clicker-pro',
  '/clicker-games/incremental-clicker-games/cat-clicker-mlg',
  '/clicker-games/incremental-clicker-games/capybara-clicker-2',
  '/clicker-games/incremental-clicker-games/click-click-clicker',
  '/clicker-games/incremental-clicker-games/muscle-clicker',
];

// 获取所有分类路由
const categories = [
  '/idle-clicker-games',
  '/incremental-clicker-games',
  '/merging-clicker-games',
  '/simulation-clicker-games',
  '/rpg-clicker-games',
  '/sci-fi-clicker-games',
  '/tower-defense-clicker-games',
];

// 基础路由
const baseRoutes = [
  '/',
  '/about',
  '/blog',
  '/hot-games',
  '/new-games',
];

// 生成sitemap内容
function generateSitemapXml() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // 添加所有路由
  [...baseRoutes, ...categories, ...games].forEach(route => {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${route}</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';
  });

  xml += '</urlset>';
  return xml;
}

// 确保public目录存在
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// 写入sitemap文件
const sitemap = generateSitemapXml();
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);

console.log('Sitemap generated successfully!'); 
const fs = require('fs');
const path = require('path');

// 确保 out 目录存在
const outDir = path.join(process.cwd(), 'out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 创建 _redirects 文件内容
const redirectsContent = `# Redirect all game paths to simplified format
/clicker-games/*/* /:splat 301

# Handle SPA routing
/* /index.html 200`;

// 写入 _redirects 文件
fs.writeFileSync(path.join(outDir, '_redirects'), redirectsContent);

console.log('_redirects file has been created in the out directory.'); 
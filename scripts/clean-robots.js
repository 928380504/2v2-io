const fs = require('fs');
const path = require('path');

const robotsPath = path.join(__dirname, '../out/robots.txt');

try {
  // 读取 robots.txt 文件
  let content = fs.readFileSync(robotsPath, 'utf8');
  
  // 移除包含 Host 的行及其注释
  content = content.split('\n').filter(line => {
    return !line.includes('# Host') && !line.includes('Host:');
  }).join('\n');
  
  // 写回文件
  fs.writeFileSync(robotsPath, content, 'utf8');
  
  console.log('Successfully cleaned robots.txt');
} catch (error) {
  console.error('Error cleaning robots.txt:', error);
}
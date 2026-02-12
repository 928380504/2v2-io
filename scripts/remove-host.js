const fs = require('fs');
const path = require('path');

const robotsPath = path.join(__dirname, '../out/robots.txt');

try {
  // 读取 robots.txt
  let content = fs.readFileSync(robotsPath, 'utf8');
  
  // 移除包含 Host 的行
  content = content.replace(/^Host:.*$\n?/m, '');
  
  // 移除空的 Host 标题行
  content = content.replace(/^# Host\n$/m, '');
  
  // 写回文件
  fs.writeFileSync(robotsPath, content);
  
  console.log('成功移除 robots.txt 中的 Host 配置');
} catch (error) {
  console.error('处理 robots.txt 时出错:', error);
}
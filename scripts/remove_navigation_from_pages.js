const fs = require('fs');
const path = require('path');

// 需要处理的文件列表
const files = [
  'app/partners/page.tsx',
  'app/help/page.tsx',
  'app/leaderboard/page.tsx',
  'app/settings/page.tsx'
];

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);

  try {
    let content = fs.readFileSync(fullPath, 'utf-8');

    // 移除 import
    content = content.replace(/import\s+\{[^}]*Navigation[^}]*\}\s+from\s+["']@\/components\/navigation["']\s*\n?/g, '');

    // 移除 <Navigation /> 组件
    content = content.replace(/<Navigation\s*\/>/g, '');

    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ 已处理: ${filePath}`);
  } catch (err) {
    console.log(`⚠️  跳过: ${filePath} (${err.message})`);
  }
});

console.log('\n✅ 完成!所有页面的导航栏已移除,现在由 layout.tsx 统一管理');

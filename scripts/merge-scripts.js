const fs = require('fs');
const path = require('path');

// 脚本执行顺序
const scriptOrder = [
  // 001-083 按顺序
  ...Array.from({length: 83}, (_, i) => {
    const num = String(i + 1).padStart(3, '0');
    return `${num}`;
  }),
  // 补充脚本
  '032.4', '032.5', '032.6', '032.7', '032.8', '032.9',
  '054.5', '054.6', '055.5',
  // 热修复
  '085',
  // 最后启用 Realtime
  '084'
];

const scriptsDir = path.join(__dirname);
const outputFile = path.join(__dirname, 'MERGED_PRODUCTION_INIT.sql');

let mergedContent = `-- =============================================
-- 完整生产环境初始化脚本（自动合并）
-- 生成时间: ${new Date().toISOString()}
-- =============================================

`;

console.log('🔍 开始扫描和合并 SQL 脚本...\n');

let successCount = 0;
let skipCount = 0;

for (const prefix of scriptOrder) {
  // 查找匹配的文件
  const files = fs.readdirSync(scriptsDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.sql'))
    .filter(f => !f.includes('archived') && f !== 'MERGED_PRODUCTION_INIT.sql' && f !== 'COMPLETE_PRODUCTION_INIT.sql');

  if (files.length === 0) {
    console.log(`⚠️  跳过 ${prefix} - 文件不存在`);
    skipCount++;
    continue;
  }

  // 如果有多个匹配，取第一个
  const file = files[0];
  const filePath = path.join(scriptsDir, file);

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    mergedContent += `\n-- =============================================\n`;
    mergedContent += `-- 文件: ${file}\n`;
    mergedContent += `-- =============================================\n\n`;
    mergedContent += content;
    mergedContent += `\n\n`;

    console.log(`✅ ${file}`);
    successCount++;
  } catch (error) {
    console.log(`❌ 读取失败: ${file} - ${error.message}`);
    skipCount++;
  }
}

// 写入合并后的文件
fs.writeFileSync(outputFile, mergedContent, 'utf8');

console.log(`\n=============================================`);
console.log(`📊 合并统计:`);
console.log(`   ✅ 成功: ${successCount} 个脚本`);
console.log(`   ⚠️  跳过: ${skipCount} 个脚本`);
console.log(`\n📄 输出文件: ${outputFile}`);
console.log(`   文件大小: ${(mergedContent.length / 1024).toFixed(2)} KB`);
console.log(`=============================================\n`);
console.log(`🎯 下一步:`);
console.log(`1. 删除旧的生产 Supabase 项目`);
console.log(`2. 创建新的生产 Supabase 项目`);
console.log(`3. 在 SQL Editor 中执行 MERGED_PRODUCTION_INIT.sql`);
console.log(`4. 更新 VPS 的 .env.local 文件`);
console.log(`5. 重新构建: npm run build && pm2 restart merchant-platform`);
console.log(`=============================================\n`);

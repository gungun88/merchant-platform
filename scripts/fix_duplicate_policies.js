const fs = require('fs');

const content = fs.readFileSync('./MERGED_PRODUCTION_INIT.sql', 'utf8');
const lines = content.split('\n');

// 注释掉第 6627-6670 行的重复策略创建
for (let i = 6626; i <= 6669; i++) {
  if (lines[i] && !lines[i].trim().startsWith('--')) {
    lines[i] = '-- ' + lines[i];
  }
}

fs.writeFileSync('./MERGED_PRODUCTION_INIT.sql', lines.join('\n'), 'utf8');
console.log('✅ 已注释掉重复的存储策略(第6627-6670行)');

const fs = require('fs');

const content = fs.readFileSync('./MERGED_PRODUCTION_INIT.sql', 'utf8');
const lines = content.split('\n');

console.log('=== 搜索未注释的 storage.buckets 语句 ===\n');

let found = false;
lines.forEach((line, index) => {
  if (line.includes('storage.buckets') && !line.trim().startsWith('--')) {
    found = true;
    console.log(`行 ${index + 1}: ${line.trim()}`);
  }
});

if (!found) {
  console.log('✅ 没有找到未注释的 storage.buckets 语句');
}

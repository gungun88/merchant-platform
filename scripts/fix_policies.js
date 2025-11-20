const fs = require('fs');

// Read the file
const content = fs.readFileSync('./MERGED_PRODUCTION_INIT.sql', 'utf8');
const lines = content.split('\n');

// Insert DROP statements before line 3682 (index 3681)
const dropStatements = [
  '-- 删除可能存在的旧策略',
  'DROP POLICY IF EXISTS "公开读取平台资源" ON storage.objects;',
  'DROP POLICY IF EXISTS "管理员可以上传平台资源" ON storage.objects;',
  'DROP POLICY IF EXISTS "管理员可以更新平台资源" ON storage.objects;',
  'DROP POLICY IF EXISTS "管理员可以删除平台资源" ON storage.objects;',
  ''
];

// Insert at line 3681 (before line 3682)
lines.splice(3681, 0, ...dropStatements);

// Write back
fs.writeFileSync('./MERGED_PRODUCTION_INIT.sql', lines.join('\n'), 'utf8');
console.log('Successfully added DROP POLICY statements before line 3682');

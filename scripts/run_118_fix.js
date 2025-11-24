const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 手动读取 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('开始执行修复脚本...\n');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '118_check_and_fix_points_function.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // 分割成多个语句
    const statements = sqlContent
      .split(/;[\s\n]*(?=(?:[^']*'[^']*')*[^']*$)/) // 按分号分割,但忽略字符串内的分号
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    console.log(`共 ${statements.length} 条 SQL 语句\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;

      console.log(`执行语句 ${i + 1}/${statements.length}...`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });

        if (error) {
          // 如果没有 exec_sql 函数,直接使用 supabase 客户端
          throw error;
        }
      } catch (err) {
        // 尝试直接执行
        const { error: directError } = await supabase.from('_sql').insert({ query: stmt });

        if (directError && directError.message.includes('relation "_sql" does not exist')) {
          console.log('  ⚠️  无法通过 Supabase 客户端直接执行复杂 SQL');
          console.log('  请在 Supabase Dashboard 的 SQL Editor 中手动执行此脚本');
          console.log('  脚本路径:', sqlPath);
          process.exit(1);
        }
      }
    }

    console.log('\n✅ 脚本执行完成!');
    console.log('\n请查看 Supabase Dashboard 的日志确认执行结果');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.log('\n请在 Supabase Dashboard (SQL Editor) 中手动执行以下脚本:');
    console.log('scripts/118_check_and_fix_points_function.sql');
    process.exit(1);
  }
})();

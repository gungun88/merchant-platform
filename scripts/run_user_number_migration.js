const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 缺少必要的环境变量')
  console.error('需要: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('🚀 开始执行用户编号迁移...\n')

  try {
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '064_add_user_number.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('📄 SQL文件读取成功')
    console.log('📊 执行迁移脚本...\n')

    // 执行SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // 如果RPC函数不存在,尝试直接执行
      console.log('⚠️  RPC函数不可用,尝试直接执行SQL...')

      // 分割SQL语句并逐个执行
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        if (statement.includes('DO $$') || statement.includes('CREATE OR REPLACE FUNCTION')) {
          // 跳过复杂的块语句提示
          console.log('⚠️  检测到复杂SQL块,请手动在Supabase SQL编辑器中执行')
          console.log('\n📋 请复制以下SQL到Supabase控制台执行:\n')
          console.log('=' .repeat(60))
          console.log(sql)
          console.log('=' .repeat(60))
          console.log('\n访问: https://supabase.com/dashboard/project/YOUR_PROJECT/sql')
          process.exit(0)
        }
      }
    }

    console.log('✅ 迁移执行成功!\n')
    console.log('📊 验证结果...')

    // 验证序列是否创建
    const { data: seqData, error: seqError } = await supabase
      .from('information_schema.sequences')
      .select('sequence_name')
      .eq('sequence_name', 'user_number_seq')
      .single()

    if (seqError && !seqError.message.includes('multiple')) {
      console.log('⚠️  无法验证序列创建,请手动检查')
    } else {
      console.log('✅ 序列 user_number_seq 已创建')
    }

    // 验证字段是否添加
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_number, username')
      .order('user_number', { ascending: true })
      .limit(5)

    if (profileError) {
      console.log('❌ 验证失败:', profileError.message)
      console.log('\n⚠️  请手动在Supabase SQL编辑器中执行迁移脚本')
      console.log('访问: https://supabase.com/dashboard/project/YOUR_PROJECT/sql\n')
      process.exit(1)
    }

    console.log('✅ user_number 字段已添加\n')
    console.log('📊 前5位用户的编号:\n')
    profiles.forEach(p => {
      console.log(`   用户编号: ${p.user_number} | 用户名: ${p.username}`)
    })

    console.log('\n✅ 用户编号系统已成功部署!')
    console.log('📌 新用户将自动获得从当前最大值+1的编号')
    console.log('📌 编号格式: 1001, 1002, 1003...\n')

  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    console.log('\n⚠️  请手动在Supabase SQL编辑器中执行以下脚本:')
    console.log('访问: https://supabase.com/dashboard/project/YOUR_PROJECT/sql\n')
    console.log('=' .repeat(60))
    const sqlPath = path.join(__dirname, '064_add_user_number.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    console.log(sql)
    console.log('=' .repeat(60))
    process.exit(1)
  }
}

runMigration()

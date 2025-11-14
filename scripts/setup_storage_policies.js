/**
 * 设置 Supabase Storage 策略
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function setupStoragePolicies() {
  console.log('🔒 开始设置存储策略...\n')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 错误: 缺少 Supabase 配置')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    console.log('📋 策略说明:')
    console.log('   1. 已认证用户可以上传文件到 partner-logos 文件夹')
    console.log('   2. 所有人可以查看 public 存储桶中的文件')
    console.log('   3. 用户可以更新自己上传的文件')
    console.log('   4. 管理员可以删除任何文件\n')

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'setup_storage_policies.sql')
    let sqlContent = fs.readFileSync(sqlPath, 'utf8')

    // 移除注释和空行,分割成单独的语句
    const statements = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)

    console.log(`📝 找到 ${statements.length} 条 SQL 语句\n`)

    // 执行每条语句
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      console.log(`执行语句 ${i + 1}/${statements.length}...`)

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt })

        if (error) {
          // 如果是 "function does not exist" 错误,使用直接查询
          console.log(`⚠️  尝试直接执行...`)
          const { error: directError } = await supabase.from('_sql').select(stmt)

          if (directError) {
            console.error(`   ❌ 失败:`, directError.message)
          } else {
            console.log(`   ✅ 成功`)
          }
        } else {
          console.log(`   ✅ 成功`)
        }
      } catch (err) {
        console.error(`   ⚠️  警告:`, err.message)
      }
    }

    console.log('\n✅ 策略设置完成!')
    console.log('\n💡 请手动验证:')
    console.log('   1. 访问 Supabase Dashboard > Storage > public')
    console.log('   2. 点击 "Policies" 标签')
    console.log('   3. 确认以下策略已创建:')
    console.log('      - 允许已认证用户上传合作伙伴 Logo (INSERT)')
    console.log('      - 允许所有人查看 public 存储桶文件 (SELECT)')
    console.log('      - 允许用户更新自己上传的文件 (UPDATE)')
    console.log('      - 允许管理员删除文件 (DELETE)')
    console.log('\n🔧 如果自动创建失败,请手动在 SQL Editor 中执行:')
    console.log(`   ${sqlPath}`)

  } catch (error) {
    console.error('❌ 发生错误:', error)
    process.exit(1)
  }
}

// 运行设置
setupStoragePolicies().catch(console.error)

/**
 * 启用deposit_merchant_applications表的Realtime功能
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

// 解析环境变量
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少环境变量')
  console.error('需要: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function enableDepositRealtime() {
  try {
    console.log('🔍 检查deposit_merchant_applications表的Realtime配置...\n')

    // 执行SQL命令启用Realtime
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- 将deposit_merchant_applications表添加到realtime publication
        ALTER PUBLICATION supabase_realtime ADD TABLE deposit_merchant_applications;

        -- 启用表的复制标识(如果还没有)
        ALTER TABLE deposit_merchant_applications REPLICA IDENTITY FULL;
      `
    })

    if (error) {
      console.error('❌ 启用失败:', error)
      console.log('\n📝 请手动在Supabase SQL Editor中执行以下命令:')
      console.log('--------------------------------------------------')
      console.log('ALTER PUBLICATION supabase_realtime ADD TABLE deposit_merchant_applications;')
      console.log('ALTER TABLE deposit_merchant_applications REPLICA IDENTITY FULL;')
      console.log('--------------------------------------------------\n')
      console.log('或者在 Supabase Dashboard:')
      console.log('1. 进入 Database → Replication')
      console.log('2. 找到 deposit_merchant_applications 表')
      console.log('3. 启用 "Enable Realtime" 开关\n')
      return
    }

    console.log('✅ deposit_merchant_applications表的Realtime功能已启用!')
    console.log('现在前端应该可以实时接收数据更新了\n')
  } catch (error) {
    console.error('❌ 发生错误:', error)
    console.log('\n📝 请手动在Supabase SQL Editor中执行以下命令:')
    console.log('--------------------------------------------------')
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE deposit_merchant_applications;')
    console.log('ALTER TABLE deposit_merchant_applications REPLICA IDENTITY FULL;')
    console.log('--------------------------------------------------\n')
  }
}

enableDepositRealtime()

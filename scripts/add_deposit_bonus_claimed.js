// 添加 deposit_bonus_claimed 字段到 merchants 表
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function addDepositBonusClaimedColumn() {
  console.log('=== 添加 deposit_bonus_claimed 字段 ===\n')

  try {
    // 执行 SQL 添加字段
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.merchants
        ADD COLUMN IF NOT EXISTS deposit_bonus_claimed BOOLEAN DEFAULT false;

        COMMENT ON COLUMN public.merchants.deposit_bonus_claimed IS '是否已领取押金商家审核通过奖励（1000积分一次性奖励）';
      `
    })

    if (error) {
      console.error('❌ 添加字段失败:', error)

      // 尝试直接用 from 操作（某些 Supabase 配置可能不支持 rpc）
      console.log('\n尝试使用直接 SQL 执行...')
      const { error: directError } = await supabase
        .from('merchants')
        .select('deposit_bonus_claimed')
        .limit(1)

      if (directError && directError.message.includes('column') && directError.message.includes('does not exist')) {
        console.error('❌ 字段不存在，请手动运行 SQL:')
        console.log('\nALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS deposit_bonus_claimed BOOLEAN DEFAULT false;')
        console.log("COMMENT ON COLUMN public.merchants.deposit_bonus_claimed IS '是否已领取押金商家审核通过奖励（1000积分一次性奖励）';")
      } else {
        console.log('✅ 字段已存在或已成功添加')
      }
    } else {
      console.log('✅ 字段添加成功')
    }

    // 验证字段
    const { data, error: verifyError } = await supabase
      .from('merchants')
      .select('id, deposit_bonus_claimed')
      .limit(1)

    if (verifyError) {
      console.error('\n❌ 验证字段失败:', verifyError.message)
    } else {
      console.log('\n✅ 字段验证成功，字段已存在')
      console.log('示例数据:', data)
    }
  } catch (err) {
    console.error('❌ 执行出错:', err)
  }
}

addDepositBonusClaimedColumn()
  .then(() => {
    console.log('\n✅ 迁移完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 迁移失败:', err)
    process.exit(1)
  })

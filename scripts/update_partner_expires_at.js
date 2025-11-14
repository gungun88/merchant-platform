/**
 * 更新已审核通过但没有到期时间的合作伙伴数据
 * 根据 approved_at + duration_years 计算到期时间
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

async function updatePartnerExpiresAt() {
  try {
    console.log('🔍 查询需要更新的合作伙伴...')

    // 查询已审核通过但没有到期时间的合作伙伴
    const { data: partners, error: fetchError } = await supabase
      .from('partners')
      .select('*')
      .eq('status', 'approved')
      .is('expires_at', null)

    if (fetchError) {
      console.error('❌ 查询失败:', fetchError)
      return
    }

    if (!partners || partners.length === 0) {
      console.log('✅ 没有需要更新的数据')
      return
    }

    console.log(`📋 找到 ${partners.length} 个需要更新的合作伙伴`)
    console.log('')

    // 逐个更新
    for (const partner of partners) {
      console.log(`处理: ${partner.name}`)
      console.log(`  - ID: ${partner.id}`)
      console.log(`  - 订阅时长: ${partner.duration_years} 年`)
      console.log(`  - 审核时间: ${partner.approved_at || '未知'}`)

      // 计算到期时间
      let expiresAt
      if (partner.approved_at) {
        // 使用审核时间 + 订阅年数
        expiresAt = new Date(partner.approved_at)
        expiresAt.setFullYear(expiresAt.getFullYear() + partner.duration_years)
      } else {
        // 如果没有审核时间,使用创建时间 + 订阅年数
        expiresAt = new Date(partner.created_at)
        expiresAt.setFullYear(expiresAt.getFullYear() + partner.duration_years)
      }

      console.log(`  - 计算到期时间: ${expiresAt.toISOString()}`)

      // 更新数据库
      const { error: updateError } = await supabase
        .from('partners')
        .update({ expires_at: expiresAt.toISOString() })
        .eq('id', partner.id)

      if (updateError) {
        console.error(`  ❌ 更新失败:`, updateError)
      } else {
        console.log(`  ✅ 更新成功`)
      }
      console.log('')
    }

    console.log('🎉 批量更新完成!')
  } catch (error) {
    console.error('❌ 发生错误:', error)
  }
}

updatePartnerExpiresAt()

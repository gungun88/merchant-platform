/**
 * 诊断脚本 - 检查生产环境point_transactions表的字段
 */

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

async function checkPointTransactionsTable() {
  console.log('🔍 检查 point_transactions 表结构...\n')

  try {
    // 查询表结构
    const { data: columns, error } = await supabase
      .from('point_transactions')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }

    if (!columns || columns.length === 0) {
      console.log('⚠️  表中没有数据,无法检查字段')
      console.log('   让我们检查表定义...\n')

      // 尝试插入并立即删除一条测试数据来获取字段信息
      const testData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        amount: 0,
        type: 'test',
        description: 'test'
      }

      const { error: insertError } = await supabase
        .from('point_transactions')
        .insert(testData)
        .select()

      if (insertError) {
        console.log('插入测试数据失败:', insertError.message)
        console.log('错误详情:', insertError.details)
        console.log('提示:', insertError.hint)

        // 检查是否是缺少字段的错误
        if (insertError.message.includes('balance_after') || insertError.message.includes('column')) {
          console.log('\n❌ 确认问题: point_transactions 表缺少必需字段!')
          console.log('\n📋 需要执行的修复步骤:')
          console.log('1. 在生产环境 Supabase SQL 编辑器中执行:')
          console.log('   ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS balance_after INTEGER NOT NULL DEFAULT 0;')
          console.log('\n2. 然后执行脚本重新计算 balance_after:')
          console.log('   scripts/029_fix_point_balance_simple.sql')
        }
      }
      return
    }

    const firstRow = columns[0]
    const fields = Object.keys(firstRow)

    console.log('✅ 表字段列表:')
    fields.forEach((field, index) => {
      console.log(`  ${index + 1}. ${field}`)
    })

    console.log('\n📊 检查必需字段:')
    const requiredFields = [
      'id',
      'user_id',
      'amount',
      'balance_after',  // 这个是关键字段!
      'type',
      'description',
      'created_at'
    ]

    const missingFields = []
    requiredFields.forEach(field => {
      const exists = fields.includes(field)
      const status = exists ? '✅' : '❌'
      console.log(`  ${status} ${field}`)
      if (!exists) {
        missingFields.push(field)
      }
    })

    if (missingFields.length > 0) {
      console.log('\n❌ 发现缺失字段:', missingFields.join(', '))
      console.log('\n🔧 修复方案:')
      console.log('在生产环境 Supabase SQL 编辑器中执行以下SQL:\n')
      missingFields.forEach(field => {
        if (field === 'balance_after') {
          console.log(`ALTER TABLE point_transactions ADD COLUMN ${field} INTEGER NOT NULL DEFAULT 0;`)
        }
      })
      console.log('\n然后执行 scripts/029_fix_point_balance_simple.sql 重新计算余额')
    } else {
      console.log('\n✅ 所有必需字段都存在!')

      // 检查示例数据
      console.log('\n📝 示例数据 (最近5条):')
      const { data: recentData } = await supabase
        .from('point_transactions')
        .select('created_at, amount, balance_after, type, description')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentData && recentData.length > 0) {
        recentData.forEach((row, index) => {
          console.log(`\n  ${index + 1}. ${row.type}`)
          console.log(`     金额: ${row.amount > 0 ? '+' : ''}${row.amount}`)
          console.log(`     余额: ${row.balance_after}`)
          console.log(`     时间: ${new Date(row.created_at).toLocaleString('zh-CN')}`)
        })
      }
    }

  } catch (error) {
    console.error('❌ 执行出错:', error.message)
  }
}

checkPointTransactionsTable()
  .then(() => {
    console.log('\n✅ 检查完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })

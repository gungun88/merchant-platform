const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTableStructure() {
  console.log('检查 platform_income 表结构...\n')

  // 查询表结构
  const { data, error } = await supabase
    .from('platform_income')
    .select('*')
    .limit(1)

  if (error) {
    console.log('❌ 查询失败:', error.message)
    return
  }

  console.log('✅ platform_income 表可访问\n')

  // 尝试查询所有记录查看字段
  const { data: allData, error: allError } = await supabase
    .from('platform_income')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (allError) {
    console.log('❌ 查询记录失败:', allError.message)
    return
  }

  console.log('最近 5 条记录:')
  console.log(JSON.stringify(allData, null, 2))

  // 检查是否有 transaction_type 字段
  if (allData && allData.length > 0) {
    const firstRecord = allData[0]
    console.log('\n字段检查:')
    console.log('- transaction_type:', 'transaction_type' in firstRecord ? '✅ 存在' : '❌ 不存在')
    console.log('- created_by:', 'created_by' in firstRecord ? '✅ 存在' : '❌ 不存在')
    console.log('- income_date:', 'income_date' in firstRecord ? '✅ 存在' : '❌ 不存在')
  } else {
    console.log('\n⚠️ 表中暂无数据，无法检查字段')
  }

  // 尝试插入测试数据
  console.log('\n\n尝试插入测试支出记录...')
  const { data: insertData, error: insertError } = await supabase
    .from('platform_income')
    .insert({
      transaction_type: 'expense',
      income_type: 'manual_expense',
      amount: 1.00,
      description: '测试支出记录',
      income_date: new Date().toISOString().split('T')[0],
    })
    .select()

  if (insertError) {
    console.log('❌ 插入失败:', insertError.message)
    console.log('错误详情:', insertError)
  } else {
    console.log('✅ 插入成功!')
    console.log('插入的数据:', insertData)
  }
}

checkTableStructure()

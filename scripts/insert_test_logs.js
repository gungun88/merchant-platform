// 测试脚本: 插入一些示例日志数据用于测试
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

async function insertTestLogs() {
  console.log('🔄 开始插入测试日志数据...\n')

  try {
    // 1. 获取第一个管理员用户
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (profileError || !adminProfile) {
      console.error('❌ 未找到管理员用户,请先设置管理员账号')
      console.log('提示: 可以运行 node scripts/set_admin_user.js 来设置管理员')
      return
    }

    const adminId = adminProfile.id
    console.log(`✅ 找到管理员 ID: ${adminId}`)

    // 2. 准备测试日志数据
    const testLogs = [
      {
        admin_id: adminId,
        action_type: 'user_ban',
        target_type: 'user',
        target_id: adminId, // 使用自己作为目标仅供测试
        old_data: { is_banned: false, ban_reason: null },
        new_data: { is_banned: true, ban_reason: '违规发布商家信息' },
        description: '封禁用户: 多次违规发布虚假商家信息',
      },
      {
        admin_id: adminId,
        action_type: 'merchant_approve',
        target_type: 'merchant',
        description: '审核通过商家: ABC跨境物流服务',
      },
      {
        admin_id: adminId,
        action_type: 'deposit_approve',
        target_type: 'deposit_application',
        old_data: { status: 'pending' },
        new_data: { status: 'approved', approved_at: new Date().toISOString() },
        description: '押金申请审核通过: 商家已缴纳1000 USDT押金',
      },
      {
        admin_id: adminId,
        action_type: 'report_handle',
        target_type: 'report',
        description: '处理举报: 商家虚假宣传,已警告处理',
        new_data: { status: 'resolved', action: 'warning' },
      },
      {
        admin_id: adminId,
        action_type: 'announcement_create',
        target_type: 'announcement',
        description: '创建系统公告: 平台维护通知',
        new_data: {
          title: '平台维护通知',
          content: '系统将于明天凌晨2点进行维护',
          type: 'maintenance'
        },
      },
      {
        admin_id: adminId,
        action_type: 'settings_update',
        target_type: 'settings',
        old_data: { registration_points: 10 },
        new_data: { registration_points: 20 },
        description: '更新系统设置: 注册奖励积分从10改为20',
      },
      {
        admin_id: adminId,
        action_type: 'partner_approve',
        target_type: 'partner',
        description: '合作伙伴审核通过: XYZ推广联盟',
        new_data: { status: 'approved' },
      },
      {
        admin_id: adminId,
        action_type: 'refund_approve',
        target_type: 'refund_application',
        description: '退款申请审核通过: 退还商家押金500 USDT',
        old_data: { status: 'pending' },
        new_data: { status: 'approved', refunded_amount: 500 },
      },
    ]

    // 3. 插入日志
    const { data, error } = await supabase
      .from('admin_logs')
      .insert(testLogs)
      .select()

    if (error) {
      console.error('❌ 插入日志失败:', error)
      return
    }

    console.log(`\n✅ 成功插入 ${data.length} 条测试日志`)
    console.log('\n📝 插入的日志列表:')
    data.forEach((log, index) => {
      console.log(`  ${index + 1}. [${log.action_type}] ${log.description || '无描述'}`)
    })

    console.log('\n✅ 测试数据准备完成!')
    console.log('💡 现在可以访问 http://localhost:3010/admin/logs 查看日志页面')

  } catch (err) {
    console.error('❌ 发生错误:', err)
  }
}

insertTestLogs()
  .then(() => {
    console.log('\n✅ 完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })

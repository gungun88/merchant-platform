/**
 * 测试场景：同浏览器退出A账号后注册B账号的问题
 *
 * 问题描述：
 * 1. 浏览器中注册了A账号并验证邮箱
 * 2. 退出A账号
 * 3. 注册B账号
 * 4. 点击B账号的验证邮件
 * 5. 问题：登录后显示的是A账号，而不是B账号
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  try {
    const envPath = path.join(__dirname, '..', '.env.local')
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')

    lines.forEach(line => {
      const match = line.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/)
      if (match) supabaseUrl = match[1].trim()

      const match2 = line.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/)
      if (match2) supabaseAnonKey = match2[1].trim()
    })
  } catch (err) {
    console.log('⚠️ 无法读取 .env.local，将使用代码检查模式')
  }
}

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

async function testSameBrowserReRegister() {
  console.log('🧪 测试同浏览器重新注册场景...\n')

  // 检查 Supabase 配置
  console.log('📋 检查 Supabase 认证配置')
  console.log('━'.repeat(50))

  if (!supabase) {
    console.log('❌ 无法连接到 Supabase，跳过在线测试')
    return
  }

  console.log('✅ Supabase 连接正常')
  console.log('URL:', supabaseUrl)

  // 测试 1: 模拟注册流程
  console.log('\n📋 测试 1: 分析 signUp 行为')
  console.log('━'.repeat(50))

  console.log('\n关键问题：Supabase signUp 的行为')
  console.log('根据 Supabase 文档：')
  console.log('  - 如果 Email Confirmation 开启：signUp 不会自动登录')
  console.log('  - 如果 Email Confirmation 关闭：signUp 会立即创建 session')
  console.log('  - 验证邮件点击后会调用 exchangeCodeForSession')

  // 检查当前是否有 session
  const { data: { session: currentSession } } = await supabase.auth.getSession()
  console.log('\n当前 session 状态:', currentSession ? `✅ 存在 (${currentSession.user.email})` : '❌ 不存在')

  // 测试 2: 检查注册页面实现
  console.log('\n📋 测试 2: 检查注册页面实现')
  console.log('━'.repeat(50))

  const registerPath = path.join(__dirname, '..', 'app', 'auth', 'register', 'page.tsx')
  const registerCode = fs.readFileSync(registerPath, 'utf-8')

  // 检查注册时是否清除旧 session
  const clearsSessionBeforeSignUp = registerCode.match(/signOut.*signUp/s)
  console.log('\n注册前清除 session:', clearsSessionBeforeSignUp ? '✅ 是' : '❌ 否')

  if (!clearsSessionBeforeSignUp) {
    console.log('⚠️ 警告：注册时没有清除旧 session！')
    console.log('   这可能导致以下问题：')
    console.log('   - 如果浏览器中有A账号的残留 session')
    console.log('   - 注册B账号时，localStorage 中可能还保留着A的信息')
    console.log('   - 验证邮件回调时可能混乱')
  }

  // 测试 3: 检查 callback 实现
  console.log('\n📋 测试 3: 检查 callback 实现')
  console.log('━'.repeat(50))

  const callbackPath = path.join(__dirname, '..', 'app', 'auth', 'callback', 'page.tsx')
  const callbackCode = fs.readFileSync(callbackPath, 'utf-8')

  // 检查 callback 是否正确处理 code
  const usesExchangeCode = callbackCode.includes('exchangeCodeForSession')
  const checksDataSession = callbackCode.includes('data.session')
  const logsUserEmail = callbackCode.includes('data.user?.email')

  console.log('\nCallback 实现检查:')
  console.log('  - 使用 exchangeCodeForSession:', usesExchangeCode ? '✅ 是' : '❌ 否')
  console.log('  - 检查 data.session:', checksDataSession ? '✅ 是' : '❌ 否')
  console.log('  - 记录登录的用户:', logsUserEmail ? '✅ 是' : '❌ 否')

  // 测试 4: 分析可能的问题
  console.log('\n📋 测试 4: 问题根源分析')
  console.log('━'.repeat(50))

  console.log('\n可能导致"登录成A账号"的原因：')
  console.log('\n1️⃣ localStorage 缓存问题')
  console.log('   - 退出A账号时，localStorage 没有完全清除')
  console.log('   - 注册B账号时，浏览器中还保留着A的某些信息')
  console.log('   - exchangeCodeForSession 可能读取到旧的缓存')

  console.log('\n2️⃣ Session 混乱')
  console.log('   - 注册B账号后，Supabase 可能创建了临时 session')
  console.log('   - 但这个临时 session 没有被正确清除')
  console.log('   - 验证邮件回调时，可能恢复了旧的 session')

  console.log('\n3️⃣ Cookie 残留')
  console.log('   - 浏览器 Cookie 中可能还保留着A账号的信息')
  console.log('   - 即使 localStorage 清除了，Cookie 还在')
  console.log('   - Supabase 可能从 Cookie 读取了旧 session')

  console.log('\n4️⃣ exchangeCodeForSession 的 code 问题')
  console.log('   - 验证邮件中的 code 可能与预期不符')
  console.log('   - code 可能指向的是A账号而不是B账号')
  console.log('   - 需要检查邮件链接是否正确')

  // 测试 5: 解决方案
  console.log('\n📋 测试 5: 推荐解决方案')
  console.log('━'.repeat(50))

  console.log('\n✅ 方案 1: 注册前强制清除所有认证数据（推荐）')
  console.log('   在注册页面提交前：')
  console.log('   ```typescript')
  console.log('   // 清除所有可能残留的认证数据')
  console.log('   await supabase.auth.signOut()')
  console.log('   ```')

  console.log('\n✅ 方案 2: 改进 callback 页面')
  console.log('   在 callback 页面验证时：')
  console.log('   ```typescript')
  console.log('   // 验证 code 对应的用户是否是预期的')
  console.log('   const { data, error } = await supabase.auth.exchangeCodeForSession(code)')
  console.log('   if (data.user) {')
  console.log('     console.log("验证邮箱成功，登录用户:", data.user.email)')
  console.log('   }')
  console.log('   ```')

  console.log('\n✅ 方案 3: 用户验证')
  console.log('   注册时保存预期的邮箱到 sessionStorage：')
  console.log('   ```typescript')
  console.log('   // 注册时')
  console.log('   sessionStorage.setItem("pending_verification_email", email)')
  console.log('   ')
  console.log('   // callback 时')
  console.log('   const expectedEmail = sessionStorage.getItem("pending_verification_email")')
  console.log('   if (data.user.email !== expectedEmail) {')
  console.log('     console.warn("验证的邮箱与注册的邮箱不匹配")')
  console.log('   }')
  console.log('   ```')

  // 测试 6: 手动测试步骤
  console.log('\n📋 测试 6: 手动测试步骤')
  console.log('━'.repeat(50))

  console.log('\n请按以下步骤进行手动测试：')
  console.log('\n1. 清除浏览器所有数据（localStorage + Cookie）')
  console.log('   - 打开浏览器开发者工具')
  console.log('   - Application -> Clear storage -> Clear site data')

  console.log('\n2. 注册A账号')
  console.log('   - 使用邮箱: testA@example.com')
  console.log('   - 验证邮件并登录')
  console.log('   - 确认导航栏显示 testA@example.com')

  console.log('\n3. 退出A账号')
  console.log('   - 点击导航栏的"退出登录"')
  console.log('   - 确认跳转到首页，导航栏显示"登录"按钮')

  console.log('\n4. 检查浏览器存储')
  console.log('   - 打开 Application -> Local Storage')
  console.log('   - 检查是否还有 sb-xxx-auth-token')
  console.log('   - 如果有，手动删除')

  console.log('\n5. 注册B账号')
  console.log('   - 使用邮箱: testB@example.com')
  console.log('   - 填写注册表单')
  console.log('   - 注意观察 Console 的日志')

  console.log('\n6. 检查验证邮件')
  console.log('   - 打开 testB@example.com 的邮箱')
  console.log('   - 找到验证邮件')
  console.log('   - 复制邮件链接，检查 URL 参数')
  console.log('   - 确认 token_hash 参数存在')

  console.log('\n7. 点击验证链接')
  console.log('   - 观察浏览器跳转过程')
  console.log('   - 观察 Console 的日志输出')
  console.log('   - 重点查看: "Email verification successful, user logged in: xxx"')

  console.log('\n8. 验证登录用户')
  console.log('   - 检查导航栏显示的邮箱')
  console.log('   - 应该显示: testB@example.com')
  console.log('   - 如果显示 testA@example.com，说明问题重现')

  console.log('\n9. 检查 localStorage')
  console.log('   - Application -> Local Storage -> sb-xxx-auth-token')
  console.log('   - 复制 token 内容')
  console.log('   - 解析 JWT token，查看 email 字段')
  console.log('   - 确认 email 是否为 testB@example.com')

  console.log('\n10. 检查 Supabase Dashboard')
  console.log('   - 登录 Supabase Dashboard')
  console.log('   - Authentication -> Users')
  console.log('   - 找到 testB@example.com')
  console.log('   - 检查 "Email Confirmed" 状态')
  console.log('   - 检查 "Last Sign In" 时间')

  // 总结
  console.log('\n')
  console.log('═'.repeat(50))
  console.log('📊 问题总结')
  console.log('═'.repeat(50))

  console.log('\n当前实现的问题:')
  console.log('  ❌ 注册前没有清除旧 session')
  console.log('  ❌ 可能导致 localStorage 残留')
  console.log('  ❌ 验证邮件回调时可能读取到旧数据')

  console.log('\n推荐的修复:')
  console.log('  ✅ 在注册提交前，调用 signOut() 清除所有认证数据')
  console.log('  ✅ 在 callback 中验证登录的用户邮箱')
  console.log('  ✅ 使用 sessionStorage 保存预期的邮箱，用于校验')

  console.log('\n下一步:')
  console.log('  1. 执行上述手动测试步骤，确认问题')
  console.log('  2. 实施推荐的修复方案')
  console.log('  3. 重新测试验证问题是否解决')

  console.log('\n✅ 测试完成！')
}

// 运行测试
testSameBrowserReRegister().catch(err => {
  console.error('❌ 测试失败:', err)
  process.exit(1)
})

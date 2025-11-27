const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      env[key.trim()] = values.join('=').trim();
    }
  });
  return env;
}

/**
 * 健康检查脚本 - 自动检测并修复孤立用户
 * 建议每天运行一次，或作为监控脚本定期执行
 *
 * 使用方法:
 * 1. 手动运行: node scripts/health_check_and_fix.js
 * 2. 定时任务: 添加到 crontab 或 Windows 任务计划程序
 * 3. 监控告警: 结合日志系统，发现问题时发送通知
 */
async function healthCheckAndFix() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`用户数据健康检查 - ${timestamp}`);
  console.log('='.repeat(60));

  let hasIssues = false;
  const report = {
    timestamp,
    orphanUsers: [],
    fixedUsers: [],
    errors: [],
  };

  try {
    // 1. 获取所有 auth 用户
    console.log('\n[1/4] 获取 auth 用户列表...');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ 获取 auth 用户失败:', authError.message);
      report.errors.push({ step: 'fetch_auth_users', error: authError.message });
      return report;
    }

    console.log(`✓ 找到 ${authData.users.length} 个 auth 用户`);

    // 2. 获取所有 profiles
    console.log('\n[2/4] 获取 profiles 列表...');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id');

    if (profileError) {
      console.error('❌ 获取 profiles 失败:', profileError.message);
      report.errors.push({ step: 'fetch_profiles', error: profileError.message });
      return report;
    }

    console.log(`✓ 找到 ${profiles.length} 个 profile 记录`);

    // 3. 检测孤立用户
    console.log('\n[3/4] 检测孤立用户...');
    const profileIds = new Set(profiles.map(p => p.id));
    const orphanUsers = authData.users.filter(user => !profileIds.has(user.id));

    if (orphanUsers.length === 0) {
      console.log('✅ 没有发现孤立用户');
      console.log(`\n健康状态: 良好 ✓`);
      console.log(`- Auth 用户: ${authData.users.length}`);
      console.log(`- Profile 记录: ${profiles.length}`);
      console.log(`- 孤立用户: 0`);
      return report;
    }

    hasIssues = true;
    console.log(`⚠️  发现 ${orphanUsers.length} 个孤立用户，开始自动修复...\n`);
    report.orphanUsers = orphanUsers.map(u => ({ id: u.id, email: u.email }));

    // 4. 自动修复孤立用户
    console.log('[4/4] 自动修复孤立用户...');

    // 获取下一个用户编号
    const { data: maxUserNumber } = await supabase
      .from('profiles')
      .select('user_number')
      .order('user_number', { ascending: false })
      .limit(1);

    let nextUserNumber = (maxUserNumber && maxUserNumber.length > 0)
      ? maxUserNumber[0].user_number + 1
      : 100001;

    for (const authUser of orphanUsers) {
      console.log(`\n  修复: ${authUser.email}`);

      try {
        const username = authUser.user_metadata?.username || authUser.email.split('@')[0];

        // 生成邀请码
        const { data: invitationCode } = await supabase.rpc('generate_invitation_code');
        const finalInvitationCode = invitationCode || `U${Date.now().toString(36).toUpperCase().slice(-6)}`;

        // 创建 profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            username: username,
            email: authUser.email,
            user_number: nextUserNumber,
            invitation_code: finalInvitationCode,
            role: 'user',
            is_banned: false,
            points: 100,
            report_count: 0,
            created_at: authUser.created_at,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`  ❌ 修复失败: ${insertError.message}`);
          report.errors.push({
            step: 'fix_user',
            userId: authUser.id,
            email: authUser.email,
            error: insertError.message
          });
          continue;
        }

        console.log(`  ✓ 修复成功 (用户编号: ${nextUserNumber})`);
        report.fixedUsers.push({
          id: authUser.id,
          email: authUser.email,
          userNumber: nextUserNumber
        });

        // 记录积分（静默失败）
        try {
          await supabase.rpc('record_point_transaction', {
            p_user_id: authUser.id,
            p_amount: 100,
            p_type: 'registration',
            p_description: '注册赠送积分（自动修复补发）+100积分',
            p_related_user_id: null,
            p_related_merchant_id: null,
            p_metadata: { source: 'health_check_auto_fix', timestamp },
          });
        } catch (err) {
          // 积分记录失败不影响主流程
        }

        nextUserNumber++;

      } catch (error) {
        console.error(`  ❌ 处理异常: ${error.message}`);
        report.errors.push({
          step: 'fix_user',
          userId: authUser.id,
          email: authUser.email,
          error: error.message
        });
      }
    }

    // 输出报告
    console.log(`\n${'='.repeat(60)}`);
    console.log('修复完成');
    console.log('='.repeat(60));
    console.log(`✓ 成功修复: ${report.fixedUsers.length} 个用户`);
    console.log(`✗ 修复失败: ${report.errors.filter(e => e.step === 'fix_user').length} 个用户`);

    if (report.errors.length > 0) {
      console.log(`\n错误详情:`);
      report.errors.forEach(err => {
        console.log(`  - [${err.step}] ${err.email || 'N/A'}: ${err.error}`);
      });
    }

  } catch (error) {
    console.error('\n❌ 健康检查异常:', error.message);
    report.errors.push({ step: 'health_check', error: error.message });
  }

  // 保存报告到文件
  const reportPath = path.join(__dirname, `health_check_report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n报告已保存到: ${reportPath}`);

  // 如果有问题，返回非零退出码（用于监控告警）
  if (hasIssues && report.errors.length > 0) {
    console.log('\n⚠️  检测到问题且部分修复失败，请检查日志');
    process.exit(1);
  } else if (hasIssues) {
    console.log('\n✅ 检测到问题但已全部修复');
  }

  return report;
}

// 运行健康检查
healthCheckAndFix().catch(error => {
  console.error('健康检查脚本异常:', error);
  process.exit(1);
});

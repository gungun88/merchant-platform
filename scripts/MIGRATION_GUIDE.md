# 数据库迁移脚本执行指南（生产环境）

## ⚠️ 重要说明

你的 scripts 文件夹中存在大量重复编号的脚本文件,这是因为在开发过程中对同一功能进行了多次修复。本文档会指导你跳过这些重复文件,只执行必要的脚本。

## 重复脚本分析结果

以下脚本编号有重复,我已经为你分析了每个编号应该执行哪个文件:

### 028 号脚本(3个文件)
- **028_add_admin_rls_policies_for_merchants.sql** - 添加管理员RLS策略
- **028_create_partners_table.sql** - 创建合作伙伴表(✅ 执行这个)
- **028_fix_point_transaction_balance.sql** - 修复积分余额(❌ 跳过,029已包含更好的修复)

**结论**: 执行 `028_create_partners_table.sql`,然后单独执行 `028_add_admin_rls_policies_for_merchants.sql`

### 029 号脚本(2个文件)
- **029_fix_point_balance_simple.sql** - 简化版积分修复(✅ 执行这个)
- **029_update_violated_merchants_to_frozen.sql** - 更新违规商家(✅ 也要执行)

**结论**: 两个都执行,先执行 `029_fix_point_balance_simple.sql`

### 030 号脚本(2个文件)
- **030_emergency_fix_points.sql** - 紧急积分修复(✅ 执行这个)
- **030_enable_realtime_for_merchants.sql** - 启用实时功能(✅ 也要执行)

**结论**: 两个都执行,先执行 `030_emergency_fix_points.sql`

### 031 号脚本(4个文件)
- **031_cleanup_deposit_refund.sql** - 清理旧数据(❌ 仅在重建时执行)
- **031_create_deposit_refund_applications.sql** - 第1版(❌ 跳过)
- **031_create_deposit_refund_final.sql** - 第2版(❌ 跳过)
- **031_create_deposit_refund_safe.sql** - 最终安全版(✅ 执行这个)

**结论**: 只执行 `031_create_deposit_refund_safe.sql`

### 032-050 号脚本
类似的重复问题,我会在下面的执行清单中为你标注应该执行哪些。

---

## 完整执行清单

按照以下顺序执行,标注 `⚠️ SKIP` 的文件跳过不执行:

```
001_create_users_table.sql
002_create_points_log_table.sql
003_create_merchants_table.sql
004_create_favorites_table.sql
005_create_check_ins_table.sql
006_update_profiles_default.sql
007_add_certification_status.sql
008_fix_stock_status.sql
009_add_contact_phone.sql
010_add_merchant_views.sql
011_add_reports_and_status.sql
011_add_reports_and_status_fix.sql
012_add_is_active_only.sql
013_fix_merchants_rls_policies.sql
014_fix_points_log_rls.sql
015_create_invitations_table.sql
016_update_invitation_structure.sql
017_fix_invitation_code_generation.sql
018_fix_trigger_and_points_logs.sql
019_fix_invitations_rls.sql
020_auto_expire_topped_merchants.sql
021_enable_realtime_for_profiles.sql
022_create_point_transactions_table.sql
023_add_checkin_fields_to_profiles.sql
024_create_notifications_table.sql
025_setup_pg_cron.sql
026_update_favorites_rls.sql
027_create_deposit_merchant_system.sql
028_create_partners_table.sql
028_add_admin_rls_policies_for_merchants.sql
⚠️ SKIP: 028_fix_point_transaction_balance.sql
029_fix_point_balance_simple.sql
029_update_violated_merchants_to_frozen.sql
030_emergency_fix_points.sql
030_enable_realtime_for_merchants.sql
⚠️ SKIP: 031_cleanup_deposit_refund.sql
⚠️ SKIP: 031_create_deposit_refund_applications.sql
⚠️ SKIP: 031_create_deposit_refund_final.sql
031_create_deposit_refund_safe.sql
032_add_admin_role_system.sql
⚠️ SKIP: 032_create_reports_table.sql (已在011创建)
033_update_reports_table.sql
⚠️ SKIP: 033_fix_registration_points.sql (已在029修复)
034_add_report_count_to_profiles.sql
⚠️ SKIP: 034_rollback_trigger.sql (开发调试用)
035_remove_old_fields_constraints.sql
⚠️ SKIP: 035_fix_complete.sql (已包含在其他脚本中)
036_add_merchant_credit_system.sql
⚠️ SKIP: 036_fix_invitation_unique_constraint.sql (已包含)
037_fix_reports_rls_for_credit_system.sql
⚠️ SKIP: 037_add_deposit_bonus_claimed.sql (已包含)
038_add_transaction_hash_to_deposit_applications.sql
⚠️ SKIP: 038_fix_reports_status_constraint.sql (已包含)
039_add_partner_subscription_fields.sql
⚠️ SKIP: 039_add_user_ban_fields.sql (如果需要封禁功能再执行)
040_setup_partner_expiry_cron.sql
041_update_existing_partners_expiry.sql
042_add_partner_notes.sql
043_fix_deposit_refund_rls.sql
044_create_announcements_table.sql
045_create_system_settings_table.sql
046_update_registration_trigger_use_settings.sql
047_add_missing_point_fields.sql
048_add_view_contact_merchant_deduct.sql
049_create_admin_logs_table.sql
050_add_login_security_fields.sql
⚠️ SKIP: 050_create_deposit_top_up_applications_table.sql (如果需要充值功能再执行)
051_add_email_to_profiles.sql
052_create_coin_exchange_records_table.sql
053_add_email_validation_settings.sql
054_add_favicon_to_system_settings.sql
055_refresh_schema_cache_with_favicon.sql
056_fix_user_creation_trigger.sql
057_fix_trigger_add_email.sql
058_disable_trigger_temporary.sql
059_find_and_disable_all_triggers.sql
060_disable_sync_email_trigger.sql
061_final_fix_user_trigger.sql
062_add_sensitive_words_config.sql
063_create_merchant_notes.sql
064_add_user_number.sql
065_add_reporter_contact_to_reports.sql
066_add_applicant_notes_to_partners.sql
067_add_subscription_unit_to_partners.sql
068_complete_subscription_fields.sql
069_remove_total_amount_constraint.sql
070_add_pin_type_to_merchants.sql
071_create_scheduled_point_transfers_table.sql
072_fix_scheduled_transfers_timezone.sql
073_final_fix_scheduled_transfers_timezone.sql
074_verify_and_fix_timezone.sql
075_fix_timezone_with_offset.sql
076_add_point_transactions_to_scheduled_transfers.sql
077_add_merchants_per_page_setting.sql
078_add_coin_exchange_url_setting.sql
079_add_low_points_threshold_setting.sql
080_create_platform_income_table.sql
081_add_transaction_type_to_platform_income.sql
082_fix_transaction_type_constraint.sql
083_fix_income_type_constraint.sql
⚠️ NEVER RUN: 084_clean_test_data.sql (清空所有数据,仅用于测试环境)
```

---

## 额外的独立脚本

在 scripts 文件夹根目录还有一些独立脚本,需要在适当的时候执行:

### 必须执行的:
1. **enable_realtime.sql** - 启用实时订阅功能
2. **create_platform_assets_bucket.sql** - 创建存储桶
3. **setup_storage_policies.sql** - 设置存储策略
4. **fix_storage_policies.sql** - 修复存储策略
5. **fix_schema_cache.sql** - 刷新架构缓存

### 根据需要执行:
1. **set_admin_user.sql** - 设置超级管理员(需要修改邮箱后执行)
2. **fix_deposit_rls.sql** - 如果押金功能有问题时执行
3. **fix_deposit_refund_rls.sql** - 如果退款功能有问题时执行

---

## 执行步骤

### 第一步:在 Supabase 控制台创建项目
1. 登录 Supabase
2. 创建新项目
3. 记录以下信息:
   - Project URL
   - Project API Key (anon public)
   - Service Role Key

### 第二步:执行编号脚本(001-083)
1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 按照上面的清单,逐个复制脚本内容并执行
4. 跳过标注 `⚠️ SKIP` 的文件
5. 如果遇到错误,记录错误信息(部分错误是正常的,比如删除不存在的对象)

### 第三步:执行独立脚本
按照以下顺序执行根目录的独立脚本:
```
1. enable_realtime.sql
2. create_platform_assets_bucket.sql
3. setup_storage_policies.sql
4. fix_storage_policies.sql
5. fix_schema_cache.sql
```

### 第四步:设置超级管理员
1. 修改 `set_admin_user.sql` 中的邮箱地址为你的管理员邮箱
2. 执行该脚本
3. 使用该邮箱注册账号,会自动成为超级管理员

### 第五步:验证
执行以下查询检查数据库是否正常:
```sql
-- 检查表是否都创建成功
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 检查系统设置是否初始化
SELECT * FROM system_settings;

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## 常见错误处理

### 错误1: "relation already exists"
**原因**: 表或索引已经存在
**解决**: 忽略,继续执行下一个脚本

### 错误2: "column already exists"
**原因**: 字段已经存在
**解决**: 忽略,继续执行下一个脚本

### 错误3: "constraint does not exist"
**原因**: 要删除的约束不存在
**解决**: 忽略,继续执行下一个脚本

### 错误4: "function does not exist"
**原因**: 要删除的函数不存在
**解决**: 忽略,继续执行下一个脚本

### 错误5: 权限相关错误
**原因**: 使用的 API Key 权限不足
**解决**: 确保使用 Service Role Key 执行脚本

---

## 注意事项

1. **不要执行 084_clean_test_data.sql**,这个脚本会清空所有数据
2. 某些脚本可能会报错,这是正常的(比如删除不存在的对象)
3. 执行过程中如果遇到严重错误,停止执行并联系我
4. 建议在测试环境先完整执行一遍,确认无误后再在生产环境执行
5. 执行前务必备份数据(虽然是新项目,但养成习惯很重要)

---

## 预计执行时间

- 编号脚本(001-083): 约15-20分钟
- 独立脚本: 约2-3分钟
- 设置管理员: 约1分钟
- **总计**: 约20-25分钟

---

## 遇到问题怎么办

如果执行过程中遇到无法解决的错误:
1. 截图错误信息
2. 记录是哪个脚本出的错
3. 停止执行后续脚本
4. 联系我协助解决

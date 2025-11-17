# 数据库迁移脚本 - 简化执行指南

## ✅ 已完成的整理工作

1. **移除了不需要的重复脚本** - 已移到 `archived/` 文件夹
2. **当前 scripts 文件夹只保留必要的脚本** - 直接按顺序执行即可

---

## 📋 执行方式

你现在有两个选择:

### 方式一:手动逐个执行(推荐)

**优点**: 更安全,可以及时发现问题
**耗时**: 约20-30分钟

在 Supabase SQL Editor 中,按照文件名顺序,逐个复制粘贴并执行:

```
001_create_users_table.sql
002_create_points_log_table.sql
003_create_merchants_table.sql
... (按数字顺序执行所有 0XX 开头的文件)
```

### 方式二:使用我提供的合并脚本(快速)

**优点**: 一次性执行完成
**缺点**: 如果出错需要定位问题

我可以为你创建一个合并所有SQL的单一文件,复制粘贴一次就完成。

---

## 📝 执行前准备

### 1. 创建 Supabase 项目
1. 访问 https://supabase.com
2. 创建新项目
3. 记录以下信息:
   - Project URL: `https://xxx.supabase.co`
   - Project API Key (anon public)
   - Service Role Key

### 2. 准备执行环境
1. 打开 Supabase Dashboard
2. 进入左侧菜单 → SQL Editor
3. 准备开始执行脚本

---

## 🚀 完整的脚本列表

当前 scripts 文件夹中保留的脚本(按执行顺序):

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
028_add_admin_rls_policies_for_merchants.sql
028_create_partners_table.sql
029_fix_point_balance_simple.sql
029_update_violated_merchants_to_frozen.sql
030_emergency_fix_points.sql
030_enable_realtime_for_merchants.sql
031_create_deposit_refund_safe.sql
032_add_admin_role_system.sql
033_update_reports_table.sql
034_add_report_count_to_profiles.sql
035_remove_old_fields_constraints.sql
036_add_merchant_credit_system.sql
037_fix_reports_rls_for_credit_system.sql
038_add_transaction_hash_to_deposit_applications.sql
039_add_partner_subscription_fields.sql
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
```

**总计**: 约 80 个脚本

---

## ⚠️ 额外的独立脚本(必须执行)

在完成上述脚本后,还需要执行 scripts 根目录下的这些独立脚本:

```
1. enable_realtime.sql
2. create_platform_assets_bucket.sql
3. setup_storage_policies.sql
4. fix_storage_policies.sql
5. fix_schema_cache.sql
```

---

## 🔧 设置超级管理员

执行完所有脚本后:

1. 打开 `scripts/set_admin_user.sql`
2. 修改其中的邮箱地址为你的管理员邮箱
3. 执行该脚本
4. 使用该邮箱注册账号,会自动获得超级管理员权限

---

## ⏱️ 预计时间

- 编号脚本(001-083): 约15-20分钟
- 独立脚本: 约2-3分钟
- 设置管理员: 约1分钟
- **总计**: 约20-25分钟

---

## ❓ 你想要哪种方式?

请告诉我:
1. **手动执行** - 我已经整理好了脚本,你按顺序执行即可
2. **自动合并** - 我创建一个大的SQL文件,一次性粘贴执行

选择后我会继续协助你!

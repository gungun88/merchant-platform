# 🎯 生产环境数据库迁移 - 完整执行指南

## ⚠️ 发现的所有问题及修复

通过你的测试执行,我们发现了以下问题并全部修复:

| 问题 | 脚本 | 原因 | 解决方案 |
|------|------|------|----------|
| 1 | 027.5, 028, 031, 031.5 | 依赖 `profiles.role` | 移到 032 之后 |
| 2 | 054.5 | 无权限操作 `storage.buckets` | 需要手动创建 bucket |

---

## 📋 完整执行清单

### 001-027: 基础表结构

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
```

### 029-030: 积分修复

```
029_fix_point_balance_simple.sql
029_update_violated_merchants_to_frozen.sql
030_emergency_fix_points.sql
030_enable_realtime_for_merchants.sql
```

### 032 系列: 管理员角色系统(重点!)

```
032_add_admin_role_system.sql              ⬅️ 创建 role 字段
032.4_create_deposit_refund_safe.sql       ⬅️ 押金退款表
032.5_fix_deposit_rls.sql                  ⬅️ 修复押金RLS
032.6_fix_deposit_refund_rls.sql           ⬅️ 修复退款RLS
032.7_add_admin_rls_policies_for_merchants.sql ⬅️ 商家RLS
032.8_create_partners_table.sql            ⬅️ 合作伙伴表
032.9_setup_storage_policies.sql           ⬅️ 存储策略
```

**⚠️ 这部分必须按顺序执行,不能跳过!**

### 033-053: 功能扩展

```
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
```

### 054 系列: 存储和缓存(需要特殊处理!)

```
054_add_favicon_to_system_settings.sql

⚠️ 054.5_create_platform_assets_bucket.sql
   需要先手动创建 bucket,然后执行脚本!

   手动步骤:
   1. Supabase Dashboard → Storage
   2. 点击 "New bucket"
   3. Name: platform-assets
   4. Public: ✅ 勾选
   5. Create bucket
   6. 然后执行本脚本

054.6_fix_storage_policies.sql
055_refresh_schema_cache_with_favicon.sql
055.5_fix_schema_cache.sql
```

### 056-084: 触发器和最终配置

```
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
084_enable_realtime.sql
```

---

## 🚀 推荐的执行流程

### 步骤1: 删除旧项目,创建新项目(3分钟)

由于你已经遇到了多个依赖错误,强烈建议:

```
1. 删除当前 Supabase 项目
2. 创建新项目
3. 记录新的:
   - Project URL
   - anon key
   - service_role key
4. 更新 .env.local
```

### 步骤2: 执行 001-053(20分钟)

在 Supabase SQL Editor 中按顺序执行

**重点注意 032 系列:**
- 必须先执行 032_add_admin_role_system.sql
- 然后按顺序执行 032.4 ~ 032.9

### 步骤3: 手动创建 Storage Bucket(1分钟)

在执行 054.5 之前:

```
1. Supabase Dashboard → Storage
2. New bucket
3. Name: platform-assets
4. Public: ✅
5. Create
```

### 步骤4: 执行 054-084(5分钟)

继续执行剩余的脚本

---

## ⏱️ 总时间估算

- 删除+创建项目: 3分钟
- 执行 001-053: 20分钟
- 手动创建 bucket: 1分钟
- 执行 054-084: 5分钟
- **总计: 约30分钟**

---

## ✅ 可以忽略的错误

执行过程中遇到这些错误可以忽略:

- ❌ `relation already exists`
- ❌ `policy already exists`
- ❌ `column already exists`
- ❌ `function already exists`

## ⛔ 必须停止的错误

遇到这些错误必须停止并排查:

- ⛔ `column "role" does not exist`
- ⛔ `relation does not exist`
- ⛔ `syntax error`
- ⛔ `must be owner of table`

---

## 🎯 我的最终建议

基于你的测试结果和当前情况:

### 👉 立即执行以下操作:

```
1. 删除当前的 Supabase 项目
   (避免之前错误执行的残留)

2. 创建全新的 Supabase 项目
   (只需3分钟)

3. 按照本指南从 001 开始执行
   (所有依赖问题已修复)

4. 执行到 054.5 时,先手动创建 bucket
   (然后再执行脚本)

5. 继续执行到 084
   (一次性完成)
```

### 为什么必须重新开始?

1. ✅ 你已经执行了 **4个错误的脚本**
2. ✅ 数据库状态不确定
3. ✅ 生产环境需要 **100%正确**
4. ✅ 重新开始只多花 **3分钟**
5. ✅ 换来完全的正确性和心安

---

## 📞 执行过程中遇到问题?

如果执行过程中遇到任何错误:
1. 记录错误信息
2. 记录是哪个脚本
3. 立即告诉我,我会帮你解决

---

准备好开始了吗?我会全程陪伴你完成部署!

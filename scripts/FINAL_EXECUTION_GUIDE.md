# 数据库迁移脚本 - 完整执行清单(最终版)

## ✅ 整理完成

所有脚本已经按照正确的执行顺序编号,包括之前没有编号的8个脚本。

---

## 📋 完整执行顺序

按照以下顺序执行 scripts 文件夹中的所有SQL脚本:

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
027.5_fix_deposit_rls.sql                    ⬅️ 新增:修复押金RLS策略
028_add_admin_rls_policies_for_merchants.sql
028_create_partners_table.sql
028.5_setup_storage_policies.sql             ⬅️ 新增:设置存储策略
029_fix_point_balance_simple.sql
029_update_violated_merchants_to_frozen.sql
030_emergency_fix_points.sql
030_enable_realtime_for_merchants.sql
031_create_deposit_refund_safe.sql
031.5_fix_deposit_refund_rls.sql             ⬅️ 新增:修复退款RLS策略
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
054.5_create_platform_assets_bucket.sql      ⬅️ 新增:创建平台资源存储桶
054.6_fix_storage_policies.sql               ⬅️ 新增:修复存储策略
055_refresh_schema_cache_with_favicon.sql
055.5_fix_schema_cache.sql                   ⬅️ 新增:刷新PostgREST缓存
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
084_enable_realtime.sql                      ⬅️ 新增:启用实时订阅功能
```

**总计**: 86 个脚本

---

## 🆕 新增的脚本说明

### 027.5_fix_deposit_rls.sql
- **位置**: 在押金系统创建后立即执行
- **作用**: 修复押金申请表的RLS策略,确保管理员和用户都能正确访问

### 028.5_setup_storage_policies.sql
- **位置**: 在合作伙伴表创建后执行
- **作用**: 设置合作伙伴Logo上传的存储策略

### 031.5_fix_deposit_refund_rls.sql
- **位置**: 在退款申请表创建后执行
- **作用**: 修复退款申请表的RLS策略

### 054.5_create_platform_assets_bucket.sql
- **位置**: 在系统设置表创建后执行
- **作用**: 创建平台资源存储桶(用于存储favicon等)

### 054.6_fix_storage_policies.sql
- **位置**: 在存储桶创建后立即执行
- **作用**: 修复存储策略,确保认证用户可以上传文件

### 055.5_fix_schema_cache.sql
- **位置**: 在刷新缓存后执行
- **作用**: 通知PostgREST重新加载架构,添加缺失字段

### 084_enable_realtime.sql
- **位置**: 最后执行
- **作用**: 为押金相关表启用实时订阅功能

---

## 🔧 特殊脚本:999_set_admin_user.sql

这个脚本需要**单独执行**,在所有迁移完成后:

1. 先注册一个账号
2. 修改脚本中的邮箱地址为你的账号邮箱
3. 执行脚本,将该账号设置为管理员

---

## ⚠️ 已归档的脚本

以下脚本已移动到 `archived/` 文件夹,**不需要执行**:

```
028_fix_point_transaction_balance.sql
031_cleanup_deposit_refund.sql
031_create_deposit_refund_applications.sql
031_create_deposit_refund_final.sql
032_create_reports_table.sql
033_fix_registration_points.sql
034_rollback_trigger.sql
035_fix_complete.sql
036_fix_invitation_unique_constraint.sql
037_add_deposit_bonus_claimed.sql
038_fix_reports_status_constraint.sql
039_add_user_ban_fields.sql
050_create_deposit_top_up_applications_table.sql
084_clean_test_data.sql  ⚠️ 危险:会清空所有数据
```

---

## 🚀 执行步骤

### 第一步:创建 Supabase 项目
1. 访问 https://supabase.com
2. 创建新项目
3. 记录项目信息(URL和API Keys)

### 第二步:执行迁移脚本
1. 打开 Supabase Dashboard → SQL Editor
2. 按照上面的清单,逐个复制粘贴并执行
3. 遇到 "already exists" 等错误可以忽略
4. 如果有严重错误,停止并排查问题

### 第三步:设置管理员
1. 在前端注册一个账号
2. 修改 `999_set_admin_user.sql` 中的邮箱
3. 执行该脚本

---

## ⏱️ 预计时间

- **全部脚本**: 约 25-30 分钟
- **设置管理员**: 约 2 分钟
- **总计**: 约 30 分钟

---

## ✨ 现在你可以开始执行了!

所有脚本已经按照正确的顺序编号,直接从001开始,按顺序执行即可。

如果你想要一键执行的合并脚本,请告诉我,我会创建一个大的SQL文件!

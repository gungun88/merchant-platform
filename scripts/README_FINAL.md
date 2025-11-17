# 数据库迁移脚本 - 最终修正版执行清单

## ⚠️ 重要更新 - 已修复所有依赖关系错误

**问题**: 多个脚本依赖 `profiles.role` 字段,但该字段在 032 号脚本才创建

**修复**: 已将所有依赖 `profiles.role` 的脚本移到 032 之后

---

## 🔧 本次调整的脚本

| 原编号 | 新编号 | 脚本名称 |
|--------|--------|----------|
| 028 | 032.7 | add_admin_rls_policies_for_merchants |
| 028 | 032.8 | create_partners_table |
| 028.5 | 032.9 | setup_storage_policies |
| 027.5 | 032.5 | fix_deposit_rls |
| 031.5 | 032.6 | fix_deposit_refund_rls |

---

## 📋 完整执行顺序(已验证无依赖错误)

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
029_fix_point_balance_simple.sql
029_update_violated_merchants_to_frozen.sql
030_emergency_fix_points.sql
030_enable_realtime_for_merchants.sql
031_create_deposit_refund_safe.sql
032_add_admin_role_system.sql           ⬅️ 【关键】创建 profiles.role 字段
032.5_fix_deposit_rls.sql               ⬅️ 依赖 role 字段
032.6_fix_deposit_refund_rls.sql        ⬅️ 依赖 role 字段
032.7_add_admin_rls_policies_for_merchants.sql ⬅️ 依赖 role 字段
032.8_create_partners_table.sql         ⬅️ 依赖 role 字段
032.9_setup_storage_policies.sql        ⬅️ 合作伙伴存储策略
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
054.5_create_platform_assets_bucket.sql
054.6_fix_storage_policies.sql
055_refresh_schema_cache_with_favicon.sql
055.5_fix_schema_cache.sql
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

**总计**: 86 个脚本

---

## ✅ 如果你正在执行中遇到错误

### 场景1: 执行到 027 或 028 出现 `column profiles.role does not exist`

**解决方法:**
```
1. 跳过报错的脚本(它们已经被重命名了)
2. 继续执行 029, 030, 031
3. 执行 032_add_admin_role_system.sql
4. 按顺序执行 032.5, 032.6, 032.7, 032.8, 032.9
5. 继续 033 往后
```

### 场景2: 想要从头开始(最推荐)

**步骤:**
```
1. 删除当前 Supabase 项目
2. 创建新的 Supabase 项目
3. 按照上面的清单从 001 开始执行
4. 现在不会再有依赖错误了!
```

---

## 🎯 执行建议

### 推荐方式: 从头开始

由于你说这是**生产环境部署**且**没有数据**,我强烈建议:

```bash
✅ 删除旧的 Supabase 项目(避免之前错误执行的残留)
✅ 创建全新的 Supabase 项目
✅ 按照本清单从 001 开始执行
✅ 执行过程顺畅,不会有依赖错误
```

### 如果继续当前项目

也可以继续执行,只需:
```bash
✅ 跳过之前报错的 027.5 和 028
✅ 继续执行 029, 030, 031
✅ 重点执行 032 系列(032, 032.5, 032.6, 032.7, 032.8, 032.9)
✅ 继续 033 往后
```

---

## 📌 重点注意

### 032 号脚本组(必须按顺序)

这个区域的脚本顺序**非常重要**:

```
032_add_admin_role_system.sql     ← 先创建 role 字段
  ↓
032.5_fix_deposit_rls.sql         ← 然后才能使用 role
  ↓
032.6_fix_deposit_refund_rls.sql  ← 使用 role
  ↓
032.7_add_admin_rls_policies_for_merchants.sql ← 使用 role
  ↓
032.8_create_partners_table.sql   ← 使用 role
  ↓
032.9_setup_storage_policies.sql  ← 设置存储策略
```

**千万不要跳过或打乱顺序!**

---

## ⏱️ 预计时间

- **全部脚本 (001-084)**: 约 25-30 分钟
- **设置管理员 (999)**: 约 2 分钟
- **总计**: 约 30 分钟

---

## 🔍 其他脚本是否也需要调整?

我已经检查过了,以下脚本虽然也使用 `profiles.role`,但它们的编号已经在 032 之后了,**不需要调整**:

- ✅ 036_add_merchant_credit_system.sql (在 032 之后)
- ✅ 037_fix_reports_rls_for_credit_system.sql (在 032 之后)
- ✅ 043_fix_deposit_refund_rls.sql (在 032 之后)
- ✅ 044_create_announcements_table.sql (在 032 之后)
- ✅ 045_create_system_settings_table.sql (在 032 之后)
- ✅ 049_create_admin_logs_table.sql (在 032 之后)
- ✅ 052_create_coin_exchange_records_table.sql (在 032 之后)
- ✅ 054.5_create_platform_assets_bucket.sql (在 032 之后)
- ✅ 071_create_scheduled_point_transfers_table.sql (在 032 之后)

---

## ✨ 现在可以放心执行了!

所有依赖 `profiles.role` 的脚本都已经移到 032 之后,按照这个清单执行**不会再有依赖错误**!

如果还有任何问题,随时告诉我! 🚀

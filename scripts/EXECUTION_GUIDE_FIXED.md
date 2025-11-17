# 数据库迁移脚本 - 完整执行清单(已修复依赖关系)

## ✅ 2024更新: 修复了脚本依赖关系

**修复内容:**
- 将 `027.5_fix_deposit_rls.sql` 移到 `032.5` (在 role 字段创建后)
- 将 `031.5_fix_deposit_refund_rls.sql` 移到 `032.6` (在 role 字段创建后)

---

## 📋 完整执行顺序(按此顺序执行不会出错)

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
028.5_setup_storage_policies.sql
029_fix_point_balance_simple.sql
029_update_violated_merchants_to_frozen.sql
030_emergency_fix_points.sql
030_enable_realtime_for_merchants.sql
031_create_deposit_refund_safe.sql
032_add_admin_role_system.sql                ⬅️ 创建 role 字段
032.5_fix_deposit_rls.sql                    ⬅️ 修正位置(依赖 role 字段)
032.6_fix_deposit_refund_rls.sql             ⬅️ 修正位置(依赖 role 字段)
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

## 🔥 重要提醒

### ⚠️ 如果你已经执行到 027.5 并出错:

**不用担心!继续按照以下步骤:**

1. **跳过** 027.5 (因为已经改名为 032.5)
2. 继续执行 028, 029, 030, 031, 032
3. 执行到 032 之后,再执行:
   - 032.5_fix_deposit_rls.sql
   - 032.6_fix_deposit_refund_rls.sql
4. 然后继续 033 往后

---

## 📝 依赖关系说明

这次调整的原因:

| 脚本 | 依赖 | 说明 |
|------|------|------|
| 032_add_admin_role_system.sql | - | **创建 profiles.role 字段** |
| 032.5_fix_deposit_rls.sql | 032 | 需要 profiles.role 字段 |
| 032.6_fix_deposit_refund_rls.sql | 032 | 需要 profiles.role 字段 |

---

## 🚀 执行建议

### 方案1: 从头开始(最推荐)
如果你刚开始执行迁移:
```
✅ 删除旧的 Supabase 项目
✅ 创建新项目
✅ 按照上面的清单从 001 开始执行
```

### 方案2: 继续当前进度
如果你已经执行到 027:
```
✅ 跳过 027.5 的错误(没关系)
✅ 继续执行 028-032
✅ 执行 032 后,再执行 032.5 和 032.6
✅ 继续 033 往后
```

---

## ⏱️ 预计时间

- **全部脚本**: 约 25-30 分钟
- **设置管理员**: 约 2 分钟
- **总计**: 约 30 分钟

---

## 💡 提示

执行过程中遇到以下错误可以**忽略**:
- ❌ `relation already exists` - 表已存在
- ❌ `policy already exists` - 策略已存在
- ❌ `column already exists` - 字段已存在

但如果遇到以下错误需要**停止**:
- ⛔ `column does not exist` - 缺少字段(依赖关系错误)
- ⛔ `relation does not exist` - 缺少表(执行顺序错误)
- ⛔ `syntax error` - SQL语法错误

---

## 📞 遇到问题?

如果执行过程中遇到任何错误:
1. 截图错误信息
2. 记录是哪个脚本出错
3. 告诉我,我会立即帮你解决!

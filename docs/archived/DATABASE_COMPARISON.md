# 开发环境 vs 生产环境 - 表对比

## 开发环境的表 (25个):
1. admin_logs
2. admin_operation_logs
3. announcements
4. check_ins ⭐ (生产环境可能缺失)
5. coin_exchange_records
6. credit_logs ⭐ (生产环境可能缺失)
7. daily_login_rewards ⭐ (生产环境可能缺失)
8. deposit_merchant_applications
9. deposit_refund_applications
10. deposit_refund_requests ⭐ (生产环境可能缺失)
11. deposit_top_up_applications
12. deposit_violation_records ⭐ (生产环境可能缺失)
13. favorites
14. invitations
15. merchant_notes
16. merchants
17. notifications
18. partners
19. platform_income
20. point_transactions
21. points_log ⭐ (生产环境可能缺失)
22. profiles
23. reports
24. scheduled_point_transfers
25. system_settings

## 关键发现:
开发环境有一些额外的表，这些可能是：
- check_ins: 签到记录表
- credit_logs: 信用日志
- daily_login_rewards: 每日登录奖励
- deposit_refund_requests: 押金退款请求（可能是旧版本）
- deposit_violation_records: 押金违规记录
- points_log: 积分日志（可能被 point_transactions 替代）

这些表可能是开发过程中创建的，但部分可能在生产环境中不需要。

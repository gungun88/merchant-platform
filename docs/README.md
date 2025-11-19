# 📚 项目文档目录

本文件夹包含项目的所有技术文档，按用途分类。

---

## 📂 文件夹结构

```
docs/
├── deployment/          # 🚀 部署和环境配置
├── troubleshooting/     # 🔧 问题排查和修复
├── guides/              # 📖 功能使用指南
├── admin/               # 👑 管理员系统文档
└── archived/            # 🗂️ 历史记录和开发日志
```

---

## 🚀 deployment/ - 部署相关

### 数据库部署
- **[DATABASE_DEPLOYMENT_GUIDE.md](deployment/DATABASE_DEPLOYMENT_GUIDE.md)** - 数据库部署指南（全新 vs 增量）

### 项目部署
- **[DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md)** - 项目完整部署指南
- **[QUICK_START_GUIDE.md](deployment/QUICK_START_GUIDE.md)** - 快速开始指南

### 定时任务配置
- **[CRON_SETUP_GUIDE.md](deployment/CRON_SETUP_GUIDE.md)** - Cron 任务完整配置
- **[CRON_QUICKSTART.md](deployment/CRON_QUICKSTART.md)** - Cron 快速入门
- **[SUPABASE_PGCRON_GUIDE.md](deployment/SUPABASE_PGCRON_GUIDE.md)** - Supabase pg_cron 详细指南

---

## 🔧 troubleshooting/ - 问题排查

### 押金商家相关
- **[TROUBLESHOOTING_DEPOSIT_DISPLAY.md](troubleshooting/TROUBLESHOOTING_DEPOSIT_DISPLAY.md)** - 押金商家页面显示问题排查
- **[PRODUCTION_REPAIR_GUIDE.md](troubleshooting/PRODUCTION_REPAIR_GUIDE.md)** - 生产环境数据库修复指南

---

## 📖 guides/ - 功能使用指南

### 基础功能
- **[IMAGE_UPLOAD_GUIDE.md](guides/IMAGE_UPLOAD_GUIDE.md)** - 图片上传功能指南
- **[MENU_UPDATE_GUIDE.md](guides/MENU_UPDATE_GUIDE.md)** - 菜单更新指南

### 积分系统
- **[CONTACT_POINTS_RULES.md](guides/CONTACT_POINTS_RULES.md)** - 联系方式积分规则

---

## 👑 admin/ - 管理员系统

- **[ADMIN_SYSTEM_GUIDE.md](admin/ADMIN_SYSTEM_GUIDE.md)** - 管理员系统使用指南
- **[ADMIN_STAGE_2_SUMMARY.md](admin/ADMIN_STAGE_2_SUMMARY.md)** - 管理员系统第二阶段总结

---

## 🗂️ archived/ - 历史记录

### 功能开发记录
- **[POINTS_HISTORY_FEATURE.md](archived/POINTS_HISTORY_FEATURE.md)** - 积分历史功能开发记录
- **[REALTIME_POINTS_UPDATE.md](archived/REALTIME_POINTS_UPDATE.md)** - 实时积分更新功能
- **[TOPPED_FEATURE_FIX.md](archived/TOPPED_FEATURE_FIX.md)** - 置顶功能修复记录
- **[USER_NUMBER_IMPLEMENTATION.md](archived/USER_NUMBER_IMPLEMENTATION.md)** - 用户编号实现

### 问题修复记录
- **[CERTIFICATION_LOGIC_UPDATE.md](archived/CERTIFICATION_LOGIC_UPDATE.md)** - 认证逻辑更新
- **[DATABASE_QUERY_FIX.md](archived/DATABASE_QUERY_FIX.md)** - 数据库查询修复
- **[DATABASE_COMPARISON.md](archived/DATABASE_COMPARISON.md)** - 数据库对比记录（2025-01-19）

### 开发阶段总结
- **[UPDATE_SUMMARY.md](archived/UPDATE_SUMMARY.md)** - 更新总结
- **[PHASE1_UPDATES.md](archived/PHASE1_UPDATES.md)** - 第一阶段更新记录

### 其他
- **[flarum_diagnostic_commands.md](archived/flarum_diagnostic_commands.md)** - Flarum 诊断命令

---

## 📖 使用说明

### 查找文档
1. **部署项目** → 查看 `deployment/` 文件夹
2. **遇到问题** → 查看 `troubleshooting/` 文件夹
3. **使用功能** → 查看 `guides/` 文件夹
4. **管理后台** → 查看 `admin/` 文件夹
5. **历史记录** → 查看 `archived/` 文件夹

### 文档维护
- ✅ **新增文档**: 根据类型放入对应文件夹
- ✅ **更新文档**: 直接编辑原文件
- ✅ **过时文档**: 移动到 `archived/` 文件夹
- ✅ **更新导航**: 编辑本文件（README.md）

---

## 🆕 最新文档

- **2025-01-19**: DATABASE_DEPLOYMENT_GUIDE.md - 数据库部署指南
- **2025-01-19**: TROUBLESHOOTING_DEPOSIT_DISPLAY.md - 押金商家问题排查
- **2025-01-19**: PRODUCTION_REPAIR_GUIDE.md - 生产环境修复指南

---

**最后更新**: 2025-01-19

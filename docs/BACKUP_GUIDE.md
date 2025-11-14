# 📦 数据库备份与恢复指南

## 📋 目录
1. [快速开始](#快速开始)
2. [备份方案](#备份方案)
3. [使用方法](#使用方法)
4. [生产环境配置](#生产环境配置)
5. [常见问题](#常见问题)

---

## 🚀 快速开始

### 前置要求
1. 在 `.env.local` 文件中配置以下环境变量：
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **重要**: `SUPABASE_SERVICE_ROLE_KEY` 可以在 Supabase Dashboard → Settings → API → Service Role Key 中找到

### 立即备份
```bash
npm run backup
```

### 查看可用备份
```bash
npm run restore:list
```

### 恢复备份
```bash
npm run restore 2025-01-14
```

---

## 📦 备份方案

本项目提供三种备份方案，适用于不同场景：

### 方案一：Supabase 自动备份（推荐生产环境）

#### Free Plan（免费版）
- ❌ **不包含自动备份**
- ✅ 可以使用本项目的脚本手动备份

#### Pro Plan（$25/月）
- ✅ **每日自动备份，保留7天**
- ✅ **Point-in-Time Recovery (PITR)** - 可恢复到过去7天的任意时间点
- ✅ 备份存储在Supabase云端，无需本地管理

**配置方法**：
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → Settings → Database → Backups
3. 启用自动备份（Pro计划自动启用）

---

### 方案二：本地手动备份（开发环境 + 免费版用户）

使用本项目提供的备份脚本，将数据导出为JSON格式存储在本地。

**优点**：
- ✅ 完全免费
- ✅ 完全控制备份文件
- ✅ 可选择性备份指定表
- ✅ 支持跨项目迁移

**缺点**：
- ❌ 需要手动执行
- ❌ 备份存储在本地，需要自行管理

**适用场景**：
- 开发环境日常备份
- 迁移数据到新项目
- 重要操作前的安全备份
- Supabase Free Plan用户

---

### 方案三：定时自动备份（混合方案）

使用系统定时任务（Cron / Task Scheduler）自动执行备份脚本。

#### Linux/Mac (Cron)
```bash
# 编辑crontab
crontab -e

# 添加定时任务（每天凌晨2点备份）
0 2 * * * cd /path/to/project && npm run backup >> /var/log/db-backup.log 2>&1
```

#### Windows (Task Scheduler)
1. 打开任务计划程序
2. 创建基本任务
3. 触发器：每天凌晨2点
4. 操作：启动程序
   - 程序：`cmd.exe`
   - 参数：`/c cd "C:\path\to\project" && npm run backup`

---

## 🛠️ 使用方法

### 备份操作

#### 1. 完整备份（所有表）
```bash
npm run backup
```

#### 2. 备份指定表
```bash
npm run backup:tables merchants,profiles,transactions
```

#### 3. 直接使用脚本
```bash
node scripts/backup-database.js
node scripts/backup-database.js --tables merchants,profiles
```

**备份文件位置**：
```
backups/
  └── 2025-01-14/          # 按日期组织
      ├── merchants.json   # 各表数据
      ├── profiles.json
      ├── transactions.json
      ├── _metadata.json   # 数据库元数据
      └── _summary.json    # 备份摘要
```

---

### 恢复操作

#### 1. 查看可用备份
```bash
npm run restore:list
```

输出示例：
```
📁 可用的备份:
============================================================
1. 2025-01-14 - 1523 条记录
2. 2025-01-13 - 1498 条记录
3. 2025-01-12 - 1467 条记录
============================================================
```

#### 2. 完整恢复（覆盖模式）
```bash
npm run restore 2025-01-14
```

⚠️ **警告**: 这将**删除**现有数据并替换为备份数据！

#### 3. 恢复指定表
```bash
node scripts/restore-database.js 2025-01-14 --tables merchants,profiles
```

#### 4. 合并模式（不删除现有数据）
```bash
node scripts/restore-database.js 2025-01-14 --merge
```

使用 `upsert` 方式插入数据，保留现有记录。

#### 5. 跳过安全备份
```bash
node scripts/restore-database.js 2025-01-14 --skip-safety-backup
```

默认情况下，恢复前会自动创建当前数据的备份。使用此选项可跳过。

---

## 🔧 生产环境配置

### 1. 环境变量配置

**开发环境** (`.env.local`)：
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**生产环境** (Vercel/其他平台)：
在部署平台的环境变量设置中添加：
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **安全提醒**:
- 不要将 `.env.local` 提交到Git（已在 `.gitignore` 中排除）
- Service Role Key 具有完全访问权限，务必保密
- 生产环境使用平台的环境变量注入功能

---

### 2. Supabase Pro Plan 备份配置

如果您使用Supabase Pro Plan，强烈建议启用自动备份：

1. **启用自动备份**
   - 登录 Supabase Dashboard
   - Settings → Database → Backups
   - 确认已启用（Pro自动启用）

2. **配置备份保留策略**
   - 默认保留7天
   - 可升级到更长保留期

3. **测试恢复流程**
   ```bash
   # 在Supabase Dashboard中测试恢复
   Database → Backups → Restore
   ```

---

### 3. 混合备份策略（推荐）

结合 Supabase 自动备份和本地脚本备份：

**Supabase自动备份**：
- ✅ 用于日常自动备份
- ✅ 快速恢复到任意时间点

**本地脚本备份**：
- ✅ 重要操作前手动备份（如大规模数据更新）
- ✅ 跨项目迁移
- ✅ 长期归档（超过7天）

**示例工作流**：
```bash
# 1. 日常：Supabase自动备份（无需操作）

# 2. 重要操作前：手动备份
npm run backup

# 3. 每周归档：导出重要数据
npm run backup:tables merchants,transactions

# 4. 如有问题：优先使用Supabase PITR恢复
# 5. 长期恢复：使用本地备份脚本
```

---

### 4. 定时备份配置（生产服务器）

如果您在自己的服务器上运行（非Serverless），可以配置定时备份：

#### 每日凌晨2点自动备份
```bash
# 编辑crontab
crontab -e

# 添加任务
0 2 * * * cd /path/to/project && /usr/bin/npm run backup >> /var/log/db-backup.log 2>&1

# 每周日清理30天前的旧备份（可选）
0 3 * * 0 find /path/to/project/backups -type d -mtime +30 -exec rm -rf {} +
```

#### 备份到云存储（推荐）
备份完成后，将文件上传到云存储：

**AWS S3 示例**：
```bash
#!/bin/bash
# backup-to-s3.sh

# 执行备份
cd /path/to/project
npm run backup

# 上传到S3
DATE=$(date +%Y-%m-%d)
aws s3 sync backups/$DATE s3://your-bucket/backups/$DATE/

echo "Backup uploaded to S3: $DATE"
```

**配置定时任务**：
```bash
0 2 * * * /path/to/backup-to-s3.sh
```

---

## ❓ 常见问题

### Q1: 备份文件很大，如何优化？

**A**: 可以选择性备份重要表：
```bash
# 只备份核心业务表
npm run backup:tables merchants,profiles,transactions
```

或配置备份压缩（需修改脚本添加gzip）。

---

### Q2: 如何在不同项目间迁移数据？

**A**:
1. 在源项目执行备份：
   ```bash
   npm run backup
   ```

2. 复制 `backups/2025-01-14/` 目录到目标项目

3. 在目标项目执行恢复：
   ```bash
   npm run restore 2025-01-14
   ```

---

### Q3: 恢复操作会覆盖现有数据吗？

**A**:
- **默认（覆盖模式）**: 会**删除**现有数据，然后插入备份数据
- **合并模式** (`--merge`): 使用 `upsert`，不删除现有数据

恢复前脚本会自动创建安全备份，确保可以回滚。

---

### Q4: 备份脚本需要什么权限？

**A**: 需要 `SUPABASE_SERVICE_ROLE_KEY`，这是一个具有完全访问权限的密钥。

获取方法：
1. 登录 Supabase Dashboard
2. Settings → API
3. 复制 "Service Role Key"（不是 anon key）

⚠️ **警告**: Service Role Key 绕过所有RLS策略，请妥善保管。

---

### Q5: 免费版Supabase可以用自动备份吗？

**A**:
- ❌ Supabase Free Plan **不提供自动备份**
- ✅ 但可以使用本项目的脚本 + 定时任务实现自动备份
- ✅ 配置Cron/Task Scheduler定时执行 `npm run backup`

---

### Q6: 备份文件应该存储在哪里？

**推荐方案**：

**开发环境**：
- 本地 `backups/` 目录（已在 `.gitignore` 中排除）

**生产环境**：
- **方案1**: Supabase Pro自动备份（最简单）
- **方案2**: 定时备份 + 上传到云存储（S3、Azure Blob、阿里云OSS等）
- **方案3**: 定时备份 + 上传到远程服务器

---

### Q7: 如何测试备份是否有效？

**A**: 定期执行恢复测试：

1. 创建测试用Supabase项目
2. 执行恢复操作
3. 验证数据完整性
4. 测试应用功能

```bash
# 在测试环境执行
npm run restore 2025-01-14

# 验证数据
node scripts/verify-backup.js  # (需要自己创建验证脚本)
```

---

### Q8: 备份失败怎么办？

**常见原因和解决方法**：

1. **缺少环境变量**
   ```
   ❌ 错误: 缺少必要的环境变量
   ```
   解决：检查 `.env.local` 文件是否包含 `SUPABASE_SERVICE_ROLE_KEY`

2. **权限不足**
   ```
   ❌ 备份失败: permission denied
   ```
   解决：确认使用的是 Service Role Key，不是 anon key

3. **网络问题**
   ```
   ❌ 备份失败: network error
   ```
   解决：检查网络连接，确认Supabase服务可访问

4. **磁盘空间不足**
   ```
   ❌ 写入失败: ENOSPC
   ```
   解决：清理旧备份或增加磁盘空间

---

### Q9: 如何自动清理旧备份？

**A**: 备份脚本已内置自动清理功能：

- 默认保留最近 **30天** 的备份
- 每次备份时自动清理超过30天的旧备份

修改保留天数（在 `scripts/backup-database.js` 中）：
```javascript
const BACKUP_RETENTION_DAYS = 30 // 修改为你需要的天数
```

---

### Q10: 生产环境推荐哪种方案？

**推荐方案**（按优先级）：

**🥇 最推荐**：Supabase Pro Plan
- 自动备份，无需维护
- Point-in-Time Recovery
- 适合：所有生产环境

**🥈 次推荐**：Supabase Pro + 本地脚本
- Supabase自动备份（日常）
- 重要操作前手动备份（额外保险）
- 适合：关键业务系统

**🥉 经济方案**：Free Plan + 定时脚本 + 云存储
- 成本低（仅云存储费用）
- 需要自行维护
- 适合：小型项目、预算有限

---

## 📞 技术支持

如遇到问题，请检查：

1. ✅ 环境变量配置正确
2. ✅ Service Role Key 有效
3. ✅ 网络连接正常
4. ✅ 磁盘空间充足
5. ✅ Node.js 版本 >= 18

---

## 📝 更新日志

**v1.0.0** (2025-01-14)
- ✅ 初始版本
- ✅ 支持完整备份和恢复
- ✅ 支持选择性备份指定表
- ✅ 支持合并模式恢复
- ✅ 自动清理旧备份
- ✅ 恢复前自动创建安全备份

---

## 🔒 安全建议

1. ⚠️ **不要将备份文件提交到Git**（已配置 `.gitignore`）
2. ⚠️ **Service Role Key 务必保密**，不要泄露
3. ⚠️ **定期测试恢复流程**，确保备份有效
4. ⚠️ **生产环境备份建议加密**后上传到云存储
5. ⚠️ **重要操作前务必备份**，谨慎执行恢复操作

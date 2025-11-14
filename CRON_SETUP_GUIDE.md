# 商家置顶到期提醒 - 定时任务设置指南

## 功能说明

本系统实现了两个定时任务:

1. **自动下架过期置顶** (`/api/cron/expire-tops`)
   - 功能: 自动取消已过期商家的置顶状态,并发送通知
   - 建议频率: 每小时运行一次

2. **到期提醒** (`/api/cron/check-expiring`)
   - 功能: 检查3天内即将到期的置顶商家,发送提醒通知
   - 建议频率: 每天上午10点运行一次

---

## 方案一: Vercel Cron Jobs (推荐,最简单)

### 前提条件
- 项目已部署到 Vercel

### 设置步骤

1. **已创建 `vercel.json` 配置文件**
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/expire-tops",
         "schedule": "0 * * * *"
       },
       {
         "path": "/api/cron/check-expiring",
         "schedule": "0 10 * * *"
       }
     ]
   }
   ```

2. **部署到 Vercel**
   ```bash
   git add .
   git commit -m "Add cron jobs"
   git push
   ```

3. **完成!** Vercel会自动识别并运行定时任务

### Cron表达式说明
- `0 * * * *` - 每小时的第0分钟 (整点)
- `0 10 * * *` - 每天上午10点

---

## 方案二: 外部Cron服务 (适用于任何部署平台)

### 1. cron-job.org (免费)

访问: https://cron-job.org

#### 设置步骤:

1. **注册账号并登录**

2. **创建第一个Cron Job - 自动下架过期置顶**
   - Title: `Expire Top Merchants`
   - URL: `https://your-domain.com/api/cron/expire-tops`
   - Schedule: `Every hour` (或自定义: `0 * * * *`)
   - 添加Header (可选,用于安全验证):
     - Key: `Authorization`
     - Value: `Bearer your-secret-token`

3. **创建第二个Cron Job - 到期提醒**
   - Title: `Check Expiring Tops`
   - URL: `https://your-domain.com/api/cron/check-expiring`
   - Schedule: `Daily at 10:00` (或自定义: `0 10 * * *`)
   - 添加Header (可选):
     - Key: `Authorization`
     - Value: `Bearer your-secret-token`

4. **保存并激活**

### 2. EasyCron (免费额度)

访问: https://www.easycron.com

类似设置步骤。

---

## 方案三: GitHub Actions (免费)

适合GitHub托管的项目。

### 创建 `.github/workflows/cron.yml`:

```yaml
name: Cron Jobs

on:
  schedule:
    # 每小时运行 - 自动下架过期置顶
    - cron: '0 * * * *'
    # 每天上午10点 - 到期提醒
    - cron: '0 10 * * *'
  workflow_dispatch: # 允许手动触发

jobs:
  expire-tops:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 * * * *'
    steps:
      - name: Call Expire Tops API
        run: |
          curl -X POST https://your-domain.com/api/cron/expire-tops \
          -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  check-expiring:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 10 * * *'
    steps:
      - name: Call Check Expiring API
        run: |
          curl -X POST https://your-domain.com/api/cron/check-expiring \
          -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## 安全配置 (可选但推荐)

为了防止恶意调用API端点,建议设置一个密钥:

### 1. 添加环境变量

在 `.env.local` 文件中添加:
```env
CRON_SECRET=your-random-secret-token-here
```

### 2. 在Vercel中设置

如果部署到Vercel:
1. 进入项目设置 → Environment Variables
2. 添加变量:
   - Name: `CRON_SECRET`
   - Value: `your-random-secret-token-here`

### 3. 在Cron服务中添加Header

调用API时添加Authorization header:
```
Authorization: Bearer your-random-secret-token-here
```

---

## 测试定时任务

### 本地测试

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **手动调用API测试**

   测试自动下架:
   ```bash
   curl http://localhost:3000/api/cron/expire-tops
   ```

   测试到期提醒:
   ```bash
   curl http://localhost:3000/api/cron/check-expiring
   ```

3. **查看返回结果**
   ```json
   {
     "success": true,
     "count": 2
   }
   ```

### 生产环境测试

部署后,使用Postman或curl测试:
```bash
curl https://your-domain.com/api/cron/expire-tops
```

---

## 通知效果

### 到期提醒通知 (3天前)
- **标题**: "商家置顶即将到期"
- **内容**: "您的商家"XXX"的置顶服务将在 2 天后到期 (2025-11-01)"
- **优先级**: 高
- **类型**: merchant
- **分类**: merchant_top_expiring

### 过期通知 (到期后)
- **标题**: "商家置顶已到期"
- **内容**: "您的商家"XXX"的置顶服务已到期"
- **优先级**: 普通
- **类型**: merchant
- **分类**: merchant_top_expired

---

## 监控和日志

### 查看执行日志

1. **Vercel Cron Jobs**
   - Vercel Dashboard → Functions → Cron Logs

2. **外部Cron服务**
   - 在各自平台的执行历史中查看

3. **控制台日志**
   - API会在控制台输出执行结果:
     ```
     Sent 3 expiring notifications
     Expired 1 merchants
     ```

---

## 故障排查

### 问题: API返回401 Unauthorized
**解决**: 检查CRON_SECRET环境变量是否正确设置

### 问题: 定时任务没有执行
**解决**:
- Vercel: 检查vercel.json配置是否正确
- 外部服务: 检查Cron Job是否已激活
- GitHub Actions: 检查workflow文件语法

### 问题: 通知没有发送
**解决**:
- 检查数据库中是否有符合条件的商家
- 检查notifications表的Realtime是否启用
- 查看API返回的count字段

---

## Cron表达式参考

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 星期 (0-7, 0和7都代表星期日)
│ │ │ └─── 月份 (1-12)
│ │ └───── 日期 (1-31)
│ └─────── 小时 (0-23)
└───────── 分钟 (0-59)
```

常用示例:
- `0 * * * *` - 每小时整点
- `0 10 * * *` - 每天10:00
- `0 */6 * * *` - 每6小时
- `0 0 * * 0` - 每周日凌晨
- `0 0 1 * *` - 每月1日凌晨

---

## 推荐配置

### 开发/测试环境
- 使用手动调用API测试
- 或使用较短的间隔 (如每5分钟) 快速验证

### 生产环境
- **自动下架**: 每小时 `0 * * * *`
- **到期提醒**: 每天上午10点 `0 10 * * *`
- 启用CRON_SECRET安全验证

---

## 相关文件

- 定时任务逻辑: `lib/actions/cron.ts`
- API端点 - 自动下架: `app/api/cron/expire-tops/route.ts`
- API端点 - 到期提醒: `app/api/cron/check-expiring/route.ts`
- Vercel配置: `vercel.json`

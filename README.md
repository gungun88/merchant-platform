# 跨境服务商平台

一个面向跨境电商服务商的展示和对接平台，汇聚各类跨境电商服务提供商，帮助卖家快速找到合适的服务商。

## 项目概述

本平台专注于跨境电商服务商的聚合展示，主要服务对象包括：
- Shopify独立站服务商
- Facebook/TikTok/Google代理开户
- 虚拟卡服务商
- Facebook账号商
- 斗篷服务商
- 一代/二代服务商

## 核心功能

### 1. 用户认证系统
- 用户注册（邮箱验证）
- 用户登录
- 退出登录
- 未登录用户自动跳转到注册页面

### 2. 积分系统
- 注册奖励：新用户注册获得100积分
- 邀请奖励：邀请好友注册，双方各获得100积分
- 每日签到：每天签到获得5积分
- 连续签到奖励：
  - 连续7天额外获得20积分
  - 连续30天额外获得50积分
- 查看联系方式消耗积分：
  - 客户查看商家：客户扣10积分，商家扣10积分
  - 商家查看商家：查看方扣50积分，被查看方不扣分
- 商家入驻奖励：入驻成功获得50积分
- 编辑商家信息：每次编辑扣除100积分

### 3. 商家入驻系统
- 免费入驻申请
- 入驻表单（10个必填项）：
  - 名称（限制7个字符）
  - 类型（预设值）
  - 详情描述（限制100字符）
  - 价格区间（支持¥/$货币单位）
  - 地区（默认全国，可选城市）
  - 响应速度（5分钟/10分钟/1小时/25小时/工作日）
  - 售后保障（预设值）
  - 支付方式（预设值）
  - 库存（预设值）
  - 联系方式（电话/WhatsApp/Telegram/微信/邮箱，5选1必填）
- 入驻后身份自动转换为商家
- 已入驻用户"免费入驻"按钮变灰色禁用

### 4. 服务商展示
- 多维度展示服务商信息（名称、类型、价格、认证等）
- 支持多标签分类（一个服务商可提供多种服务）
- 智能截断和悬浮提示，保持界面简洁

### 5. 高级筛选
- 按服务类型筛选
- 按认证状态筛选（待认证/已认证/认证失败）
- 按价格区间筛选（¥0-100/¥100-500/¥500-1000/¥1000以上/$0-50/$50-200/$200以上）
- 按地区筛选
- 关键词搜索

### 6. 联系对接
- 一键咨询功能
- 弹窗展示完整联系方式
- 支持一键复制联系信息
- 多渠道联系方式（微信、Telegram、WhatsApp、邮箱）

### 7. 通知系统
- 签到成功通知
- 入驻成功通知
- 积分变动通知
- 系统消息通知

### 8. 认证系统
- 商家认证状态管理
- 默认状态：待认证
- 管理员人工审核授权
- 认证状态：待认证/已认证/认证失败

### 9. 邀请系统
- 用户可生成专属邀请码和邀请链接
- 分享邀请链接给好友注册
- 好友通过邀请码注册成功后，双方各获得100积分
- 邀请统计：总邀请数、已完成、待完成、总奖励
- 邀请记录：查看所有邀请好友的详细信息

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4
- **UI组件**: shadcn/ui
- **图标**: Lucide React
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **状态管理**: React Hooks (useState, useEffect)
- **SEO优化**: 完整的SEO配置（robots.txt、sitemap.xml、Open Graph、结构化数据）

## 数据结构

### 服务商数据模型

\`\`\`typescript
interface Merchant {
  id: number
  name: string
  logo: string
  types: string[]                    // 服务类型（多选）
  description: string                // 详情描述
  priceRange: string                 // 价格区间
  certifications: string[]           // 认证标签（多选）
  location: string                   // 所在城市
  responseTime: number               // 响应速度（分钟）
  joinDays: number                   // 入驻天数
  afterSales: string[]               // 售后保障（多选）
  paymentMethods: string[]           // 支付方式（多选）
  contacts: {                        // 联系方式
    wechat?: string
    telegram?: string
    whatsapp?: string
    email?: string
  }
  stock: string                      // 库存状态
  status: 'online' | 'offline'       // 在线状态
}
\`\`\`

## UI设计决策

### 1. 表格列设计

| 列名 | 宽度 | 说明 |
|------|------|------|
| 名称 | 15% | 带Logo，可点击跳转详情 |
| 类型 | 12% | 显示前1个标签，超出显示+N |
| 详情描述 | 15% | 单行截断，悬浮显示完整内容 |
| 价格区间 | 8% | 起步价或区间 |
| 认证 | 8% | 显示前1个认证，超出显示+N |
| 地区 | 8% | 只显示城市名称 |
| 响应速度 | 8% | 简化为"5 min"格式 |
| 入驻时长 | 6% | 以天数为单位 |
| 售后保障 | 10% | 显示前1个保障，超出显示+N |
| 支付方式 | 8% | 显示前1个方式，超出显示+N |
| 库存 | 6% | 状态标识 |
| 联系方式 | 10% | "立即咨询"按钮 |
| 操作 | 8% | 下拉菜单 |

### 2. 优化策略

#### 空间优化
- **多标签列**：限制显示数量 + "+N" 提示 + 悬浮显示全部
- **详情描述**：单行截断 + 省略号 + 悬浮显示完整内容
- **响应速度**：简化为数字 + 单位（5 min）
- **地区**：只显示城市，不显示省份

#### 交互优化
- **联系方式**：改为按钮触发弹窗，避免直接暴露联系信息
- **操作菜单**：下拉菜单集中操作，节省空间
- **悬浮提示**：所有截断内容支持悬浮查看完整信息

#### 视觉优化
- **紧凑型公告**：减少padding和间距，提高空间利用率
- **状态指示**：使用颜色圆点表示在线状态
- **认证徽章**：使用图标和颜色区分不同认证等级

## 项目结构

\`\`\`
├── app/
│   ├── globals.css          # 全局样式和Tailwind配置
│   ├── layout.tsx           # 根布局
│   ├── loading.tsx          # 加载状态
│   └── page.tsx             # 主页面（服务商列表）
├── components/
│   └── ui/                  # shadcn/ui组件库
├── hooks/                   # 自定义Hooks
├── lib/
│   └── utils.ts             # 工具函数
├── public/                  # 静态资源（Logo等）
└── README.md                # 项目文档
\`\`\`

## 本地开发

### 前置要求
- Node.js 18+
- npm 或 pnpm
- Supabase账号

### 安装步骤

1. 克隆项目
\`\`\`bash
git clone <项目地址>
cd <项目目录>
\`\`\`

2. 安装依赖
\`\`\`bash
npm install
# 或
pnpm install
\`\`\`

3. 配置环境变量
创建 `.env.local` 文件并填入Supabase配置

4. 设置数据库
在Supabase SQL Editor中按顺序执行 `scripts` 文件夹中的SQL脚本

5. 启动开发服务器
\`\`\`bash
npm run dev
# 或
pnpm dev
\`\`\`

6. 访问应用
打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 开发过程记录

### 第一阶段：需求分析
1. 确定平台定位：跨境电商服务商聚合平台
2. 明确目标用户：跨境电商卖家
3. 确定核心服务类型：开户、账号、虚拟卡、斗篷等

### 第二阶段：UI设计
1. 参考原型图设计表格结构
2. 确定13个核心列及其展示方式
3. 设计筛选器和搜索功能
4. 设计公告轮播组件

### 第三阶段：优化迭代
1. **类型/认证/售后/支付列**：从显示多个改为显示1个+N
2. **详情描述**：从多行改为单行截断
3. **响应速度**：从文字描述改为数字+单位
4. **地区**：从省市改为只显示城市
5. **联系方式**：从直接展示改为按钮+弹窗
6. **操作**：从多个按钮改为下拉菜单
7. **公告轮播**：从大卡片改为紧凑型设计
8. **入驻按钮**：从"入驻"改为"免费入驻"

### 第四阶段：细节打磨
1. 确保所有多标签列不换行
2. 优化悬浮提示的交互体验
3. 调整间距和padding，提高空间利用率
4. 添加复制功能到联系方式弹窗

### 第五阶段：后端集成（最新）
1. **Supabase集成**：连接Supabase数据库
2. **用户认证系统**：实现注册、登录、退出功能
3. **积分系统**：实现积分计算、签到、积分记录
4. **商家入驻**：实现完整的入驻流程和表单验证
5. **权限控制**：实现基于用户身份的权限管理
6. **通知系统**：实现签到、入驻等通知功能
7. **认证管理**：添加商家认证状态管理

### 遇到的问题和解决方案

#### 问题1：Supabase查询返回0行时报错
**问题**：使用 `.single()` 方法查询时，如果返回0行会抛出406错误
**解决**：将所有 `.single()` 改为 `.maybeSingle()`，允许返回0或1行

#### 问题2：注册页面路径不一致
**问题**：代码中跳转到 `/auth/sign-up`，但实际页面是 `/auth/register`
**解决**：统一修改所有跳转链接为 `/auth/register`

#### 问题3：库存显示英文
**问题**：数据库中存储的是英文"sufficient"
**解决**：创建SQL脚本批量更新为中文"充足"

#### 问题4：积分计算错误
**问题**：入驻奖励给了100积分，应该是50积分
**解决**：修改 `createMerchant` 函数中的积分奖励值

#### 问题5：缺少contact_phone字段
**问题**：代码中使用了 `contact_phone` 字段，但数据库表中没有
**解决**：创建SQL脚本添加 `contact_phone` 字段

#### 问题6：登录后页面状态不更新
**问题**：登录成功后跳转，但页面没有显示登录状态
**解决**：使用 `window.location.href` 进行硬刷新

## 测试指南

### 功能测试清单

#### 认证系统
- [ ] 注册新用户（检查是否获得100积分）
- [ ] 登录已有用户
- [ ] 退出登录
- [ ] 未登录时点击功能跳转到注册页面

#### 积分系统
- [ ] 每日签到获得5积分
- [ ] 连续签到7天获得额外20积分
- [ ] 查看联系方式扣除积分（客户10分，商家50分）
- [ ] 积分不足时的提示

#### 商家系统
- [ ] 免费入驻（检查是否获得50积分）
- [ ] 填写商家信息（验证必填项）
- [ ] 入驻后"免费入驻"按钮变灰
- [ ] 编辑商家信息扣除100积分

#### 筛选功能
- [ ] 按类型筛选
- [ ] 按认证状态筛选
- [ ] 按价格筛选
- [ ] 按地区筛选
- [ ] 搜索功能

### 测试账号建议

建议创建多个测试账号：
- 测试账号1：普通用户（客户）
- 测试账号2：商家用户
- 测试账号3：积分充足的用户
- 测试账号4：积分不足的用户

### 调整测试积分

如果测试时积分不足，可以在Supabase SQL Editor中运行：

\`\`\`sql
-- 给特定用户增加积分
UPDATE profiles 
SET points = 10000 
WHERE email = '你的测试邮箱';
\`\`\`

## 数据库设计

### 数据库表结构

#### 1. profiles（用户表）
\`\`\`sql
- id: UUID (主键)
- email: text (邮箱)
- username: text (用户名)
- points: integer (积分余额，默认100)
- is_merchant: boolean (是否是商家，默认false)
- created_at: timestamp (注册时间)
\`\`\`

#### 2. points_log（积分记录表）
\`\`\`sql
- id: UUID (主键)
- user_id: UUID (用户ID，外键)
- points_change: integer (积分变化，正数为增加，负数为减少)
- action_type: text (操作类型：register/check_in/merchant_register/view_contact等)
- description: text (描述)
- created_at: timestamp (时间)
\`\`\`

#### 3. merchants（商家表）
\`\`\`sql
- id: UUID (主键)
- user_id: UUID (用户ID，外键)
- name: text (商家名称，限制7字符)
- service_type: text (服务类型)
- description: text (详情描述，限制100字符)
- price_range: text (价格区间)
- location: text (地区)
- response_time: text (响应速度)
- after_sales: text (售后保障)
- payment_methods: text (支付方式)
- stock_status: text (库存状态)
- contact_phone: text (电话)
- contact_wechat: text (微信)
- contact_telegram: text (Telegram)
- contact_whatsapp: text (WhatsApp)
- contact_email: text (邮箱)
- certification_status: text (认证状态，默认"待认证")
- is_featured: boolean (是否置顶，默认false)
- featured_until: timestamp (置顶截止时间)
- views: integer (浏览量，默认0)
- created_at: timestamp (创建时间)
- updated_at: timestamp (更新时间)
\`\`\`

#### 4. check_ins（签到表）
\`\`\`sql
- id: UUID (主键)
- user_id: UUID (用户ID，外键)
- check_in_date: date (签到日期)
- consecutive_days: integer (连续签到天数)
- created_at: timestamp (签到时间)
\`\`\`

#### 5. favorites（收藏表）
\`\`\`sql
- id: UUID (主键)
- user_id: UUID (用户ID，外键)
- merchant_id: UUID (商家ID，外键)
- created_at: timestamp (收藏时间)
\`\`\`

### SQL脚本执行顺序

1. `001_create_users_table.sql` - 创建用户profiles表
2. `002_create_points_log_table.sql` - 创建积分记录表
3. `003_create_merchants_table.sql` - 创建商家表
4. `004_create_favorites_table.sql` - 创建收藏表
5. `005_create_check_ins_table.sql` - 创建签到表
6. `006_update_profiles_default.sql` - 更新用户表默认值
7. `007_add_certification_status.sql` - 添加认证状态字段
8. `008_fix_stock_status.sql` - 修复库存状态显示
9. `009_add_contact_phone.sql` - 添加电话联系方式字段

## 环境配置

### 环境变量

在项目根目录创建 `.env.local` 文件：

\`\`\`env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务角色密钥
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000

# 网站配置 (用于SEO，部署时必须配置)
NEXT_PUBLIC_SITE_URL=https://你的域名.com

# 硬币兑换API密钥 (与论坛共享)
COIN_EXCHANGE_API_SECRET=你的API密钥
\`\`\`

**重要**：
- 本地开发时 `NEXT_PUBLIC_SITE_URL` 可以是 `http://localhost:3000`
- 部署到生产环境时必须改为实际域名，用于SEO和社交分享
- 参考 `.env.local.example` 文件了解所有配置项

### 获取Supabase密钥

1. 登录 https://supabase.com
2. 选择你的项目
3. 左侧菜单 → Settings → API
4. 复制：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

### 数据库设置

1. 在Supabase控制台进入SQL Editor
2. 按顺序执行 `scripts` 文件夹中的SQL脚本（001-009）
3. 确认所有表创建成功

## 后续开发计划

### 短期计划
- [ ] 开发者工具页面（方便测试）
- [ ] 移动端响应式优化
- [ ] 商家详情页
- [ ] 收藏功能完善

### 中期计划
- [ ] 管理员后台（审核商家、管理用户）
- [ ] 数据统计和分析
- [ ] 服务商评价系统
- [ ] 积分商城

### 长期计划
- [ ] 支付系统集成
- [ ] 积分充值功能
- [ ] 会员等级系统
- [ ] API开放平台

## SEO优化

本项目已完成完整的SEO优化配置，详情请查看 [SEO配置指南](./docs/SEO_GUIDE.md)。

### SEO功能清单

✅ **robots.txt** - 搜索引擎爬虫规则
✅ **sitemap.xml** - 动态生成的网站地图
✅ **Open Graph** - 社交媒体分享优化
✅ **Twitter Card** - Twitter分享卡片
✅ **结构化数据** - Schema.org JSON-LD
✅ **页面元数据** - 每个页面独立的SEO配置
✅ **关键词优化** - 针对跨境电商行业的关键词

### 部署前必须配置

在 `.env.local` 中添加：
```env
NEXT_PUBLIC_SITE_URL=https://你的实际域名.com
```

### 提交到搜索引擎

部署后建议提交到：
- [Google Search Console](https://search.google.com/search-console)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)
- [百度站长平台](https://ziyuan.baidu.com)

详细的SEO配置和优化指南请参考 [docs/SEO_GUIDE.md](./docs/SEO_GUIDE.md)。

## 版本历史

### v1.2.0 (2025-01-15) - SEO优化版本
- ✨ 添加完整的SEO优化配置
- ✨ 创建 robots.txt 和动态 sitemap.xml
- ✨ 添加 Open Graph 和 Twitter Card 支持
- ✨ 添加结构化数据（Schema.org JSON-LD）
- ✨ 为主要页面添加独立的SEO元数据
- ✨ 添加 SEO 配置指南文档
- 🔧 优化关键词配置
- 🔧 添加 .env.local.example 模板文件

### v1.1.0 (2025-01-15)
- 添加用户认证系统
- 添加积分系统
- 添加商家入驻功能
- 添加通知系统
- 添加认证管理
- 修复多个bug

### v1.0.0 (2025-01-01)
- 初始版本
- 服务商列表展示
- 筛选和搜索功能
- 公告轮播

---

**最后更新**: 2025年1月
**版本**: v1.2.0

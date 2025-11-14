# 图片上传功能 - 配置和使用说明

## 📝 功能概述

已为商家入驻和编辑页面添加了图片上传功能，可以上传商家Logo/头像。

---

## ⚠️ 重要：必须先配置 Supabase Storage

在使用图片上传功能前，必须在Supabase中创建存储桶（Storage Bucket）。

### 步骤1：登录Supabase

1. 打开 https://supabase.com
2. 登录您的账号
3. 选择您的项目

### 步骤2：创建 Storage Bucket

1. 在左侧菜单找到 **Storage**
2. 点击 **"Create a new bucket"** 或 **"New Bucket"**
3. 填写以下信息：
   - **Name**: `merchant-assets`（必须是这个名字）
   - **Public bucket**: ✅ **勾选**（设为公开访问）
   - **File size limit**: 可选，建议设置为 2MB
4. 点击 **"Create bucket"**

### 步骤3：设置存储策略（Policies）

创建完bucket后，需要设置访问策略：

#### 方法A：使用UI界面

1. 点击刚创建的 `merchant-assets` bucket
2. 点击 **"Policies"** 标签
3. 点击 **"New Policy"**
4. 选择模板或自定义策略

#### 方法B：使用SQL（推荐）

在Supabase SQL Editor中执行以下SQL：

```sql
-- 允许所有用户上传文件
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchant-assets');

-- 允许所有人查看文件（公开访问）
CREATE POLICY "Allow public to view files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'merchant-assets');

-- 允许用户删除自己上传的文件
CREATE POLICY "Allow users to delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'merchant-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## ✅ 验证配置

配置完成后，可以检查：

1. 在Supabase Storage页面能看到 `merchant-assets` bucket
2. Bucket显示为 **Public**（公开）
3. Policies标签下有至少2条策略（上传和查看）

---

## 🎨 功能使用说明

### 商家入驻时上传Logo

1. 访问 **免费入驻** 页面
2. 在表单顶部看到 **"商家Logo"** 上传区域
3. 点击 **"上传图片"** 按钮
4. 选择图片文件（支持 JPG、PNG、GIF）
5. 等待上传完成（显示预览）
6. 填写其他信息并提交

### 编辑商家信息时更换Logo

1. 进入 **商家后台**
2. 点击 **"编辑信息"** → 确认扣除100积分
3. 在编辑页面顶部看到当前Logo
4. 点击 **"更换图片"** 上传新Logo
5. 或点击 **"移除"** 删除Logo
6. 保存修改

---

## 📋 技术实现细节

### 创建的文件

1. **components/image-upload.tsx** - 图片上传组件
   - 可复用
   - 支持预览
   - 自动验证文件类型和大小
   - 实时上传到Supabase Storage

2. **更新的文件**：
   - `app/merchant/register/page.tsx` - 添加Logo上传
   - `app/merchant/edit/[id]/page.tsx` - 添加Logo上传

### 上传流程

1. 用户选择图片文件
2. 前端验证：
   - 文件类型（必须是图片）
   - 文件大小（默认2MB限制）
3. 生成唯一文件名：`{user_id}-{timestamp}.{ext}`
4. 上传到 Supabase Storage：`merchant-assets/merchant-logos/`
5. 获取公开URL
6. 保存URL到数据库的 `logo` 字段

### 文件存储结构

```
merchant-assets/
└── merchant-logos/
    ├── {user_id_1}-{timestamp_1}.jpg
    ├── {user_id_2}-{timestamp_2}.png
    └── ...
```

---

## 🎯 图片显示位置

Logo上传后会显示在：

1. **主页商家列表** - 商家名称前的圆形头像
2. **商家详情页** - 顶部的大头像
3. **商家后台** - 商家信息卡片
4. **收藏列表** - 收藏的商家卡片

---

## ⚙️ 自定义配置

### 修改文件大小限制

在 `ImageUpload` 组件中修改 `maxSize` 参数：

```tsx
<ImageUpload
  currentImage={logoUrl}
  onImageChange={setLogoUrl}
  maxSize={5}  // 改为5MB
/>
```

### 修改存储文件夹

在 `ImageUpload` 组件中修改 `folder` 参数：

```tsx
<ImageUpload
  currentImage={logoUrl}
  onImageChange={setLogoUrl}
  folder="logos"  // 改为其他文件夹
/>
```

---

## 🐛 常见问题

### 1. 上传失败：bucket does not exist

**原因**：未创建 `merchant-assets` bucket

**解决**：按照上面步骤创建bucket

### 2. 上传失败：permission denied

**原因**：Storage策略（Policies）未正确配置

**解决**：执行SQL创建策略，确保用户有上传权限

### 3. 上传成功但图片不显示

**原因**：Bucket未设置为Public

**解决**：
1. 进入Storage → merchant-assets
2. 点击Settings
3. 勾选 "Public bucket"
4. 保存

### 4. 文件太大无法上传

**原因**：超过2MB限制

**解决**：
- 压缩图片后再上传
- 或修改maxSize参数

### 5. 上传很慢

**原因**：网络问题或图片太大

**建议**：
- 使用有损压缩工具压缩图片
- 推荐大小：100-500KB
- 推荐尺寸：200x200 到 400x400 像素

---

## 📊 存储费用说明

Supabase Storage收费标准（免费套餐）：
- **存储空间**: 1GB 免费
- **带宽**: 2GB/月 免费
- **超出后**: 按量计费

**预估**：
- 一张200KB的图片
- 1000个商家 = 200MB
- 完全在免费额度内

---

## 🔒 安全建议

1. **文件类型验证**：已实现，只允许图片格式
2. **文件大小限制**：已实现，默认2MB
3. **文件名随机化**：已实现，防止覆盖和冲突
4. **访问权限控制**：通过Storage Policies控制

---

## 📸 使用示例

### 上传前
```
┌────────────────────┐
│  [空头像]           │
│  [上传图片] 按钮    │
└────────────────────┘
```

### 上传中
```
┌────────────────────┐
│  [🔄 上传中...]     │
│  [上传中...] 按钮   │
└────────────────────┘
```

### 上传后
```
┌────────────────────┐
│  [Logo预览]         │
│  [更换图片] [移除]  │
└────────────────────┘
```

---

## ✅ 下一步优化建议

1. **图片裁剪功能** - 上传前可以裁剪
2. **图片压缩** - 自动压缩大图
3. **进度条显示** - 上传时显示进度
4. **多图上传** - 支持商家相册
5. **图床迁移** - 可选使用第三方图床（七牛云、阿里云OSS等）

---

## 📞 需要帮助？

如果遇到问题：
1. 检查Supabase Console的Storage页面
2. 检查浏览器控制台的错误信息
3. 确认bucket名称是否为 `merchant-assets`
4. 确认Policies是否正确配置

---

**创建日期**: 2025年10月27日
**版本**: v1.0

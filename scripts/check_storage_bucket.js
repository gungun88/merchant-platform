/**
 * 检查和创建 Supabase Storage 存储桶
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function checkAndCreateBucket() {
  console.log('🔍 开始检查存储桶配置...\n')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 错误: 缺少 Supabase 配置')
    console.error('请确保 .env.local 文件包含:')
    console.error('- NEXT_PUBLIC_SUPABASE_URL')
    console.error('- SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // 使用 service role key 创建管理员客户端
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // 1. 列出所有存储桶
    console.log('📦 获取现有存储桶列表...')
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ 获取存储桶列表失败:', listError)
      process.exit(1)
    }

    console.log(`✅ 找到 ${buckets.length} 个存储桶:`)
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (公开: ${bucket.public})`)
    })
    console.log()

    // 2. 检查是否存在 "public" 存储桶
    const publicBucket = buckets.find(b => b.name === 'public')

    if (publicBucket) {
      console.log('✅ "public" 存储桶已存在')
      console.log(`   - 公开访问: ${publicBucket.public}`)
      console.log(`   - 文件大小限制: ${publicBucket.file_size_limit || '无限制'}`)
      console.log(`   - 允许的 MIME 类型: ${publicBucket.allowed_mime_types?.join(', ') || '全部'}`)
    } else {
      console.log('⚠️  "public" 存储桶不存在')
      console.log('🔨 正在创建 "public" 存储桶...')

      const { data: newBucket, error: createError } = await supabase.storage.createBucket('public', {
        public: true, // 设置为公开访问
        fileSizeLimit: 2097152, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp']
      })

      if (createError) {
        console.error('❌ 创建存储桶失败:', createError)
        process.exit(1)
      }

      console.log('✅ "public" 存储桶创建成功!')
    }

    // 3. 测试上传权限
    console.log('\n🧪 测试上传权限...')
    const testFileName = `test-upload-${Date.now()}.txt`
    const testFilePath = `partner-logos/${testFileName}`
    const testContent = new Blob(['Test upload'], { type: 'text/plain' })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('public')
      .upload(testFilePath, testContent)

    if (uploadError) {
      console.error('❌ 上传测试失败:', uploadError)
      console.log('\n💡 可能的原因:')
      console.log('   1. 存储桶的 RLS 策略阻止了上传')
      console.log('   2. 存储桶不存在或名称错误')
      console.log('   3. Service Role Key 权限不足')
    } else {
      console.log('✅ 上传测试成功!')
      console.log(`   文件路径: ${uploadData.path}`)

      // 清理测试文件
      await supabase.storage.from('public').remove([testFilePath])
      console.log('🧹 已清理测试文件')
    }

    console.log('\n✅ 存储桶检查完成!')
    console.log('\n📋 下一步:')
    console.log('   1. 如果 "public" 存储桶不是公开的,请在 Supabase Dashboard 中设置为公开')
    console.log('   2. 确保存储桶有正确的 RLS 策略允许已认证用户上传')
    console.log('   3. 在 Supabase Dashboard > Storage > public 中检查策略')

  } catch (error) {
    console.error('❌ 发生错误:', error)
    process.exit(1)
  }
}

// 运行检查
checkAndCreateBucket().catch(console.error)

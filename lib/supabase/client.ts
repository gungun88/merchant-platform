import { createBrowserClient } from "@supabase/ssr"
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"

// 用于服务端渲染和数据获取的客户端（SSR优化）
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

// 用于实时订阅的客户端（支持 Realtime）- 每次调用都创建新实例
export function createRealtimeClient() {
  // 直接创建新实例，不使用单例
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10, // 限制每秒事件数，避免过于频繁
        },
      },
    }
  )

  console.log('🔧 [createRealtimeClient] 创建新的 Realtime 客户端实例')
  return client
}

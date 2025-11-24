// 需要安装: npm install @tanstack/react-query

import { Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'

function NavigationContent() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
    staleTime: 5 * 60 * 1000, // 5分钟内使用缓存
  })

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      return data
    },
    enabled: !!user,
  })

  const { data: settings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const result = await getSystemSettings()
      return result.data
    },
    staleTime: 10 * 60 * 1000, // 10分钟缓存
  })

  // 渲染逻辑...
}

export function Navigation() {
  return (
    <Suspense fallback={<NavigationSkeleton />}>
      <NavigationContent />
    </Suspense>
  )
}

function NavigationSkeleton() {
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
              <div className="h-3 w-48 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
            <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
      </div>
    </header>
  )
}

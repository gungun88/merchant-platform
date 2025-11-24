import { createClient } from "@/lib/supabase/server"
import { getSystemSettings } from "@/lib/actions/settings"
import { NavigationClient } from "./navigation-client"
import Link from "next/link"

export async function NavigationServer() {
  // 服务端直接获取数据
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    profile = data
  }

  const settingsResult = await getSystemSettings()
  const systemSettings = settingsResult.data

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* 左侧：Logo + 平台名称 - 服务端渲染,立即显示 */}
          <Link href="/" className="flex items-center gap-2 md:gap-4 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center overflow-hidden">
              {systemSettings?.platform_logo_url ? (
                <img
                  src={systemSettings.platform_logo_url}
                  alt="Platform Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-primary font-bold">商</span>
              )}
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-base md:text-lg">
                {systemSettings?.platform_name || "跨境服务商平台"}
              </h1>
              <p className="text-xs text-muted-foreground hidden md:block">
                {systemSettings?.platform_description || "汇聚优质跨境电商服务商"}
              </p>
            </div>
          </Link>

          {/* 右侧：登录状态 - 客户端组件处理交互 */}
          <NavigationClient
            initialUser={user}
            initialProfile={profile}
            systemSettings={systemSettings}
          />
        </div>
      </div>
    </header>
  )
}

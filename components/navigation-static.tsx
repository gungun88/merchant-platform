import { createClient } from "@/lib/supabase/server"
import { getSystemSettings } from "@/lib/actions/settings"
import Link from "next/link"

// 服务端组件 - Logo 和标题部分
export async function NavigationStatic() {
  // 服务端直接获取系统设置
  const settingsResult = await getSystemSettings()
  const systemSettings = settingsResult.data

  return (
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
  )
}

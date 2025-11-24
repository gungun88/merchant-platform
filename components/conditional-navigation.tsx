"use client"

import { usePathname } from "next/navigation"
import { Navigation } from "@/components/navigation"

export function ConditionalNavigation() {
  const pathname = usePathname()

  // 如果是管理后台路径，不显示导航栏
  if (pathname?.startsWith("/admin")) {
    return null
  }

  return <Navigation />
}

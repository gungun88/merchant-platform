import { NavigationStatic } from "./navigation-static"
import { NavigationClient } from "./navigation-client"

// 混合导航栏组件
// - 左侧: 服务端渲染 (Logo/标题) - 0秒立即显示
// - 右侧: 客户端渲染 (用户菜单) - 有骨架屏过渡
export function NavigationHybrid() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* 左侧: 服务端组件 - Logo和标题 (立即显示) */}
        <NavigationStatic />

        {/* 右侧: 客户端组件 - 用户菜单 (异步加载) */}
        <NavigationClient />
      </div>
    </header>
  )
}

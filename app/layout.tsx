import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import "./globals.css"
import { getSystemSettings } from "@/lib/actions/settings"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  // 获取系统设置
  const result = await getSystemSettings()
  const settings = result.data

  const title = settings?.platform_name || "跨境服务商平台"
  const description = settings?.platform_description || "一个面向跨境电商服务商的展示和对接平台"
  const faviconUrl = settings?.site_favicon_url

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    generator: "v0.app",
    icons: faviconUrl
      ? {
          icon: faviconUrl,
          shortcut: faviconUrl,
          apple: faviconUrl,
        }
      : undefined,
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        {children}
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}

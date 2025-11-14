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
  const description = settings?.platform_description || "一个面向跨境电商服务商的展示和对接平台，汇聚Shopify独立站、Facebook/TikTok开户、虚拟卡等跨境电商服务"
  const faviconUrl = settings?.site_favicon_url
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://你的域名.com"

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    keywords: [
      "跨境电商",
      "服务商平台",
      "Shopify独立站",
      "Facebook开户",
      "TikTok开户",
      "Google开户",
      "虚拟卡",
      "斗篷服务",
      "跨境服务",
      "电商代理",
      "Facebook账号",
    ],
    authors: [{ name: title }],
    creator: title,
    publisher: title,
    generator: "Next.js",
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: siteUrl,
      title,
      description,
      siteName: title,
      images: [
        {
          url: faviconUrl || `${siteUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [faviconUrl || `${siteUrl}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      // google: "your-google-site-verification-code",
      // yandex: "your-yandex-verification-code",
      // bing: "your-bing-verification-code",
    },
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

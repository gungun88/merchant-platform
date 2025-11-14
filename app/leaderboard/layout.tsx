import { Metadata } from "next"

export const metadata: Metadata = {
  title: "排行榜",
  description: "跨境服务商平台排行榜 - 用户积分排名、商家热度排行、最受欢迎服务商展示",
  keywords: [
    "排行榜",
    "积分排名",
    "商家排行",
    "热门服务商",
    "跨境电商排行榜",
  ],
  openGraph: {
    title: "排行榜 | 跨境服务商平台",
    description: "查看平台用户积分排名和热门商家排行",
    type: "website",
  },
}

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

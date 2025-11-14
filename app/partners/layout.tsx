import { Metadata } from "next"

export const metadata: Metadata = {
  title: "合作伙伴",
  description: "跨境服务商平台合作伙伴计划 - 寻找优质合作伙伴，共建跨境电商服务生态",
  keywords: [
    "合作伙伴",
    "商务合作",
    "平台合作",
    "跨境电商合作",
    "服务商合作",
  ],
  openGraph: {
    title: "合作伙伴 | 跨境服务商平台",
    description: "加入我们的合作伙伴计划，共建跨境电商服务生态",
    type: "website",
  },
}

export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

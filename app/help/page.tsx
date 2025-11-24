"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HelpCircle, MessageCircle, BookOpen, Shield, CreditCard, Users, FileText, ArrowLeft } from "lucide-react"
import { OfficialContactDialog } from "@/components/official-contact-dialog"

export default function HelpPage() {
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  // 处理锚点跳转
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      // 延迟一下确保 DOM 已完全渲染
      setTimeout(() => {
        const element = document.querySelector(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [])

  const categories = [
    {
      icon: Users,
      title: "新手入门",
      color: "text-blue-600",
      faqs: [
        {
          question: "如何注册成为平台用户?",
          answer: "点击右上角的\"登录\"按钮,选择\"注册新账号\",填写邮箱和密码即可完成注册。注册后可以收藏商家、积累积分等。"
        },
        {
          question: "如何搜索和筛选商家?",
          answer: "在首页可以通过服务类型、地区、价格区间等多个维度筛选商家。也可以直接在搜索框输入商家名称进行搜索。"
        },
        {
          question: "如何收藏商家?",
          answer: "在商家列表中,点击商家卡片右上角的星标图标即可收藏。收藏后可以在个人中心查看所有收藏的商家。"
        },
        {
          question: "如何联系商家?",
          answer: "点击商家卡片上的\"联系\"按钮,会弹出商家的联系方式,包括微信、QQ、电话等。"
        }
      ]
    },
    {
      icon: Shield,
      title: "押金商家",
      color: "text-amber-600",
      faqs: [
        {
          question: "什么是押金商家?",
          answer: "押金商家是缴纳了一定押金的商家,平台对其进行更严格的审核和监管,用户权益更有保障。押金商家会有特殊的标识显示。"
        },
        {
          question: "如何成为押金商家?",
          answer: "在商家管理后台,找到\"押金商家\"选项,选择押金金额(如500/1000/2000 USDT),上传支付凭证和交易哈希,提交申请等待审核。"
        },
        {
          question: "押金商家有什么特权?",
          answer: "押金商家可获得:1.每日登录奖励(默认50积分) 2.审核通过一次性奖励(默认1000积分) 3.押金商家专属标识 4.更高的用户信任度。具体积分奖励以系统设置为准。"
        },
        {
          question: "押金可以退还吗?",
          answer: "可以。押金缴纳3个月内退还扣除30%手续费,3个月后退还扣除15%手续费。在商家管理后台可以申请退还。"
        }
      ]
    },
    {
      icon: CreditCard,
      title: "积分系统",
      color: "text-green-600",
      faqs: [
        {
          question: "如何获得积分?",
          answer: "获得积分的方式包括:\n1. 注册账号(默认100积分)\n2. 完善个人资料、上传头像(默认30积分)\n3. 每日登录签到(默认5积分)\n4. 邀请好友注册(默认100积分)\n5. 押金商家每日登录额外奖励(默认50积分)\n6. 入驻商家(默认50积分)\n7. 论坛硬币兑换积分(10硬币 = 1积分,每日限额1000硬币)\n8. 特殊情况由管理员手动赠送(比如节日或者活动日等等)\n\n注:具体积分数量以系统设置为准,管理员可随时调整。"
        },
        {
          question: "积分可以用来做什么?",
          answer: "积分可用于:\n1. 查看商家联系方式(默认10积分/次)\n2. 商家置顶推广(默认1000积分/天)\n3. 编辑商家信息(默认100积分/次)\n4. 未来将推出积分商城,可兑换各种权益和优惠\n\n注:具体积分消耗以系统设置为准,管理员可随时调整。"
        },
        {
          question: "积分会过期吗?",
          answer: "目前积分不会过期,可以一直累积使用。但平台保留调整积分规则的权利,会提前通知用户。"
        },
        {
          question: "如何查看积分明细?",
          answer: "在导航栏用户菜单 > 积分记录可以查看当前积分明细。"
        },
        {
          question: "如何通过论坛硬币兑换积分?",
          answer: "如果您是 DoingFB 官方论坛用户,可以使用论坛硬币兑换商家平台积分:\n\n兑换步骤:\n1. 在论坛点击用户头像\n2. 进入个人主页\n3. 在左侧导航栏找到\"兑换积分\"选项\n4. 输入要兑换的硬币数量(最少10硬币)\n5. 点击\"立即兑换\"按钮\n6. 系统自动扣除硬币并增加积分\n\n兑换规则:\n• 兑换比例: 10硬币 = 1积分\n• 最小兑换: 10硬币\n• 数量要求: 必须是10的倍数\n• 每日限额: 1000硬币/用户/天(即100积分/天)\n• 账户关联: 需在论坛和商家平台使用相同邮箱\n\n注意事项:\n• 兑换是实时的,成功后立即到账\n• 请确保您的账号邮箱在两个平台保持一致\n• 兑换记录可在积分记录中查看"
        }
      ]
    },
    {
      icon: BookOpen,
      title: "商家管理",
      color: "text-purple-600",
      faqs: [
        {
          question: "如何入驻成为商家?",
          answer: "登录后,点击\"+免费入驻\",填写商家信息、上传Logo,点击提交入驻申请。无需审核门槛,即可展示。"
        },
        {
          question: "如何编辑商家信息?",
          answer: "进入\"商家后台\"页面,找到您的商家,点击\"编辑\"按钮,修改信息后提交。保存即可更新生效。"
        },
        {
          question: "如何置顶我的商家?",
          answer: "在商家列表中,点击商家操作菜单的\"置顶推广\",选择置顶天数(默认消耗1000积分/天,具体以系统设置为准),确认支付积分即可置顶。"
        },
        {
          question: "为什么我的商家被下架了?",
          answer: "可能原因:1.信息虚假或违规 2.用户举报且经核实 3.长期不活跃。可以在商家管理后台查看具体原因,联系客服申诉。"
        }
      ]
    },
    {
      icon: Shield,
      title: "安全与规则",
      color: "text-red-600",
      faqs: [
        {
          question: "如何举报违规商家?",
          answer: "在商家卡片的操作菜单中选择\"举报\",填写举报原因和证据,提交后平台会在3个工作日内处理。"
        },
        {
          question: "平台如何保障用户权益?",
          answer: "1.严格审核商家资质 2.押金商家制度 3.用户评价和举报机制 4.24小时客服支持 5.违规商家下架处理"
        },
        {
          question: "账号安全提示",
          answer: "1.定期修改密码 2.不要向他人透露账号信息 3.不要在不安全的网络环境登录 4.发现异常及时联系客服"
        },
        {
          question: "平台禁止哪些行为?",
          answer: "禁止:1.发布虚假信息 2.恶意刷量 3.骚扰用户 4.违法违规内容 5.恶意竞争 违规将被处罚甚至封号。"
        }
      ]
    },
    {
      icon: FileText,
      title: "其他问题",
      color: "text-gray-600",
      faqs: [
        {
          question: "如何联系客服?",
          answer: "点击页面上的\"联系客服\"按钮,或通过右侧悬浮菜单打开客服联系方式。工作时间:周一至周日 9:00-22:00"
        },
        {
          question: "平台收费吗?",
          answer: "平台基础功能免费使用。增值服务如商家置顶推广需要消耗积分。押金商家需要缴纳押金,但可退还。"
        },
        {
          question: "如何成为合作伙伴?",
          answer: "如果您有优质的商家资源或合作意向,请访问\"合作伙伴\"页面了解详情,或直接联系官方客服洽谈合作。"
        },
        {
          question: "平台未来有什么计划?",
          answer: "我们将持续优化用户体验,推出更多功能:积分商城、商家评价系统、数据分析工具、移动端APP等。敬请期待!"
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 返回按钮和页面标题 */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <HelpCircle className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold">帮助中心</h1>
            </div>
            <p className="text-muted-foreground">常见问题解答 FAQ</p>
          </div>
        </div>

        {/* 快捷联系 */}
        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-lg">找不到答案?</h3>
                  <p className="text-sm text-muted-foreground">联系我们的客服团队,我们随时为您服务</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => window.open("https://doingfb.com/", "_blank")}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  访问官方论坛
                </Button>
                <Button variant="outline" onClick={() => setContactDialogOpen(true)}>
                  联系客服
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ 分类 */}
        <div className="grid gap-6">
          {categories.map((category, idx) => {
            const Icon = category.icon
            return (
              <Card
                key={idx}
                id={category.title === "积分系统" ? "coin-exchange" : undefined}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${category.color}`} />
                    {category.title}
                    <Badge variant="secondary">{category.faqs.length} 个问题</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {category.faqs.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${idx}-${index}`}>
                        <AccordionTrigger className="text-left">
                          <span className="font-medium">{faq.question}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted p-4 rounded-lg">
                            {faq.answer}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* 底部提示 */}
        <Card className="mt-8 bg-amber-50 border-amber-200">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              💡 提示:如果您的问题在这里没有找到答案,欢迎
              <a
                href="https://doingfb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline mx-1"
              >
                访问官方论坛
              </a>
              或
              <button
                onClick={() => setContactDialogOpen(true)}
                className="text-blue-600 underline mx-1 hover:text-blue-700"
              >
                联系客服
              </button>
              获取帮助
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 官方客服对话框 */}
      <OfficialContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </div>
  )
}

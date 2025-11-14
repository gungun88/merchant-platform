import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 基础URL - 部署后需要修改为实际域名
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://你的域名.com'

  // 静态页面
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/partners`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
  ]

  try {
    // 获取所有商家动态页面
    const supabase = await createClient()
    const { data: merchants, error } = await supabase
      .from('merchants')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching merchants for sitemap:', error)
      return staticPages
    }

    // 商家详情页面
    const merchantPages = (merchants || []).map((merchant) => ({
      url: `${baseUrl}/merchant/${merchant.id}`,
      lastModified: new Date(merchant.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

    return [...staticPages, ...merchantPages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticPages
  }
}

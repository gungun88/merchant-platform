import Script from 'next/script'

interface StructuredDataProps {
  merchants?: Array<{
    id: string
    name: string
    description: string
    service_type: string
    price_range: string
    location: string
  }>
  platformName?: string
  platformDescription?: string
}

export function StructuredData({ merchants, platformName, platformDescription }: StructuredDataProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://你的域名.com'

  // 网站组织结构化数据
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: platformName || '跨境服务商平台',
    description: platformDescription || '一个面向跨境电商服务商的展示和对接平台',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['Chinese', 'English'],
    },
  }

  // 网站结构化数据
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: platformName || '跨境服务商平台',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  // 商家列表结构化数据
  const itemListSchema = merchants && merchants.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '跨境服务商列表',
    numberOfItems: merchants.length,
    itemListElement: merchants.slice(0, 20).map((merchant, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: merchant.name,
        description: merchant.description,
        provider: {
          '@type': 'Organization',
          name: merchant.name,
        },
        serviceType: merchant.service_type,
        areaServed: merchant.location || '全国',
        offers: {
          '@type': 'Offer',
          price: merchant.price_range,
          priceCurrency: 'CNY',
        },
      },
    })),
  } : null

  return (
    <>
      {/* 组织结构化数据 */}
      <Script
        id="organization-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />

      {/* 网站结构化数据 */}
      <Script
        id="website-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />

      {/* 商家列表结构化数据 */}
      {itemListSchema && (
        <Script
          id="itemlist-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListSchema),
          }}
        />
      )}
    </>
  )
}

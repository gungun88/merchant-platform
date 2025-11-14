/**
 * 邮箱验证工具（从数据库读取配置）
 * 支持在后台管理界面动态配置
 */

import { createClient } from '@/lib/supabase/server'

export type EmailValidationMode = 'whitelist' | 'blacklist' | 'both' | 'disabled'

export interface EmailValidationResult {
  valid: boolean
  reason?: string
  domain: string
}

export interface EmailValidationConfig {
  enabled: boolean
  mode: EmailValidationMode
  allowedDomains: string[]
  blockedDomains: string[]
}

/**
 * 从数据库获取邮箱验证配置
 */
export async function getEmailValidationConfig(): Promise<EmailValidationConfig> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('system_settings')
      .select('email_validation_enabled, email_validation_mode, email_allowed_domains, email_blocked_domains')
      .single()

    if (error || !data) {
      console.error('Failed to load email validation config:', error)
      // 返回默认配置
      return getDefaultConfig()
    }

    return {
      enabled: data.email_validation_enabled ?? true,
      mode: (data.email_validation_mode as EmailValidationMode) ?? 'both',
      allowedDomains: data.email_allowed_domains ?? [],
      blockedDomains: data.email_blocked_domains ?? [],
    }
  } catch (error) {
    console.error('Error loading email validation config:', error)
    return getDefaultConfig()
  }
}

/**
 * 默认配置（备用）
 */
function getDefaultConfig(): EmailValidationConfig {
  return {
    enabled: true,
    mode: 'both',
    allowedDomains: [
      'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
      'qq.com', '163.com', '126.com', 'sina.com', 'aliyun.com'
    ],
    blockedDomains: [
      '10minutemail.com', 'tempmail.com', 'guerrillamail.com', 'mailinator.com',
      'yopmail.com', 'maildrop.cc', 'trashmail.com'
    ]
  }
}

/**
 * 验证邮箱地址（从数据库读取配置）
 */
export async function validateEmailFromDB(email: string): Promise<EmailValidationResult> {
  // 1. 基本格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      reason: '邮箱格式不正确',
      domain: ''
    }
  }

  // 2. 提取域名
  const domain = email.split('@')[1].toLowerCase()

  // 3. 获取配置
  const config = await getEmailValidationConfig()

  // 4. 如果未启用验证，直接通过
  if (!config.enabled || config.mode === 'disabled') {
    return { valid: true, domain }
  }

  // 5. 根据模式验证
  return validateWithConfig(domain, config)
}

/**
 * 根据配置验证域名
 */
function validateWithConfig(domain: string, config: EmailValidationConfig): EmailValidationResult {
  switch (config.mode) {
    case 'whitelist':
      // 白名单模式：只允许列表中的域名
      if (!config.allowedDomains.includes(domain)) {
        return {
          valid: false,
          reason: '请使用主流邮箱提供商注册（如 Gmail、QQ、163 等）',
          domain
        }
      }
      break

    case 'blacklist':
      // 黑名单模式：阻止列表中的域名
      if (config.blockedDomains.includes(domain)) {
        return {
          valid: false,
          reason: '不允许使用临时邮箱注册',
          domain
        }
      }
      break

    case 'both':
      // 混合模式
      // 1. 首先检查黑名单
      if (config.blockedDomains.includes(domain)) {
        return {
          valid: false,
          reason: '不允许使用临时邮箱注册',
          domain
        }
      }
      // 2. 然后检查白名单
      if (!config.allowedDomains.includes(domain)) {
        return {
          valid: false,
          reason: '请使用主流邮箱提供商注册（如 Gmail、QQ、163 等）',
          domain
        }
      }
      break
  }

  return { valid: true, domain }
}

/**
 * 客户端使用的验证函数（从配置对象验证）
 */
export function validateEmailWithConfig(
  email: string,
  config: EmailValidationConfig
): EmailValidationResult {
  // 1. 基本格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      reason: '邮箱格式不正确',
      domain: ''
    }
  }

  // 2. 提取域名
  const domain = email.split('@')[1].toLowerCase()

  // 3. 如果未启用验证，直接通过
  if (!config.enabled || config.mode === 'disabled') {
    return { valid: true, domain }
  }

  // 4. 根据配置验证
  return validateWithConfig(domain, config)
}

/**
 * 获取邮箱域名
 */
export function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || ''
}

/**
 * 获取邮箱提供商友好名称
 */
export function getEmailProviderName(email: string): string {
  const domain = getEmailDomain(email)

  const providers: Record<string, string> = {
    'gmail.com': 'Gmail',
    'outlook.com': 'Outlook',
    'hotmail.com': 'Hotmail',
    'yahoo.com': 'Yahoo',
    'icloud.com': 'iCloud',
    'qq.com': 'QQ邮箱',
    'vip.qq.com': 'QQ邮箱VIP',
    'foxmail.com': 'Foxmail',
    '163.com': '网易163',
    '126.com': '网易126',
    'sina.com': '新浪邮箱',
    'aliyun.com': '阿里云邮箱',
  }

  return providers[domain] || domain
}

// 导出类型供外部使用
export type { EmailValidationConfig }

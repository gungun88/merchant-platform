/**
 * 邮箱验证工具
 * 用于检测一次性邮箱和只允许主流邮箱提供商
 */

// 主流邮箱提供商白名单（推荐）
const ALLOWED_EMAIL_DOMAINS = [
  // 国际主流邮箱
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'protonmail.com',
  'aol.com',

  // 中国主流邮箱
  'qq.com',
  'vip.qq.com',
  'foxmail.com',
  '163.com',
  'vip.163.com',
  '126.com',
  'yeah.net',
  '188.com',
  'sina.com',
  'sina.cn',
  'sohu.com',
  'tom.com',
  '139.com',       // 中国移动
  '189.cn',        // 中国电信
  'wo.cn',         // 中国联通
  'aliyun.com',    // 阿里云

  // 企业/教育邮箱（可选）
  // 'company.com',  // 添加您信任的企业域名
]

// 已知一次性邮箱黑名单（部分示例）
const DISPOSABLE_EMAIL_DOMAINS = [
  // 常见一次性邮箱
  '10minutemail.com',
  '20minutemail.com',
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  'yopmail.com',
  'maildrop.cc',
  'getnada.com',
  'temp-mail.org',
  'mohmal.com',
  'sharklasers.com',
  'guerrillamail.info',
  'grr.la',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me',
  'trashmail.com',
  'trashmail.net',
  'emailondeck.com',
  'fakeinbox.com',
  'mailnesia.com',
  'mintemail.com',
  'mytrashmail.com',
  'tempinbox.com',
  'jetable.org',
  'getairmail.com',
  'dispostable.com',
  'bugmenot.com',
  'mt2015.com',
  'bccto.me',
  'disposableemailaddresses.com',

  // 中文一次性邮箱
  'linshiyouxiang.net',
  '027168.com',
  'zzrgg.com',
  'bccto.cc',
  'chacuo.net',
  '027168.com',
]

export type EmailValidationMode = 'whitelist' | 'blacklist' | 'both'

export interface EmailValidationResult {
  valid: boolean
  reason?: string
  domain: string
}

/**
 * 验证邮箱地址
 * @param email 邮箱地址
 * @param mode 验证模式
 * - 'whitelist': 只允许白名单中的邮箱
 * - 'blacklist': 只阻止黑名单中的邮箱
 * - 'both': 同时使用白名单和黑名单（推荐）
 */
export function validateEmail(
  email: string,
  mode: EmailValidationMode = 'both'
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

  // 2. 提取域名（转小写）
  const domain = email.split('@')[1].toLowerCase()

  // 3. 根据模式验证
  switch (mode) {
    case 'whitelist':
      // 白名单模式：只允许列表中的域名
      if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        return {
          valid: false,
          reason: '请使用主流邮箱提供商注册（如 Gmail、QQ、163 等）',
          domain
        }
      }
      break

    case 'blacklist':
      // 黑名单模式：阻止列表中的域名
      if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
        return {
          valid: false,
          reason: '不允许使用临时邮箱注册',
          domain
        }
      }
      break

    case 'both':
      // 混合模式（推荐）
      // 1. 首先检查黑名单
      if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
        return {
          valid: false,
          reason: '不允许使用临时邮箱注册',
          domain
        }
      }
      // 2. 然后检查白名单
      if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        return {
          valid: false,
          reason: '请使用主流邮箱提供商注册（如 Gmail、QQ、163 等）',
          domain
        }
      }
      break
  }

  return {
    valid: true,
    domain
  }
}

/**
 * 检查是否为一次性邮箱（仅黑名单）
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain)
}

/**
 * 检查是否为允许的邮箱域名（仅白名单）
 */
export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.includes(domain)
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

// 导出常量供外部使用
export { ALLOWED_EMAIL_DOMAINS, DISPOSABLE_EMAIL_DOMAINS }

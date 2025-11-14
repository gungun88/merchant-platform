/**
 * 🔒 HTML Sanitization Utilities (XSS防护工具)
 *
 * 使用DOMPurify清理用户输入的HTML内容，防止XSS攻击
 * Use DOMPurify to sanitize user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * 配置选项：严格模式（纯文本）
 * 移除所有HTML标签，只保留纯文本
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: [], // 不允许任何HTML标签
  ALLOWED_ATTR: [], // 不允许任何属性
  KEEP_CONTENT: true, // 保留标签内的文本内容
}

/**
 * 配置选项：基础模式（允许简单格式化）
 * 允许基本的文本格式化标签
 */
const BASIC_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
}

/**
 * 配置选项：富文本模式（允许更多HTML标签）
 * 允许常见的富文本编辑器标签
 */
const RICH_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'b', 'i', 'em', 'strong', 'u', 's', 'del',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
  ],
  ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'title'],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
}

/**
 * 清理HTML内容 - 严格模式（纯文本）
 * 适用于：商家名称、用户名、标题等不应包含HTML的字段
 *
 * @param input 用户输入的内容
 * @returns 清理后的纯文本
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, STRICT_CONFIG)
}

/**
 * 清理HTML内容 - 基础模式（简单格式化）
 * 适用于：评论、简短描述等可以有简单格式的字段
 *
 * @param input 用户输入的内容
 * @returns 清理后的HTML（只包含基本格式化标签）
 */
export function sanitizeBasicHTML(input: string | null | undefined): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, BASIC_CONFIG)
}

/**
 * 清理HTML内容 - 富文本模式
 * 适用于：商家详细描述、文章内容等需要富文本的字段
 *
 * @param input 用户输入的内容
 * @returns 清理后的HTML（包含富文本标签）
 */
export function sanitizeRichHTML(input: string | null | undefined): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, RICH_CONFIG)
}

/**
 * 清理URL
 * 确保URL是安全的，防止javascript:、data:等危险协议
 *
 * @param url 用户输入的URL
 * @returns 安全的URL或空字符串
 */
export function sanitizeURL(url: string | null | undefined): string {
  if (!url) return ''

  // 移除所有HTML标签
  const cleanUrl = DOMPurify.sanitize(url, STRICT_CONFIG)

  // 检查协议是否安全
  const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:']
  try {
    const parsedUrl = new URL(cleanUrl)
    if (!safeProtocols.includes(parsedUrl.protocol)) {
      console.warn(`[XSS防护] 检测到不安全的URL协议: ${parsedUrl.protocol}`)
      return ''
    }
    return cleanUrl
  } catch {
    // 如果不是有效的URL，检查是否是相对路径
    if (cleanUrl.startsWith('/') || cleanUrl.startsWith('./') || cleanUrl.startsWith('../')) {
      return cleanUrl
    }
    console.warn(`[XSS防护] 无效的URL: ${cleanUrl}`)
    return ''
  }
}

/**
 * 清理JSON字符串
 * 防止在JSON中注入恶意脚本
 *
 * @param jsonString JSON字符串
 * @returns 清理后的JSON对象或null
 */
export function sanitizeJSON(jsonString: string | null | undefined): any {
  if (!jsonString) return null

  try {
    const parsed = JSON.parse(jsonString)

    // 递归清理对象中的所有字符串值
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeText(obj)
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject)
      } else if (obj && typeof obj === 'object') {
        const cleaned: any = {}
        for (const key in obj) {
          cleaned[key] = sanitizeObject(obj[key])
        }
        return cleaned
      }
      return obj
    }

    return sanitizeObject(parsed)
  } catch (error) {
    console.error('[XSS防护] JSON解析失败:', error)
    return null
  }
}

/**
 * 验证和清理文件名
 * 防止路径遍历攻击（../../../etc/passwd）
 *
 * @param filename 文件名
 * @returns 安全的文件名
 */
export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename) return ''

  // 移除路径分隔符和特殊字符
  const cleaned = filename
    .replace(/[\/\\]/g, '') // 移除路径分隔符
    .replace(/\.\./g, '') // 移除..
    .replace(/[<>:"|?*]/g, '') // 移除Windows不允许的字符
    .trim()

  // 限制长度
  return cleaned.slice(0, 255)
}

/**
 * 批量清理对象中的字符串字段
 *
 * @param obj 包含用户输入的对象
 * @param mode 清理模式：'strict' | 'basic' | 'rich'
 * @returns 清理后的对象
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  mode: 'strict' | 'basic' | 'rich' = 'strict'
): T {
  const result: any = {}

  for (const key in obj) {
    const value = obj[key]

    if (typeof value === 'string') {
      switch (mode) {
        case 'basic':
          result[key] = sanitizeBasicHTML(value)
          break
        case 'rich':
          result[key] = sanitizeRichHTML(value)
          break
        case 'strict':
        default:
          result[key] = sanitizeText(value)
          break
      }
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? sanitizeText(item) : item
      )
    } else {
      result[key] = value
    }
  }

  return result as T
}

/**
 * 清理搜索词
 * 特别处理搜索输入，防止SQL注入和XSS
 *
 * @param searchTerm 搜索词
 * @returns 安全的搜索词
 */
export function sanitizeSearchTerm(searchTerm: string | null | undefined): string {
  if (!searchTerm) return ''

  // 1. 首先清理HTML标签
  let cleaned = sanitizeText(searchTerm)

  // 2. 移除SQL特殊字符（额外保护，虽然我们已经使用参数化查询）
  cleaned = cleaned.replace(/['";\\]/g, '')

  // 3. 限制长度
  cleaned = cleaned.slice(0, 100)

  return cleaned.trim()
}

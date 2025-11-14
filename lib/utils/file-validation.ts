/**
 * 🔒 File Upload Security Validation (文件上传安全验证)
 *
 * 防止恶意文件上传，包括：
 * - 文件类型验证
 * - 文件大小限制
 * - 文件名清理
 * - MIME类型检测
 */

import { sanitizeFilename } from './sanitize'

/**
 * 允许的图片文件类型
 */
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
} as const

/**
 * 允许的文档文件类型
 */
export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
} as const

/**
 * 文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS = {
  avatar: 5 * 1024 * 1024, // 5MB - 头像
  logo: 5 * 1024 * 1024, // 5MB - 商家Logo
  image: 10 * 1024 * 1024, // 10MB - 一般图片
  document: 20 * 1024 * 1024, // 20MB - 文档
  video: 100 * 1024 * 1024, // 100MB - 视频
} as const

/**
 * 文件验证结果接口
 */
export interface FileValidationResult {
  valid: boolean
  error?: string
  sanitizedFilename?: string
  fileSize?: number
  fileType?: string
}

/**
 * 验证文件类型是否允许
 * @param file File对象或文件MIME类型字符串
 * @param allowedTypes 允许的文件类型对象
 * @returns 是否允许
 */
export function validateFileType(
  file: File | string,
  allowedTypes: Record<string, readonly string[]>
): boolean {
  const mimeType = typeof file === 'string' ? file : file.type
  return mimeType in allowedTypes
}

/**
 * 验证文件大小
 * @param fileSize 文件大小（字节）
 * @param maxSize 最大允许大小（字节）
 * @returns 是否在允许范围内
 */
export function validateFileSize(fileSize: number, maxSize: number): boolean {
  return fileSize > 0 && fileSize <= maxSize
}

/**
 * 验证文件扩展名
 * @param filename 文件名
 * @param allowedTypes 允许的文件类型对象
 * @returns 是否允许
 */
export function validateFileExtension(
  filename: string,
  allowedTypes: Record<string, readonly string[]>
): boolean {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)
  if (!extension) return false

  const ext = extension[0]
  return Object.values(allowedTypes).some((extensions) =>
    extensions.includes(ext)
  )
}

/**
 * 检测危险的文件扩展名（双重扩展名攻击）
 * @param filename 文件名
 * @returns 是否包含危险扩展名
 */
export function detectDangerousExtensions(filename: string): boolean {
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
    '.jar', '.zip', '.rar', '.7z', '.tar', '.gz',
    '.php', '.asp', '.aspx', '.jsp', '.cgi', '.pl',
    '.sh', '.bash', '.ps1', '.py', '.rb',
  ]

  const lowerFilename = filename.toLowerCase()
  return dangerousExtensions.some(ext => lowerFilename.includes(ext))
}

/**
 * 验证图片文件（用于头像、Logo等）
 * @param file File对象
 * @param maxSize 最大文件大小（可选，默认5MB）
 * @returns 验证结果
 */
export function validateImageFile(
  file: File,
  maxSize: number = FILE_SIZE_LIMITS.avatar
): FileValidationResult {
  // 1. 验证文件名
  if (!file.name) {
    return { valid: false, error: '文件名不能为空' }
  }

  // 2. 清理文件名
  const sanitizedName = sanitizeFilename(file.name)
  if (!sanitizedName) {
    return { valid: false, error: '无效的文件名' }
  }

  // 3. 检测危险扩展名
  if (detectDangerousExtensions(sanitizedName)) {
    return { valid: false, error: '检测到危险的文件类型' }
  }

  // 4. 验证文件类型（MIME类型）
  if (!validateFileType(file, ALLOWED_IMAGE_TYPES)) {
    return {
      valid: false,
      error: `不支持的文件类型。仅支持: JPG, PNG, GIF, WebP, SVG`,
    }
  }

  // 5. 验证文件扩展名（防止MIME类型伪造）
  if (!validateFileExtension(sanitizedName, ALLOWED_IMAGE_TYPES)) {
    return {
      valid: false,
      error: `不支持的文件扩展名。仅支持: .jpg, .jpeg, .png, .gif, .webp, .svg`,
    }
  }

  // 6. 验证文件大小
  if (!validateFileSize(file.size, maxSize)) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `文件大小超过限制。最大允许: ${maxSizeMB}MB`,
    }
  }

  // 7. 检测空文件
  if (file.size === 0) {
    return { valid: false, error: '文件为空' }
  }

  return {
    valid: true,
    sanitizedFilename: sanitizedName,
    fileSize: file.size,
    fileType: file.type,
  }
}

/**
 * 验证文档文件
 * @param file File对象
 * @param maxSize 最大文件大小（可选，默认20MB）
 * @returns 验证结果
 */
export function validateDocumentFile(
  file: File,
  maxSize: number = FILE_SIZE_LIMITS.document
): FileValidationResult {
  // 1. 验证文件名
  if (!file.name) {
    return { valid: false, error: '文件名不能为空' }
  }

  // 2. 清理文件名
  const sanitizedName = sanitizeFilename(file.name)
  if (!sanitizedName) {
    return { valid: false, error: '无效的文件名' }
  }

  // 3. 检测危险扩展名
  if (detectDangerousExtensions(sanitizedName)) {
    return { valid: false, error: '检测到危险的文件类型' }
  }

  // 4. 验证文件类型（MIME类型）
  if (!validateFileType(file, ALLOWED_DOCUMENT_TYPES)) {
    return {
      valid: false,
      error: `不支持的文件类型。仅支持: PDF, Word, Excel`,
    }
  }

  // 5. 验证文件扩展名
  if (!validateFileExtension(sanitizedName, ALLOWED_DOCUMENT_TYPES)) {
    return {
      valid: false,
      error: `不支持的文件扩展名。仅支持: .pdf, .doc, .docx, .xls, .xlsx`,
    }
  }

  // 6. 验证文件大小
  if (!validateFileSize(file.size, maxSize)) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `文件大小超过限制。最大允许: ${maxSizeMB}MB`,
    }
  }

  // 7. 检测空文件
  if (file.size === 0) {
    return { valid: false, error: '文件为空' }
  }

  return {
    valid: true,
    sanitizedFilename: sanitizedName,
    fileSize: file.size,
    fileType: file.type,
  }
}

/**
 * 通用文件验证函数
 * @param file File对象
 * @param options 验证选项
 * @returns 验证结果
 */
export function validateFile(
  file: File,
  options: {
    allowedTypes: Record<string, readonly string[]>
    maxSize: number
    fileTypeName?: string
  }
): FileValidationResult {
  const { allowedTypes, maxSize, fileTypeName = '文件' } = options

  // 1. 验证文件名
  if (!file.name) {
    return { valid: false, error: '文件名不能为空' }
  }

  // 2. 清理文件名
  const sanitizedName = sanitizeFilename(file.name)
  if (!sanitizedName) {
    return { valid: false, error: '无效的文件名' }
  }

  // 3. 检测危险扩展名
  if (detectDangerousExtensions(sanitizedName)) {
    return { valid: false, error: '检测到危险的文件类型' }
  }

  // 4. 验证文件类型（MIME类型）
  if (!validateFileType(file, allowedTypes)) {
    const supportedTypes = Object.values(allowedTypes).flat().join(', ')
    return {
      valid: false,
      error: `不支持的${fileTypeName}类型。仅支持: ${supportedTypes}`,
    }
  }

  // 5. 验证文件扩展名
  if (!validateFileExtension(sanitizedName, allowedTypes)) {
    const supportedExtensions = Object.values(allowedTypes).flat().join(', ')
    return {
      valid: false,
      error: `不支持的文件扩展名。仅支持: ${supportedExtensions}`,
    }
  }

  // 6. 验证文件大小
  if (!validateFileSize(file.size, maxSize)) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `${fileTypeName}大小超过限制。最大允许: ${maxSizeMB}MB`,
    }
  }

  // 7. 检测空文件
  if (file.size === 0) {
    return { valid: false, error: `${fileTypeName}为空` }
  }

  return {
    valid: true,
    sanitizedFilename: sanitizedName,
    fileSize: file.size,
    fileType: file.type,
  }
}

/**
 * 检测文件内容是否匹配MIME类型（需要读取文件内容）
 * 通过检查文件的魔术数字（Magic Number）来验证文件真实类型
 *
 * @param file File对象
 * @returns Promise<boolean> 是否匹配
 */
export async function validateFileMagicNumber(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      if (!e.target?.result) {
        resolve(false)
        return
      }

      const arr = new Uint8Array(e.target.result as ArrayBuffer).subarray(0, 4)
      let header = ''
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16).padStart(2, '0')
      }

      // 检查常见文件类型的魔术数字
      const magicNumbers: Record<string, string[]> = {
        'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
        'image/png': ['89504e47'],
        'image/gif': ['47494638'],
        'application/pdf': ['25504446'],
      }

      const declaredType = file.type
      const expectedHeaders = magicNumbers[declaredType]

      if (!expectedHeaders) {
        // 如果不在验证列表中，允许通过（例如WebP、SVG等）
        resolve(true)
        return
      }

      // 检查文件头是否匹配声明的MIME类型
      const matches = expectedHeaders.some(expected => header.startsWith(expected))
      resolve(matches)
    }

    reader.onerror = () => resolve(false)
    reader.readAsArrayBuffer(file.slice(0, 4))
  })
}

/**
 * 格式化文件大小显示
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

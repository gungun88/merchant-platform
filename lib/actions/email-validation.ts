/**
 * 邮箱验证 Server Actions
 */

'use server'

import { validateEmailFromDB, getEmailValidationConfig } from '@/lib/utils/email-validator-db'
import type { EmailValidationConfig, EmailValidationResult } from '@/lib/utils/email-validator-db'

/**
 * 验证邮箱地址（Server Action）
 */
export async function validateEmailAction(email: string): Promise<EmailValidationResult> {
  return validateEmailFromDB(email)
}

/**
 * 获取邮箱验证配置（Server Action）
 */
export async function getEmailConfigAction(): Promise<EmailValidationConfig> {
  return getEmailValidationConfig()
}

import { safeStorage } from 'electron'
import type { AiConfig, AiConfigPublic, AiConfigSaveInput } from '../shared/types'
import { configRepo } from '../db/database'
import { httpBaseUrl } from './validation'

const ENCRYPTED_PREFIX = 'enc:v1:'

function encryptApiKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统无法使用安全凭据存储，请稍后重试')
  }
  return `${ENCRYPTED_PREFIX}${safeStorage.encryptString(apiKey).toString('base64')}`
}

function readApiKey(): string {
  const stored = configRepo.get('ai_api_key')
  if (!stored) return ''
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    // 兼容旧版本明文数据；系统安全存储可用时立即原位升级。
    if (safeStorage.isEncryptionAvailable()) configRepo.set('ai_api_key', encryptApiKey(stored))
    return stored
  }
  try {
    return safeStorage.decryptString(Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64'))
  } catch {
    throw new Error('API Key 无法解密，请在设置中重新填写')
  }
}

export function getPublicAiConfig(): AiConfigPublic {
  return {
    baseUrl: configRepo.get('ai_base_url') || 'https://api.openai.com/v1',
    model: configRepo.get('ai_model') || 'gpt-4o-mini',
    hasApiKey: Boolean(readApiKey())
  }
}

export function saveAiConfig(input: AiConfigSaveInput): AiConfigPublic {
  configRepo.set('ai_base_url', httpBaseUrl(input.baseUrl))
  configRepo.set('ai_model', input.model)
  if (input.clearApiKey) {
    configRepo.set('ai_api_key', '')
  } else if (input.apiKey?.trim()) {
    configRepo.set('ai_api_key', encryptApiKey(input.apiKey.trim()))
  }
  return getPublicAiConfig()
}

export function getPrivateAiConfig(): AiConfig {
  return {
    baseUrl: httpBaseUrl(configRepo.get('ai_base_url') || 'https://api.openai.com/v1'),
    model: configRepo.get('ai_model') || 'gpt-4o-mini',
    apiKey: readApiKey()
  }
}

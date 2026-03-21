import crypto from 'node:crypto'

import { supabaseService } from './supabase.js'

type ApiKeyRecord = {
  id: string
  user_id: string
  key_hash: string
}

export class ApiKeyNotFoundError extends Error {
  constructor() {
    super('API key not found')
    this.name = 'ApiKeyNotFoundError'
  }
}

export function generateApiKey(): {
  raw: string
  hash: string
  prefix: string
} {
  const raw = `sl_live_${crypto.randomBytes(16).toString('hex')}`
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const prefix = raw.substring(0, 12)

  return { raw, hash, prefix }
}

export async function validateApiKey(
  raw: string,
): Promise<{ userId: string; apiKeyId: string } | null> {
  const incomingHash = crypto.createHash('sha256').update(raw).digest('hex')

  const { data, error } = await supabaseService
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_hash', incomingHash)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const record = data as ApiKeyRecord
  const storedHashBuffer = Buffer.from(record.key_hash, 'utf8')
  const incomingHashBuffer = Buffer.from(incomingHash, 'utf8')

  if (
    storedHashBuffer.length !== incomingHashBuffer.length ||
    !crypto.timingSafeEqual(storedHashBuffer, incomingHashBuffer)
  ) {
    return null
  }

  return {
    userId: record.user_id,
    apiKeyId: record.id,
  }
}

export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseService
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new ApiKeyNotFoundError()
  }
}

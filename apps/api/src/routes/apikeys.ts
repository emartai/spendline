import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import {
  ApiKeyNotFoundError,
  generateApiKey,
  revokeApiKey,
} from '../lib/apikeys.js'
import { supabaseAnon, supabaseService } from '../lib/supabase.js'

type ApiKeyRow = {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

async function requireUserId(request: FastifyRequest): Promise<string | null> {
  const authHeader = request.headers.authorization
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    return null
  }

  const {
    data: { user },
    error,
  } = await supabaseAnon.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user.id
}

function hasHtml(value: string): boolean {
  return /<[^>]*>/u.test(value)
}

function validateApiKeyName(value: unknown): { name?: string; error?: string } {
  if (typeof value !== 'string') {
    return { error: 'name is required' }
  }

  const name = value.trim()

  if (name.length === 0) {
    return { error: 'name is required' }
  }

  if (name.length > 50) {
    return { error: 'name must be at most 50 characters' }
  }

  if (hasHtml(name)) {
    return { error: 'name must not contain HTML' }
  }

  return { name }
}

export const apikeyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/apikeys', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const { data, error } = await supabaseService
        .from('api_keys')
        .select('id, name, key_prefix, created_at, last_used_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return reply.status(200).send({
        api_keys: ((data ?? []) as ApiKeyRow[]).map((row) => ({
          id: row.id,
          name: row.name,
          key_prefix: row.key_prefix,
          created_at: row.created_at,
          last_used_at: row.last_used_at,
        })),
      })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to list API keys')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })

  app.post('/v1/apikeys', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const body = request.body as { name?: unknown } | undefined
      const { name, error: validationError } = validateApiKeyName(body?.name)

      if (validationError || !name) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 400,
          details: [validationError ?? 'name is required'],
        })
      }

      const generatedKey = generateApiKey()
      const { data, error } = await supabaseService
        .from('api_keys')
        .insert({
          user_id: userId,
          key_hash: generatedKey.hash,
          key_prefix: generatedKey.prefix,
          name,
        })
        .select('id, name, key_prefix, created_at')
        .single()

      if (error) {
        throw error
      }

      const created = data as {
        id: string
        name: string
        key_prefix: string
        created_at: string
      }

      return reply.status(201).send({
        id: created.id,
        name: created.name,
        key: generatedKey.raw,
        key_prefix: created.key_prefix,
        reveal: true,
        created_at: created.created_at,
        warning: 'Copy this key now. It will not be shown again.',
      })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to create API key')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })

  app.delete('/v1/apikeys/:id', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const params = request.params as { id?: string }

      if (!params.id) {
        return reply.status(404).send({
          error: 'API key not found',
          code: 404,
        })
      }

      await revokeApiKey(params.id, userId)
      return reply.status(204).send()
    } catch (error) {
      if (error instanceof ApiKeyNotFoundError) {
        return reply.status(404).send({
          error: 'API key not found',
          code: 404,
        })
      }

      request.log.error({ err: error }, 'Failed to revoke API key')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })
}

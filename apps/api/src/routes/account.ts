import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { supabaseAnon, supabaseService } from '../lib/supabase.js'

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

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.delete(
    '/v1/account/data',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await requireUserId(request)

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const results = await Promise.all([
          supabaseService.from('alert_history').delete().eq('user_id', userId),
          supabaseService.from('alert_settings').delete().eq('user_id', userId),
          supabaseService.from('requests').delete().eq('user_id', userId),
        ])

        const failure = results.find((result) => result.error)

        if (failure?.error) {
          throw failure.error
        }

        return reply.status(204).send()
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete account data')

        return reply.status(500).send({
          error: 'Internal server error',
          code: 500,
        })
      }
    },
  )

  app.delete(
    '/v1/account',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await requireUserId(request)

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const { error } = await supabaseService.auth.admin.deleteUser(userId)

        if (error) {
          throw error
        }

        return reply.status(204).send()
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete account')

        return reply.status(500).send({
          error: 'Internal server error',
          code: 500,
        })
      }
    },
  )
}

import type { FastifyPluginAsync } from 'fastify'

import { supabaseService } from '../lib/supabase.js'

type ModelRow = {
  model_id: string
  provider: string
  display_name: string
  input_cost_per_1m: number | string
  output_cost_per_1m: number | string
  context_window: number | null
  is_active: boolean
  updated_at: string | null
}

export const modelRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/models', async (request, reply) => {
    try {
      const { data, error } = await supabaseService
        .from('models')
        .select(
          'model_id, provider, display_name, input_cost_per_1m, output_cost_per_1m, context_window, is_active, updated_at',
        )
        .eq('is_active', true)
        .order('model_id', { ascending: true })

      if (error) {
        throw error
      }

      const models = ((data ?? []) as ModelRow[]).map((model) => ({
        model_id: model.model_id,
        provider: model.provider,
        display_name: model.display_name,
        input_cost_per_1m: Number(model.input_cost_per_1m),
        output_cost_per_1m: Number(model.output_cost_per_1m),
        context_window: model.context_window,
        is_active: model.is_active,
      }))

      const updatedAt = ((data ?? []) as ModelRow[]).reduce<string | null>(
        (latest, model) => {
          if (!model.updated_at) {
            return latest
          }

          if (!latest) {
            return model.updated_at
          }

          return new Date(model.updated_at).getTime() > new Date(latest).getTime()
            ? model.updated_at
            : latest
        },
        null,
      )

      reply.header('Cache-Control', 'public, max-age=3600')

      return reply.status(200).send({
        updated_at: updatedAt ?? new Date(0).toISOString(),
        models,
      })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch models')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })
}

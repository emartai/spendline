import { supabaseService } from './supabase.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

type CostEntry = {
  input: number
  output: number
}

type ModelRow = {
  model_id: string
  input_cost_per_1m: number | string
  output_cost_per_1m: number | string
}

const costMap = new Map<string, CostEntry>()
let cacheFetchedAt = 0

function roundToEight(value: number): number {
  return Math.round(value * 1e8) / 1e8
}

export async function getCostMap(): Promise<Map<string, CostEntry>> {
  const now = Date.now()

  if (cacheFetchedAt && now - cacheFetchedAt < CACHE_TTL_MS && costMap.size > 0) {
    return costMap
  }

  const { data, error } = await supabaseService
    .from('models')
    .select('model_id, input_cost_per_1m, output_cost_per_1m')
    .eq('is_active', true)

  if (error) {
    if (costMap.size > 0) {
      return costMap
    }

    return new Map()
  }

  costMap.clear()

  for (const model of (data ?? []) as ModelRow[]) {
    costMap.set(model.model_id, {
      input: Number(model.input_cost_per_1m),
      output: Number(model.output_cost_per_1m),
    })
  }

  cacheFetchedAt = now

  return costMap
}

export async function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): Promise<{ costUsd: number; unknownModel: boolean }> {
  const prices = (await getCostMap()).get(model)

  if (!prices) {
    return { costUsd: 0, unknownModel: true }
  }

  const cost =
    (tokensIn / 1_000_000) * prices.input + (tokensOut / 1_000_000) * prices.output

  return {
    costUsd: roundToEight(cost),
    unknownModel: false,
  }
}

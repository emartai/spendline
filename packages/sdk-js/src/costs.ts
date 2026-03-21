const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const API_URL = process.env.SPENDLINE_API_URL ?? "https://api.spendline.dev"

export const FALLBACK_BASELINE: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "gpt-5.2": { input: 1.75, output: 14.0 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gemini-2-5-flash": { input: 0.3, output: 2.5 },
}

let modelCache: Record<string, { input: number; output: number }> = {}
let cacheFetchedAt = 0

export async function getCostMap(apiUrl?: string) {
  const now = Date.now()
  if (cacheFetchedAt && now - cacheFetchedAt < CACHE_TTL_MS) {
    return modelCache
  }

  try {
    const res = await fetch(`${apiUrl ?? API_URL}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    })
    const data = (await res.json()) as {
      models: Array<{
        model_id: string
        input_cost_per_1m: number
        output_cost_per_1m: number
      }>
    }

    modelCache = Object.fromEntries(
      data.models.map((model) => [
        model.model_id,
        {
          input: model.input_cost_per_1m,
          output: model.output_cost_per_1m,
        },
      ]),
    )
    cacheFetchedAt = now
  } catch {
    if (!Object.keys(modelCache).length) {
      modelCache = { ...FALLBACK_BASELINE }
    }
  }

  return modelCache
}

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  map: Record<string, { input: number; output: number }>,
) {
  const prices = map[model]
  if (!prices) {
    return { costUsd: 0, unknownModel: true }
  }

  const cost = tokensIn / 1_000_000 * prices.input + tokensOut / 1_000_000 * prices.output
  return { costUsd: Math.round(cost * 1e8) / 1e8, unknownModel: false }
}

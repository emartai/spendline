import { patchAnthropic as patchAnthropicClient, patchOpenAI as patchOpenAIClient } from "./autopatch.js"
import { BatchBuffer } from "./batch.js"
import { calculateCost, getCostMap } from "./costs.js"

export interface TrackOptions {
  apiKey?: string
  workflowId?: string
  sessionId?: string
  metadata?: Record<string, string | number | boolean>
  apiUrl?: string
}

const DEFAULT_API_URL = process.env.SPENDLINE_API_URL ?? "https://api.spendline.dev"
const DISABLED = () => process.env.SPENDLINE_DISABLE === "true"
const LOG_ENABLED = () => process.env.SPENDLINE_LOG === "true"
const buffers = new Map<string, BatchBuffer>()

function detectProvider(model: string) {
  if (model.startsWith("claude-")) return "anthropic"
  if (model.startsWith("gpt-")) return "openai"
  if (model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) return "openai"
  if (model.startsWith("gemini-")) return "google"
  if (model.startsWith("deepseek-")) return "deepseek"
  if (model.startsWith("anthropic.")) return "bedrock"
  if (model.startsWith("amazon.")) return "bedrock"
  return "unknown"
}

function truncateMetadata(metadata?: Record<string, string | number | boolean>) {
  if (!metadata) return undefined

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, 500) : value,
    ]),
  )
}

function getBatchBuffer(apiKey: string, apiUrl: string) {
  const key = `${apiKey}:${apiUrl}`
  let buffer = buffers.get(key)
  if (!buffer) {
    buffer = new BatchBuffer(apiKey, apiUrl)
    buffers.set(key, buffer)
  }
  return buffer
}

type UsageResponse = {
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    input_tokens?: number
    output_tokens?: number
    inputTokens?: number
    outputTokens?: number
  }
  model?: string
  modelId?: string
}

function extractUsage(response: unknown) {
  const candidate = response as UsageResponse

  if (candidate.usage?.prompt_tokens != null) {
    return {
      tokensIn: candidate.usage.prompt_tokens,
      tokensOut: candidate.usage.completion_tokens ?? 0,
      model: candidate.model ?? "unknown",
    }
  }

  if (candidate.usage?.input_tokens != null) {
    return {
      tokensIn: candidate.usage.input_tokens,
      tokensOut: candidate.usage.output_tokens ?? 0,
      model: candidate.model ?? "unknown",
    }
  }

  if (candidate.usage?.inputTokens != null) {
    return {
      tokensIn: candidate.usage.inputTokens,
      tokensOut: candidate.usage.outputTokens ?? 0,
      model: candidate.modelId ?? "unknown",
    }
  }

  return { tokensIn: 0, tokensOut: 0, model: "unknown" }
}

async function recordResponse(
  response: unknown,
  startedAt: number,
  options?: TrackOptions,
) {
  const apiKey = options?.apiKey ?? process.env.SPENDLINE_API_KEY
  if (!apiKey) return

  const apiUrl = options?.apiUrl ?? DEFAULT_API_URL
  const { tokensIn, tokensOut, model } = extractUsage(response)
  const provider = detectProvider(model)
  const costMap = await getCostMap(apiUrl)
  const { costUsd, unknownModel } = calculateCost(model, tokensIn, tokensOut, costMap)

  const event = {
    model,
    provider,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: Math.max(0, Date.now() - startedAt),
    cost_usd: costUsd,
    unknown_model: unknownModel,
    workflow_id: options?.workflowId,
    session_id: options?.sessionId,
    metadata: truncateMetadata(options?.metadata),
    timestamp: new Date().toISOString(),
  }

  if (LOG_ENABLED()) {
    console.log(event)
  }

  getBatchBuffer(apiKey, apiUrl).add(event)
}

export async function track<T>(fn: () => Promise<T>, options?: TrackOptions): Promise<T> {
  const startedAt = Date.now()
  const response = await fn()

  if (DISABLED()) {
    return response
  }

  try {
    await recordResponse(response, startedAt, options)
  } catch {
    // Silent failure.
  }

  return response
}

export class Spendline {
  readonly apiKey?: string
  readonly apiUrl: string

  constructor(options: { apiKey?: string; apiUrl?: string } = {}) {
    this.apiKey = options.apiKey ?? process.env.SPENDLINE_API_KEY
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL
  }

  track<T>(fn: () => Promise<T>, options?: Omit<TrackOptions, "apiKey" | "apiUrl">) {
    return track(fn, {
      ...options,
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
    })
  }
}

export function patchOpenAI<T>(client: T): T {
  return patchOpenAIClient(client as T & object, track) as T
}

export function patchAnthropic<T>(client: T): T {
  return patchAnthropicClient(client as T & object, track) as T
}

export { BatchBuffer } from "./batch.js"
export { calculateCost, FALLBACK_BASELINE, getCostMap } from "./costs.js"

export const MODEL_NORMALISATION_MAP: Record<string, string> = {
  // OpenAI aliases
  'gpt-4o-2024-11-20': 'gpt-4o',
  'gpt-4o-2024-08-06': 'gpt-4o',
  'gpt-4o-mini-2024-07-18': 'gpt-4o-mini',

  // Anthropic aliases
  'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
  'claude-opus-4-20250514': 'claude-opus-4-6',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5',

  // Google aliases
  'gemini-2.5-pro': 'gemini-2-5-pro',
  'gemini-2.5-flash': 'gemini-2-5-flash',
  'gemini-2.5-flash-lite': 'gemini-2-5-flash-lite',
  'gemini-3.1-pro-preview': 'gemini-3-1-pro-preview',
}

export function normaliseModel(raw: string): string {
  return MODEL_NORMALISATION_MAP[raw] ?? raw
}


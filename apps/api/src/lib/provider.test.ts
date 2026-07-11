import { describe, expect, it } from 'vitest'

import { detectProvider } from './provider.js'

describe('detectProvider', () => {
  it.each([
    ['mistral-large-latest', 'mistral'],
    ['grok-2-latest', 'xai'],
    ['llama-3.3-70b-versatile', 'groq'],
    ['mixtral-8x7b-32768', 'groq'],
  ])('detects %s as %s', (modelId, provider) => {
    expect(detectProvider(modelId)).toBe(provider)
  })

  it('returns unknown for an unrecognized model', () => {
    expect(detectProvider('unrecognized-model')).toBe('unknown')
  })
})

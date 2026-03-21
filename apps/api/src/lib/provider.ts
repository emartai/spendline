export function detectProvider(modelId: string): string {
  if (modelId.startsWith('claude-')) {
    return 'anthropic'
  }

  if (modelId.startsWith('gpt-')) {
    return 'openai'
  }

  if (
    modelId.startsWith('o1') ||
    modelId.startsWith('o3') ||
    modelId.startsWith('o4')
  ) {
    return 'openai'
  }

  if (modelId.startsWith('gemini-')) {
    return 'google'
  }

  if (modelId.startsWith('deepseek-')) {
    return 'deepseek'
  }

  if (modelId.startsWith('anthropic.')) {
    return 'bedrock'
  }

  if (modelId.startsWith('amazon.')) {
    return 'bedrock'
  }

  return 'unknown'
}


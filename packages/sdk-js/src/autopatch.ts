type OpenAIChatCompletionsClient = {
  chat?: {
    completions?: {
      create?: (...args: unknown[]) => Promise<unknown>
    }
  }
}

type AnthropicMessagesClient = {
  messages?: {
    create?: (...args: unknown[]) => Promise<unknown>
  }
}

type TrackFunction = <T>(
  fn: () => Promise<T>,
  options?: {
    apiKey?: string
    workflowId?: string
    sessionId?: string
    metadata?: Record<string, string | number | boolean>
    apiUrl?: string
  },
) => Promise<T>

const PATCHED = Symbol.for("spendline.patched")

function markPatched<T extends object>(value: T): T {
  Object.defineProperty(value, PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
  })
  return value
}

function isPatched(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as Record<PropertyKey, unknown>)[PATCHED])
}

function createTrackedMethod<TMethod extends (...args: unknown[]) => Promise<unknown>>(
  method: TMethod,
  track: TrackFunction,
): TMethod {
  return (async (...args: Parameters<TMethod>) => track(() => method(...args))) as TMethod
}

export function patchOpenAI<T extends OpenAIChatCompletionsClient>(client: T, track: TrackFunction): T {
  const completions = client.chat?.completions
  if (!completions || isPatched(completions) || typeof completions.create !== "function") {
    return client
  }

  const proxy = new Proxy(completions, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (prop === "create" && typeof value === "function") {
        return createTrackedMethod(value.bind(target), track)
      }
      return value
    },
  })

  markPatched(proxy)
  ;(client.chat as NonNullable<T["chat"]>).completions = proxy as NonNullable<NonNullable<T["chat"]>["completions"]>
  return client
}

export function patchAnthropic<T extends AnthropicMessagesClient>(client: T, track: TrackFunction): T {
  const messages = client.messages
  if (!messages || isPatched(messages) || typeof messages.create !== "function") {
    return client
  }

  const proxy = new Proxy(messages, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (prop === "create" && typeof value === "function") {
        return createTrackedMethod(value.bind(target), track)
      }
      return value
    },
  })

  markPatched(proxy)
  client.messages = proxy as T["messages"]
  return client
}

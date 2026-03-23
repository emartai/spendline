import { afterEach, describe, expect, it, vi } from "vitest"

import { BatchBuffer } from "../src/batch.js"
import { clearRuntimeState, track } from "../src/index.js"

describe("track", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SPENDLINE_API_KEY
    delete process.env.SPENDLINE_DISABLE
    clearRuntimeState()
  })

  it("preserves return type and value", async () => {
    process.env.SPENDLINE_API_KEY = "sl_live_test"

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ models: [] }),
    } as Response)

    const response = { ok: true as const, usage: { prompt_tokens: 1, completion_tokens: 1 }, model: "gpt-5-mini" }
    const result = await track(async () => response)

    expect(result).toBe(response)
    expect(result.ok).toBe(true)
  })

  it("sends correct payload", async () => {
    process.env.SPENDLINE_API_KEY = "sl_live_test"

    const fetchMock = vi.spyOn(globalThis, "fetch")
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          models: [
            {
              model_id: "gpt-5-mini",
              input_cost_per_1m: 0.25,
              output_cost_per_1m: 2,
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)

    const originalAdd = BatchBuffer.prototype.add
    vi.spyOn(BatchBuffer.prototype, "add").mockImplementation(function (
      this: BatchBuffer,
      event: object,
    ) {
      originalAdd.call(this, event)
      this.flush()
    })

    const response = { usage: { prompt_tokens: 10, completion_tokens: 5 }, model: "gpt-5-mini" }
    await track(async () => response, {
      apiKey: "sl_live_test_payload",
      workflowId: "chat-feature",
      sessionId: "sess_123",
      metadata: { userId: "u_456", env: "prod" },
    })

    const ingestCall = fetchMock.mock.calls.find(
      (call) => call[0] === "https://api.spendline.dev/v1/ingest",
    )
    expect(ingestCall?.[0]).toBe("https://api.spendline.dev/v1/ingest")
    expect((ingestCall?.[1] as RequestInit).method).toBe("POST")
    expect((ingestCall?.[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer sl_live_test_payload",
      "Content-Type": "application/json",
    })

    const payload = JSON.parse(String((ingestCall?.[1] as RequestInit).body))
    expect(payload[0]).toMatchObject({
      model: "gpt-5-mini",
      provider: "openai",
      tokens_in: 10,
      tokens_out: 5,
      request_id: expect.any(String),
      workflow_id: "chat-feature",
      session_id: "sess_123",
      metadata: { userId: "u_456", env: "prod" },
    })
  })

  it("does not throw on network failure", async () => {
    process.env.SPENDLINE_API_KEY = "sl_live_test"

    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("pricing failed"))
      .mockRejectedValueOnce(new Error("ingest failed"))

    const response = { usage: { prompt_tokens: 10, completion_tokens: 5 }, model: "gpt-5-mini" }

    await expect(track(async () => response)).resolves.toBe(response)
  })
})

describe("BatchBuffer", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearRuntimeState()
  })

  it("flushes at max size", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response)
    const buffer = new BatchBuffer("sl_live_test", "https://api.spendline.dev", 2, 10_000)

    buffer.add({ id: 1 })
    buffer.add({ id: 2 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.spendline.dev/v1/ingest")
  })

  it("timer does not block process exit", () => {
    const unref = vi.fn()
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockReturnValue({
      unref,
    } as unknown as ReturnType<typeof setTimeout>)

    new BatchBuffer("sl_live_test", "https://api.spendline.dev")

    expect(setTimeoutSpy).toHaveBeenCalled()
    expect(unref).toHaveBeenCalled()
  })
})

export class BatchBuffer {
  private buffer: object[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private apiKey: string,
    private apiUrl: string,
    private maxSize = 100,
    private flushInterval = 2000,
  ) {
    this.scheduleFlush()
  }

  add(event: object) {
    this.buffer.push(event)
    if (this.buffer.length >= this.maxSize) {
      this.flush()
    }
  }

  private scheduleFlush() {
    this.timer = setTimeout(() => {
      this.flush()
      this.scheduleFlush()
    }, this.flushInterval)

    if (typeof this.timer.unref === "function") {
      this.timer.unref()
    }
  }

  flush() {
    if (!this.buffer.length) {
      return
    }

    const events = this.buffer.splice(0)
    fetch(`${this.apiUrl}/v1/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(events),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {})
  }
}

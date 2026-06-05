import { ClaudeCodeMessageAdapter } from './claudeCodeMessageAdapter'

describe('ClaudeCodeMessageAdapter', () => {
  it('does not send thinking for Opus 4.8 when model settings omit it', async () => {
    let requestBody: Record<string, unknown> | undefined
    const fetchFn = jest.fn(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body))
      throw new Error('stop')
    }) as unknown as typeof fetch

    const adapter = new ClaudeCodeMessageAdapter({
      endpoint: 'https://example.com/v1/messages',
      fetchFn,
    })

    await expect(
      adapter.generateResponse(
        {
          model: 'claude-opus-4-8',
          messages: [],
        },
        undefined,
        {},
      ),
    ).rejects.toThrow('stop')

    expect(requestBody?.model).toBe('claude-opus-4-8')
    expect(requestBody?.thinking).toBeUndefined()
  })

  it('sends thinking for Sonnet 4.6 when model settings enable it', async () => {
    let requestBody: Record<string, unknown> | undefined
    const fetchFn = jest.fn(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body))
      throw new Error('stop')
    }) as unknown as typeof fetch

    const adapter = new ClaudeCodeMessageAdapter({
      endpoint: 'https://example.com/v1/messages',
      fetchFn,
    })

    await expect(
      adapter.generateResponse(
        {
          model: 'claude-sonnet-4-6',
          messages: [],
        },
        undefined,
        {},
        {
          enabled: true,
          budget_tokens: 8192,
        },
      ),
    ).rejects.toThrow('stop')

    expect(requestBody?.model).toBe('claude-sonnet-4-6')
    expect(requestBody?.thinking).toEqual({
      type: 'enabled',
      budget_tokens: 8192,
    })
  })
})
